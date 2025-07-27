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
  // If an `authorize` function is supplied, it will be invoked
  // with `req` at the start of each request. If it throws
  // an error, a 403 forbidden error is sent. Use this mechanism
  // to block unauthorized use and potential denial of service.

  bigUploadMiddleware({ authorize } = {}) {
    return (req, res, next) => {
      // Chain the multer middleware to handle normal uploads
      // as chunks (more efficient than base64 etc)
      const multerFn = multer({ dest: require('os').tmpdir() }).any();
      return multerFn(req, res, () => {
        return body(req, res, next);
      });
    };

    async function body(req, res, next) {
      const origFiles = req.files;
      try {
        if (authorize) {
          try {
            await authorize(req);
          } catch (e) {
            self.logError('bigUploadUnauthorized', e);
            return res.status(403).send({
              name: 'forbidden',
              message: 'Unauthorized aposBigUpload request'
            });
          }
        }
        const params = req.query.aposBigUpload;
        if (!params) {
          return next();
        }
        if (params.type === 'start') {
          return await self.bigUploadStart(req, req.body.files);
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
        // Clean up multer temporary files
        for (const file of (origFiles || [])) {
          try {
            await unlink(file.path);
          } catch (e) {
            // OK if it is already gone
          }
        }
      }
    };
  },

  async bigUploadStart(req, files = {}) {
    await self.bigUploadCleanup();
    try {
      const id = self.apos.util.generateId();
      const formattedFiles = Object.fromEntries(
        Object.entries(files).map(([ param, info ]) => {
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
          if ((typeof info.size) !== 'number') {
            throw invalid('size');
          }
          if ((typeof info.chunks) !== 'number') {
            throw invalid('chunks');
          }
          return [ param, {
            name: info.name,
            size: info.size,
            type: info.type,
            chunks: info.chunks
          } ];
        })
      );
      await self.bigUploads.insert({
        _id: id,
        files: formattedFiles,
        start: Date.now()
      });
      return req.res.send({
        id
      });
    } catch (e) {
      return req.res.status(500).send({
        name: 'error',
        message: 'aposBigUpload error'
      });
    }
    function invalid(s) {
      self.apos.util.error(`Invalid bigUpload parameter: ${s}`);
      return self.apos.error('invalid', s);
    }
  },

  async bigUploadChunk(req, params) {
    try {
      const id = self.apos.launder.id(params.id);
      const n = self.apos.launder.integer(params.n);
      const chunk = self.apos.launder.integer(params.chunk);
      const bigUpload = await self.bigUploads.findOne({ _id: id });
      if (!bigUpload) {
        throw self.apos.error('notfound');
      }
      if ((n < 0) || (n >= Object.keys(bigUpload.files).length)) {
        throw self.apos.error('invalid', 'n out of range');
      }
      const info = Object.values(bigUpload.files)[n];
      if ((chunk < 0) || (chunk >= info.chunks)) {
        throw self.apos.error('invalid', 'chunk out of range');
      }
      const file = req.files.find(f => f.fieldname === 'chunk') || req.files[0];
      const ufs = self.getBigUploadFs();
      const ufsPath = `/big-uploads/${id}-${n}-${chunk}`;
      await ufs.copyIn(file.path, ufsPath);
      return req.res.send({});
    } catch (e) {
      self.logError('bigUploadError', e);
      return req.res.status(500).send({
        name: 'error',
        message: 'aposBigUpload error'
      });
    }
  },

  async bigUploadEnd(req, id, next) {
    const ufs = self.getBigUploadFs();
    let bigUpload;
    try {
      bigUpload = await self.bigUploads.findOne({
        _id: id
      });
      if (!bigUpload) {
        return req.res.status(400).send({
          name: 'invalid'
        });
      }
      let n = 0;
      req.files = {};
      for (const [ param, {
        name, type, chunks
      } ] of Object.entries(bigUpload.files)) {
        const extname = require('path').extname(name);
        const ext = extname ? extname.substring(1) : 'tmp';
        const tmp = `${ufs.getTempPath()}/${id}-${n}.${ext}`;
        const out = await open(tmp, 'w');
        for (let i = 0; (i < chunks); i++) {
          const ufsPath = `/big-uploads/${id}-${n}-${i}`;
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
        await out.close();
        n++;
        req.files[param] = {
          name,
          path: tmp,
          type
        };
      }
      return next();
    } catch (e) {
      self.logError('bigUploadError', e);
      return req.res.status(500).send({
        name: 'error',
        message: 'aposBigUpload error'
      });
    } finally {
      // Intentionally in background
      self.bigUploadCleanupOne(bigUpload);
    }
  },

  async bigUploadCleanup() {
    const old = await self.bigUploads.find({
      start: {
        $lte: Date.now() - self.options.bigUploadMaxSeconds * 1000
      }
    }).toArray();
    for (const bigUpload of old) {
      await self.bigUploadCleanupOne(bigUpload);
    }
  },

  async bigUploadCleanupOne(bigUpload) {
    const ufs = self.getBigUploadFs();
    const id = bigUpload._id;
    let n = 0;
    for (const { chunks } of Object.values(bigUpload.files)) {
      for (let i = 0; (i < chunks); i++) {
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
