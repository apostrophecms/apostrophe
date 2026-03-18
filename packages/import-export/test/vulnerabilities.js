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
