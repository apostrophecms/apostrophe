const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const tar = require('tar-stream');
const assert = require('node:assert/strict');
const t = require('apostrophe/test-lib/util.js');
const { getAppConfig, cleanData } = require('./util/index.js');

const gzipFormat = require('../lib/formats/gzip.js');

const MiB = 1024 * 1024;

// Extracting an import archive must not write more than a bounded amount of
// data or entries, and must not leave anything behind when it fails.
describe('gzip format - extraction limits', function() {
  this.timeout(60000);

  let base;

  beforeEach(async function() {
    base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-extract-limits-'));
  });

  afterEach(async function() {
    await fsp.rm(base, {
      recursive: true,
      force: true
    });
  });

  it('stops extracting past `maxExtractedSize` and removes what was extracted', async function() {
    const archivePath = path.join(base, 'export.tar.gz');
    await makeArchive(archivePath, {
      'attachments/zeros.bin': 5 * MiB
    });

    await assert.rejects(
      gzipFormat.input(archivePath, { limits: { maxExtractedSize: MiB } }),
      /extracted size/
    );
    assert.equal(fs.existsSync(path.join(base, 'export.tar')), false);
  });

  it('stops extracting an archive that expands far beyond its own size by default', async function() {
    const archivePath = path.join(base, 'export.tar.gz');
    // Compresses about 1000 to 1
    await makeArchive(archivePath, {
      'attachments/zeros.bin': 80 * MiB
    });

    await assert.rejects(gzipFormat.input(archivePath), /extracted size/);
    assert.equal(fs.existsSync(path.join(base, 'export.tar')), false);
  });

  it('stops extracting past `maxEntries` and removes what was extracted', async function() {
    const archivePath = path.join(base, 'export.tar.gz');
    const files = {};
    for (let i = 0; i < 20; i++) {
      files[`attachments/file-${i}.txt`] = 10;
    }
    await makeArchive(archivePath, files);

    await assert.rejects(
      gzipFormat.input(archivePath, { limits: { maxEntries: 10 } }),
      /entries/
    );
    assert.equal(fs.existsSync(path.join(base, 'export.tar')), false);
  });

  it('removes the extracted files when the archive content is invalid', async function() {
    const archivePath = path.join(base, 'export.tar.gz');
    await makeArchive(archivePath, {}, { docs: '{ not json' });

    await assert.rejects(gzipFormat.input(archivePath));
    assert.equal(fs.existsSync(path.join(base, 'export.tar')), false);
  });

  it('still extracts an archive within the limits', async function() {
    const archivePath = path.join(base, 'export.tar.gz');
    await makeArchive(archivePath, {
      'attachments/zeros.bin': MiB
    });

    const { docs, exportPath } = await gzipFormat.input(archivePath, {
      limits: {
        maxExtractedSize: 2 * MiB,
        maxEntries: 10
      }
    });
    assert.deepEqual(docs, []);
    const { size } = await fsp.stat(path.join(exportPath, 'attachments/zeros.bin'));
    assert.equal(size, MiB);
  });
});

describe('#import - archive limits and cleanup', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let tempPath;
  let uploadfsPath;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig({
        '@apostrophecms/import-export': {
          options: {
            importLimits: {
              maxExtractedSize: 2 * MiB
            }
          }
        }
      })
    });
    importExportManager = apos.modules['@apostrophecms/import-export'];
    tempPath = path.join(apos.rootDir, 'data/temp/archive-limits');
    uploadfsPath = path.join(apos.rootDir, 'public/uploads/import-export');
    await fsp.mkdir(tempPath, { recursive: true });
  });

  after(async function() {
    await cleanData([ tempPath ]);
    await t.destroy(apos);
  });

  async function importArchive(name) {
    const req = apos.task.getReq({
      locale: 'en',
      body: {},
      files: {
        file: {
          path: path.join(tempPath, name),
          type: importExportManager.formats.gzip.allowedTypes[0]
        }
      }
    });
    // Failures are notified and logged, keep the output readable
    const origError = apos.util.error;
    apos.util.error = () => {};
    try {
      return await importExportManager.import(req);
    } finally {
      apos.util.error = origError;
    }
  }

  // Whatever the import left behind for this upload: the renamed upload,
  // its extraction and its copy in uploadfs
  async function leftovers(name) {
    const stem = name.replace('.tar.gz', '');
    const local = await fsp.readdir(tempPath);
    let copies = [];
    try {
      copies = await fsp.readdir(uploadfsPath);
    } catch (e) {
      // Nothing was ever copied there
    }
    return [ ...local, ...copies ].filter(file => file.includes(stem));
  }

  it('removes the upload and its extraction when the archive is invalid', async function() {
    const name = `invalid-${apos.util.generateId()}.tar.gz`;
    await makeArchive(path.join(tempPath, name), {}, { docs: '{ not json' });

    await assert.rejects(importArchive(name));
    assert.deepEqual(await leftovers(name), []);
  });

  it('enforces `importLimits` and removes the upload and its extraction', async function() {
    const name = `too-big-${apos.util.generateId()}.tar.gz`;
    await makeArchive(path.join(tempPath, name), {
      'attachments/zeros.bin': 5 * MiB
    });

    await assert.rejects(importArchive(name));
    assert.deepEqual(await leftovers(name), []);
  });

  it('still imports an archive within the limits and cleans up after it', async function() {
    const name = `valid-${apos.util.generateId()}.tar.gz`;
    await makeArchive(path.join(tempPath, name), {
      'attachments/small.bin': 1024
    });

    const result = await importArchive(name);
    assert.equal(result.duplicatedDocs.length, 0);
    assert.deepEqual(await leftovers(name), []);
  });
});

// `files` maps entry names to a size in bytes, filled with zeros
async function makeArchive(archivePath, files, { docs = '[]' } = {}) {
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

  await addEntry(pack, { name: 'aposDocs.json' }, docs);
  await addEntry(pack, { name: 'aposAttachments.json' }, '[]');
  await addEntry(pack, {
    name: 'attachments/',
    type: 'directory'
  });
  for (const [ name, size ] of Object.entries(files)) {
    await addZeros(pack, name, size);
  }

  pack.finalize();
  await done;
}

function addEntry(pack, header, content) {
  return new Promise((resolve, reject) => {
    pack.entry(header, content, error => (error ? reject(error) : resolve()));
  });
}

function addZeros(pack, name, size) {
  return new Promise((resolve, reject) => {
    const entry = pack.entry({
      name,
      size
    }, error => (error ? reject(error) : resolve()));
    const chunk = Buffer.alloc(Math.min(size, MiB));
    let remaining = size;
    const write = () => {
      while (remaining > 0) {
        const part = remaining >= chunk.length ? chunk : chunk.subarray(0, remaining);
        remaining -= part.length;
        if (!entry.write(part)) {
          entry.once('drain', write);
          return;
        }
      }
      entry.end();
    };
    write();
  });
}
