const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const tar = require('tar-stream');
const assert = require('assert');
const qs = require('qs');
const t = require('apostrophe/test-lib/util.js');

const gzipFormat = require('../lib/formats/gzip.js');
const { getAppConfig, insertAdminUser } = require('./util/index.js');

describe('vulnerability regression checks', function() {
  it('zip slip', async function() {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-zip-slip-'));
    const archivePath = path.join(base, 'evil-export.gz');
    const exportPath = archivePath.replace(/\.gz$/, '');

    await makeArchive(archivePath);

    const expectedOutsideWrite = path.resolve(exportPath, '../../zip-slip-pwned.txt');

    // Ensure clean pre-state
    try {
      await fsp.unlink(expectedOutsideWrite);
    } catch (e) {
      // Don't care if it was there or not
    }

    await gzipFormat.input(archivePath);
    const exists = fs.existsSync(expectedOutsideWrite);
    assert(!exists);
  });

  // GHSA-79qf-vqgc-7xx3: the source path of each imported attachment is
  // rebuilt from the attacker-controlled `_id`, `name` and `extension`
  // fields of aposAttachments.json. Without a traversal guard, a `../`
  // sequence escapes the extraction directory and causes an arbitrary host
  // file to be read and copied into the public uploads directory.
  it('attachment path traversal via aposAttachments.json', async function() {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-attachment-traversal-'));
    const exportDir = path.join(base, 'export');
    const attachmentsDir = path.join(exportDir, 'attachments');
    await fsp.mkdir(attachmentsDir, { recursive: true });

    // No documents, we only care about the attachment metadata here.
    await fsp.writeFile(path.join(exportDir, 'aposDocs.json'), '[]');

    // Every reconstructed source path must stay inside this directory.
    const containBase = path.resolve(attachmentsDir) + path.sep;
    const sandboxBase = path.resolve(base) + path.sep;

    // Attacker-controlled attachment records whose reconstructed on-disk
    // source path attempts to climb out of the extraction directory. Each
    // one exercises a different tainted field.
    const payloads = [
      // The advisory's exact vector: traversal in `name`.
      {
        _id: 'evilatt0001',
        name: '../../../../pwned_via_name',
        extension: 'txt',
        title: 'loot',
        docIds: [],
        crops: []
      },
      // Traversal in `_id`.
      {
        _id: '../../pwned_via_id',
        name: 'loot',
        extension: 'txt',
        title: 'loot',
        docIds: [],
        crops: []
      }
    ];

    for (const attachment of payloads) {
      // The path the unpatched code would read from.
      const filename = `${attachment._id}-${attachment.name}.${attachment.extension}`;
      const escapeTarget = path.resolve(attachmentsDir, filename);

      // Sanity checks that keep this test both meaningful and safe:
      // the payload really does escape the attachments directory...
      assert(
        !escapeTarget.startsWith(containBase),
        `test payload does not actually escape the attachments dir: ${escapeTarget}`
      );
      // ...yet still lands inside our temp sandbox, so the test never
      // reads or writes real host files.
      assert(
        escapeTarget.startsWith(sandboxBase),
        `test payload escaped the sandbox, refusing to run: ${escapeTarget}`
      );

      // Plant a "secret" file at the escape target, with an allow-listed
      // extension, standing in for a sensitive host file.
      await fsp.mkdir(path.dirname(escapeTarget), { recursive: true });
      await fsp.writeFile(escapeTarget, 'TOP-SECRET');

      await fsp.writeFile(
        path.join(exportDir, 'aposAttachments.json'),
        JSON.stringify([ attachment ])
      );

      // A malicious archive must not yield a source path that escapes the
      // extraction directory. Either input() rejects it (throws), or every
      // reconstructed path stays within the attachments directory.
      let result = null;
      let threw = false;
      try {
        result = await gzipFormat.input(exportDir);
      } catch (e) {
        threw = true;
      }

      if (!threw) {
        for (const { file } of result.attachmentsInfo) {
          const resolved = path.resolve(file.path);
          assert(
            resolved.startsWith(containBase),
            `attachment source path escaped the extraction directory: ${resolved}`
          );
        }
      }
    }
  });

  // A malicious archive must not be able to stall extraction forever. A tar
  // DIRECTORY entry whose name contains a traversal sequence is rejected by
  // the zip-slip guard, but the guard must still advance to the next entry.
  // Historically it forgot to call `next()` for directories, so tar-stream
  // never emitted `finish`, the extraction promise never resolved, and the
  // whole import request hung (an authenticated denial of service).
  it('does not hang when a traversal directory entry is present', async function() {
    this.timeout(15000);
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-extract-hang-'));
    const archivePath = path.join(base, 'evil-export.gz');

    await makeDirTraversalArchive(archivePath);

    let timer;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('gzip.input() hung on a traversal directory entry')),
        5000
      );
      // Don't keep the event loop alive on account of this backstop timer.
      timer.unref?.();
    });

    try {
      const result = await Promise.race([ gzipFormat.input(archivePath), timeout ]);
      // Extraction completed rather than stalling.
      assert(Array.isArray(result.docs));
    } finally {
      clearTimeout(timer);
    }
  });

  // Archive JSON is parsed with EJSON, which revives objects such as
  // { $ne: null } as live values. The attachment `_id` is later used as a
  // MongoDB `_id` selector (`attachment.db.findOne({ _id })`), so a non-string
  // `_id` would smuggle a query operator into the database. The reconstructed
  // filename fields must be plain strings.
  it('rejects non-string attachment id/name/extension (NoSQL operator smuggling)', async function() {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-attachment-operator-'));
    const exportDir = path.join(base, 'export');
    await fsp.mkdir(path.join(exportDir, 'attachments'), { recursive: true });
    await fsp.writeFile(path.join(exportDir, 'aposDocs.json'), '[]');

    const payloads = [
      { _id: { $ne: null }, name: 'loot', extension: 'txt', docIds: [], crops: [] },
      { _id: 'evil', name: { $gt: '' }, extension: 'txt', docIds: [], crops: [] },
      { _id: 'evil', name: 'loot', extension: { $gt: '' }, docIds: [], crops: [] }
    ];

    for (const attachment of payloads) {
      await fsp.writeFile(
        path.join(exportDir, 'aposAttachments.json'),
        JSON.stringify([ attachment ])
      );

      let result = null;
      let threw = false;
      try {
        result = await gzipFormat.input(exportDir);
      } catch (e) {
        threw = true;
      }

      // Either input() rejects the archive, or the surfaced attachment
      // metadata must carry only plain-string identity fields, so nothing
      // that could act as a query operator reaches the database.
      if (!threw) {
        for (const { attachment: att } of result.attachmentsInfo) {
          assert.strictEqual(typeof att._id, 'string', `attachment._id must be a string, got ${typeof att._id}`);
          assert.strictEqual(typeof att.name, 'string', `attachment.name must be a string, got ${typeof att.name}`);
          assert.strictEqual(typeof att.extension, 'string', `attachment.extension must be a string, got ${typeof att.extension}`);
        }
      }
    }
  });

  // GHSA-86wm-68pq-5jwq: the import routes passed no `authorize` callback to
  // `bigUploadMiddleware()`, so the chunked upload protocol ran for anyone.
  // An unauthenticated request reached `start`, `chunk` and `end` — creating
  // an upload record, storing chunk data and assembling a temporary file —
  // before `import()` made its own `req.user` check and refused the import.
  describe('unauthenticated aposBigUpload on the import routes', function() {
    let apos;
    let jar;

    this.timeout(60000);

    before(async function() {
      apos = await t.create({
        root: module,
        testModule: true,
        modules: getAppConfig()
      });
      await insertAdminUser(apos);
    });

    after(async function() {
      await t.destroy(apos);
      apos = null;
    });

    // The aposBigUpload query parameters travel in the URL, so send the
    // request by hand rather than through the browser-side client
    const bigUploadRequest = async (action, aposBigUpload, body) => {
      const url = `${action}/import-export-import?` +
        qs.stringify({ aposBigUpload });
      try {
        const response = await apos.http.post(url, {
          body: body || {},
          fullResponse: true,
          // The CSRF check only proves the request came from our own origin;
          // its value is a well-known constant, so an attacker's script sets
          // it as easily as the admin UI does. Send it, so that what this
          // test measures is authorization and nothing else. A jar supplies
          // the whole cookie header itself, csrf cookie included
          ...(jar
            ? { jar }
            : { headers: { cookie: `${apos.csrfCookieName}=csrf` } })
        });
        return response.status;
      } catch (e) {
        return e.status;
      }
    };

    // Both the page module and a piece type register the route
    const actions = [
      '/api/v1/@apostrophecms/page',
      '/api/v1/article'
    ];

    it('refuses an anonymous start and stores no upload', async function() {
      for (const action of actions) {
        const status = await bigUploadRequest(action, { type: 'start' }, {
          files: {
            file: {
              name: 'evil.tar.gz',
              size: 4,
              type: 'application/gzip',
              chunks: 50
            }
          }
        });
        assert.strictEqual(status, 403, action);
      }
      assert.strictEqual(await apos.http.bigUploads.countDocuments({}), 0);
    });

    it('refuses an anonymous chunk and end', async function() {
      for (const action of actions) {
        const chunk = await bigUploadRequest(action, {
          type: 'chunk',
          id: 'abcdefghijklmnopqrstuvwx',
          n: 0,
          chunk: 0
        });
        assert.strictEqual(chunk, 403, action);
        const end = await bigUploadRequest(action, {
          type: 'end',
          id: 'abcdefghijklmnopqrstuvwx'
        });
        assert.strictEqual(end, 403, action);
      }
    });

    it('still starts an upload for a logged-in user', async function() {
      jar = apos.http.jar();
      await apos.http.post('/api/v1/@apostrophecms/login/login', {
        body: {
          username: 'admin',
          password: 'admin',
          session: true
        },
        jar
      });
      // A safe request is what establishes the csrf cookie in the jar
      await apos.http.get('/', { jar });
      for (const action of actions) {
        const status = await bigUploadRequest(action, { type: 'start' }, {
          files: {
            file: {
              name: 'real.tar.gz',
              size: 4,
              type: 'application/gzip',
              chunks: 1
            }
          }
        });
        assert.strictEqual(status, 200, action);
      }
      await apos.http.bigUploads.deleteMany({});
    });
  });

  // GHSA-97wv-p4xx-c7mg: the tar entry guard used to be a substring test for
  // '../', which misses names such as './..' and '..' that still resolve
  // outside of (or onto) the extraction directory. Such entries must be
  // skipped like any other traversal attempt, without failing the extraction
  // or touching anything outside the extraction directory.
  it('skips tar entries escaping the extraction directory without a "../"', async function() {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-extract-escape-'));
    const archivePath = path.join(base, 'evil-export.gz');
    const exportPath = archivePath.replace(/\.gz$/, '');
    const absoluteTarget = path.join(base, 'abs-pwned.txt');

    await makeEntriesArchive(archivePath, [
      [ { name: './..' }, 'PWNED' ],
      [ { name: '..' }, 'PWNED' ],
      [ { name: 'attachments/./../..' }, 'PWNED' ],
      [
        {
          name: '..',
          type: 'directory'
        }
      ],
      [
        {
          name: './',
          type: 'directory'
        }
      ],
      // An absolute name must never be written at the absolute location.
      [ { name: absoluteTarget }, 'PWNED' ]
    ]);

    const result = await gzipFormat.input(archivePath);
    assert.deepStrictEqual(result.docs, []);
    assert(!fs.existsSync(absoluteTarget));
    const outside = (await fsp.readdir(base))
      .filter(name => name !== path.basename(exportPath));
    assert.deepStrictEqual(outside, []);
  });

  // GHSA-97wv-p4xx-c7mg: an entry that cannot be written (here a file entry
  // colliding with a directory created by an earlier entry) must fail the
  // import with an error, not emit an unhandled 'error' event that takes the
  // whole process down.
  it('rejects rather than crashing when a tar entry cannot be written', async function() {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-extract-write-error-'));
    const archivePath = path.join(base, 'evil-export.gz');

    await makeEntriesArchive(archivePath, [
      [
        {
          name: 'collision/',
          type: 'directory'
        }
      ],
      [ { name: 'collision' }, 'PWNED' ]
    ]);

    await assert.rejects(gzipFormat.input(archivePath), { code: 'EISDIR' });
  });
});

async function makeArchive(archivePath) {
  const pack = tar.pack();
  const gzip = zlib.createGzip();
  const out = fs.createWriteStream(archivePath);

  const done = new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
    gzip.on('error', reject);
    pack.on('error', reject);
  });

  pack.pipe(gzip).pipe(out);

  pack.entry({ name: 'aposDocs.json' }, '[]');
  pack.entry({ name: 'aposAttachments.json' }, '[]');

  // Traversal payload
  pack.entry({ name: '../../zip-slip-pwned.txt' }, 'PWNED_FROM_TAR');

  pack.finalize();
  await done;
}

async function makeDirTraversalArchive(archivePath) {
  const pack = tar.pack();
  const gzip = zlib.createGzip();
  const out = fs.createWriteStream(archivePath);

  const done = new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
    gzip.on('error', reject);
    pack.on('error', reject);
  });

  pack.pipe(gzip).pipe(out);

  pack.entry({ name: 'aposDocs.json' }, '[]');
  pack.entry({ name: 'aposAttachments.json' }, '[]');

  // A DIRECTORY entry (no body) whose name contains a traversal sequence.
  pack.entry({
    name: '../evil/',
    type: 'directory'
  });

  pack.finalize();
  await done;
}

async function makeEntriesArchive(archivePath, entries) {
  const pack = tar.pack();
  const gzip = zlib.createGzip();
  const out = fs.createWriteStream(archivePath);

  const done = new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
    gzip.on('error', reject);
    pack.on('error', reject);
  });

  pack.pipe(gzip).pipe(out);

  pack.entry({ name: 'aposDocs.json' }, '[]');
  pack.entry({ name: 'aposAttachments.json' }, '[]');

  for (const [ header, body ] of entries) {
    if (body === undefined) {
      pack.entry(header);
    } else {
      pack.entry(header, body);
    }
  }

  pack.finalize();
  await done;
}
