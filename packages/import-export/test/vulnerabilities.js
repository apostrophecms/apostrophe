const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const tar = require('tar-stream');
const assert = require('assert');

const gzipFormat = require('../lib/formats/gzip.js');

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
