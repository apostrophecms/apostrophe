const multer = require('multer');
const util = require('util');
const {
  readFile, open, unlink
} = require('node:fs/promises');

module.exports = (self) => ({
  // Returns middleware that allows any route to receive large
  // uploads made via big-upload-client. A workaround for
  // the max POST size, max uploaded file size, etc. of
  // nginx and other proxy servers.
  //
  // The aposBigUpload protocol allocates server-side upload state and
  // writes files to uploadfs before the route's own handler ever runs, so
  // by default the middleware refuses any request that does not have
  // `req.user`. A route that checks permissions itself is still checking
  // them too late.
  //
  // If an `authorize` function is supplied, it replaces that default check
  // and is invoked with `req` at the start of each request, before the
  // request body is parsed. If it throws an error, a 403 forbidden error
  // is sent. Use this mechanism to require more than a login, such as a
  // particular permission.
  //
  // If `authorize` is explicitly `false`, no check is made at all and the
  // route accepts big uploads from anonymous visitors. Only do this if the
  // route has its own protection against denial of service. Any other
  // non-function value is an error, so that a typo cannot silently leave a
  // route unprotected.

  bigUploadMiddleware({ authorize } = {}) {
    if (
      (authorize !== undefined) &&
      (authorize !== false) &&
      ((typeof authorize) !== 'function')
    ) {
      // Only `false` turns the check off, so that a misspelled or undefined
      // variable cannot quietly open the route to everyone
      throw new Error('The authorize option to bigUploadMiddleware must be a function, or false to accept big uploads from anonymous visitors.');
    }
    const authorizeFn = (authorize === undefined)
      ? requireUser
      : authorize;
    return (req, res, next) => {
      // Express ignores the promise a middleware returns, so nothing in here
      // may reject: an unhandled rejection reaches the process itself, and
      // by default takes it down
      run(req, res, next).catch(e => {
        self.logError(req, 'bigUploadError', e.message, { stack: e.stack });
        if (!res.headersSent) {
          res.status(500).send({
            name: 'error',
            message: 'aposBigUpload error'
          });
        }
      });
    };

    async function run(req, res, next) {
      if (!await authorized(req, res)) {
        return;
      }
      // Chain the multer middleware to handle normal uploads
      // as chunks (more efficient than base64 etc). Never before
      // authorization: multer writes the body to a temporary file
      try {
        await multerAny(req, res);
      } catch (e) {
        // A parse that fails partway can still have written temporary
        // files, and `body` never runs to clean them up
        await removeTempFiles(req.files);
        throw e;
      }
      return body(req, res, next);
    }

    function requireUser(req) {
      if (!req.user) {
        throw self.apos.error('forbidden');
      }
    }

    async function authorized(req, res) {
      if (!authorizeFn) {
        return true;
      }
      try {
        await authorizeFn(req);
      } catch (e) {
        // No stack: a refused request is not an exception, and anyone at
        // all can provoke this line as often as they like
        self.logError(req, 'bigUploadUnauthorized', e.message);
        res.status(403).send({
          name: 'forbidden',
          message: 'Unauthorized aposBigUpload request'
        });
        return false;
      }
      return true;
    }

    function multerAny(req, res) {
      return new Promise((resolve, reject) => {
        multer({ dest: require('os').tmpdir() }).any()(req, res, (e) => {
          return e ? reject(e) : resolve();
        });
      });
    }

    async function body(req, res, next) {
      const origFiles = req.files;
      try {
        const params = req.query.aposBigUpload;
        if (!params) {
          return next();
        }
        if (params.type === 'start') {
          return await self.bigUploadStart(req, req.body && req.body.files);
        } else if (params.type === 'chunk') {
          return await self.bigUploadChunk(req, params);
        } else if (params.type === 'end') {
          return await self.bigUploadEnd(req, params.id, next);
        } else {
          return res.status(400).send({
            name: 'invalid',
            message: 'Invalid aposBigUpload request'
          });
        }
      } finally {
        await removeTempFiles(origFiles);
      }
    };

    async function removeTempFiles(files) {
      for (const file of (files || [])) {
        try {
          await unlink(file.path);
        } catch (e) {
          // OK if it is already gone
        }
      }
    }
  },

  async bigUploadStart(req, files = {}) {
    try {
      await self.bigUploadCleanup();
      if (((typeof files) !== 'object') || (files === null) || Array.isArray(files)) {
        throw invalid('files');
      }
      const entries = Object.entries(files);
      if (entries.length > self.options.bigUploadMaxFiles) {
        throw invalid('too many files');
      }
      const id = self.apos.util.generateId();
      const formattedFiles = Object.fromEntries(
        entries.map(([ param, info ]) => {
          if ((typeof param) !== 'string') {
            throw invalid('param');
          }
          if (((typeof info) !== 'object') || (info == null)) {
            throw invalid('info');
          }
          if ((typeof info.name) !== 'string') {
            throw invalid('name');
          }
          if (!info.name.length) {
            throw invalid('name empty');
          }
          if (!Number.isFinite(info.size) || (info.size < 0)) {
            throw invalid('size');
          }
          // The chunk count drives a loop over uploadfs for every chunk, both
          // when assembling the upload and when cleaning it up, so it must be
          // a sane integer and not merely a number. A zero-byte file has no
          // chunks, which is how big-upload-client represents it.
          if (
            !Number.isInteger(info.chunks) ||
            (info.chunks < 0) ||
            ((info.chunks === 0) && (info.size !== 0))
          ) {
            throw invalid('chunks');
          }
          if (info.chunks > self.options.bigUploadMaxChunks) {
            throw invalid('too many chunks');
          }
          return [ param, {
            name: info.name,
            size: info.size,
            type: self.apos.launder.string(info.type),
            chunks: info.chunks
          } ];
        })
      );
      await self.bigUploads.insert({
        _id: id,
        userId: (req.user && req.user._id) || null,
        files: formattedFiles,
        start: Date.now()
      });
      return req.res.send({
        id
      });
    } catch (e) {
      return self.bigUploadErrorResponse(req, e);
    }
    function invalid(s) {
      return self.apos.error('invalid', s);
    }
  },

  async bigUploadChunk(req, params) {
    try {
      const bigUpload = await self.bigUploadFor(req, params.id);
      const n = self.apos.launder.integer(params.n);
      const chunk = self.apos.launder.integer(params.chunk);
      if ((n < 0) || (n >= Object.keys(bigUpload.files).length)) {
        throw self.apos.error('invalid', 'n out of range');
      }
      const info = Object.values(bigUpload.files)[n];
      if ((chunk < 0) || (chunk >= info.chunks)) {
        throw self.apos.error('invalid', 'chunk out of range');
      }
      const file = (req.files || []).find(f => f.fieldname === 'chunk') ||
        (req.files || [])[0];
      if (!file) {
        throw self.apos.error('invalid', 'no chunk sent');
      }
      const ufs = self.getBigUploadFs();
      const ufsPath = `/big-uploads/${bigUpload._id}-${n}-${chunk}`;
      await ufs.copyIn(file.path, ufsPath);
      return req.res.send({});
    } catch (e) {
      return self.bigUploadErrorResponse(req, e);
    }
  },

  async bigUploadEnd(req, id, next) {
    const ufs = self.getBigUploadFs();
    let bigUpload;
    try {
      bigUpload = await self.bigUploadFor(req, id);
      let n = 0;
      req.files = {};
      for (const [ param, {
        name, type, chunks
      } ] of Object.entries(bigUpload.files)) {
        const extname = require('path').extname(name);
        const ext = extname ? extname.substring(1) : 'tmp';
        const tmp = `${ufs.getTempPath()}/${bigUpload._id}-${n}.${ext}`;
        const out = await open(tmp, 'w');
        try {
          for (let i = 0; (i < chunks); i++) {
            const ufsPath = `/big-uploads/${bigUpload._id}-${n}-${i}`;
            const chunkTmp = `${tmp}.${i}`;
            try {
              await ufs.copyOut(ufsPath, chunkTmp);
              const data = await readFile(chunkTmp);
              await out.writeFile(data);
            } finally {
              try {
                await unlink(chunkTmp);
              } catch (e) {
                // Probably never got that far
              }
            }
          }
        } finally {
          await out.close();
        }
        n++;
        req.files[param] = {
          name,
          path: tmp,
          type
        };
      }
      return next();
    } catch (e) {
      return self.bigUploadErrorResponse(req, e);
    } finally {
      if (bigUpload) {
        // Intentionally in background, but a failure to clean up must not
        // become an unhandled rejection
        self.bigUploadCleanupOne(bigUpload).catch(e => {
          self.logError(req, 'bigUploadCleanupError', e.message, {
            stack: e.stack
          });
        });
      }
    }
  },

  // Fetch the aposBigUpload record for the given id on behalf of `req`,
  // throwing `notfound` unless it exists and belongs to the same user that
  // started it. The id arrives from the query string, so it must be
  // laundered to a string: an object would otherwise reach the selector as
  // a MongoDB query operator and match somebody else's upload.

  async bigUploadFor(req, id) {
    const _id = self.apos.launder.id(id);
    if (!_id) {
      throw self.apos.error('notfound');
    }
    const bigUpload = await self.bigUploads.findOne({ _id });
    if (!bigUpload) {
      throw self.apos.error('notfound');
    }
    const userId = (req.user && req.user._id) || null;
    if ((bigUpload.userId || null) !== userId) {
      throw self.apos.error('notfound');
    }
    return bigUpload;
  },

  // Send the response for an error thrown while handling an aposBigUpload
  // request. Errors from `apos.error` that map to a status code are
  // reported with that code, so the client can distinguish a rejected
  // request from a server failure. Anything else is logged server-side and
  // reported as a bare 500.

  bigUploadErrorResponse(req, e) {
    const status = e.aposError && self.errors[e.name];
    if (status) {
      return req.res.status(status).send({
        name: e.name,
        // Always a fixed string naming the parameter at fault, never
        // anything taken from the request
        message: e.message
      });
    }
    self.logError(req, 'bigUploadError', e.message, { stack: e.stack });
    return req.res.status(500).send({
      name: 'error',
      message: 'aposBigUpload error'
    });
  },

  async bigUploadCleanup() {
    const old = await self.bigUploads.find({
      start: {
        $lte: Date.now() - self.options.bigUploadMaxSeconds * 1000
      }
    }).toArray();
    for (const bigUpload of old) {
      try {
        await self.bigUploadCleanupOne(bigUpload);
      } catch (e) {
        // One unremovable upload must not block every later upload
        self.logError('bigUploadCleanupError', e.message, { stack: e.stack });
      }
    }
  },

  async bigUploadCleanupOne(bigUpload) {
    if (!bigUpload) {
      return;
    }
    const ufs = self.getBigUploadFs();
    const id = bigUpload._id;
    let n = 0;
    const files = Object.values(bigUpload.files || {})
      .slice(0, self.options.bigUploadMaxFiles);
    for (const { chunks } of files) {
      // Records written before file and chunk counts were bounded, or by a
      // future bug, must not turn cleanup into an endless loop. Excess legacy
      // entries are abandoned when the upload record is deleted below rather
      // than allowing one cleanup request to perform unbounded work.
      const total = Math.min(
        Number.isInteger(chunks) ? chunks : 0,
        self.options.bigUploadMaxChunks
      );
      for (let i = 0; (i < total); i++) {
        const ufsPath = `/big-uploads/${id}-${n}-${i}`;
        try {
          await ufs.remove(ufsPath);
        } catch (e) {
          // It's OK if someone else already removed it
          // or it never got there
        }
      }
      n++;
    }
    await self.bigUploads.deleteOne({
      _id: bigUpload._id
    });
  },

  getBigUploadFs() {
    const uploadfs = self.apos.attachment.uploadfs;
    return {
      copyIn: util.promisify(uploadfs.copyIn),
      copyOut: util.promisify(uploadfs.copyOut),
      remove: util.promisify(uploadfs.remove),
      getTempPath: uploadfs.getTempPath
    };
  }
});
