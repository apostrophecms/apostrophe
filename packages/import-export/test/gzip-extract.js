const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { Writable } = require('node:stream');
const tar = require('tar-stream');
const assert = require('assert');

const gzipFormat = require('../lib/formats/gzip.js');

// How long the stubbed write streams hold their bytes back before they land on
// disk. Only needs to be long enough that a read racing ahead of the write
// cannot possibly win by accident; a missing-file read resolves in microseconds.
const WRITE_LAG_MS = 120;

describe('gzip format — extraction completeness', function() {
  this.timeout(15000);

  // `extract()` advanced the tar walk (and resolved) on each source entry's
  // `end` event, which fires when the entry has been read *out of the archive*,
  // not when the extracted bytes have been written to disk. `input()` then read
  // aposDocs.json immediately, so a slow write lost the race and surfaced as an
  // intermittent ENOENT (or a truncated read) in the ecosystem CI job — never
  // locally, where the write always won.
  //
  // Rather than hope for the race, the write streams are stubbed with ones that
  // deliberately land their bytes late. That turns the timing bug into a
  // deterministic pass/fail: gating on the read end fails every time, gating on
  // the write end passes every time.
  it('resolves only once extracted files are fully written to disk', async function() {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-extract-race-'));
    const archivePath = path.join(base, 'export.tar.gz');

    const docs = buildDocs(25);
    await makeArchive(archivePath, docs);

    const result = await withLaggingWrites(base, WRITE_LAG_MS, () => {
      return gzipFormat.input(archivePath);
    });

    // A truncated read would fail to parse or come back short, so asserting on
    // the full payload covers both halves of the race.
    assert.strictEqual(result.docs.length, docs.length);
    assert.deepStrictEqual(
      result.docs.map(doc => doc._id),
      docs.map(doc => doc._id)
    );
  });

  // The early return treated "the directory is there" as "extraction finished",
  // but the directory is created before a single entry is written. An import
  // interrupted midway therefore left a directory that every later attempt
  // accepted as complete, so the missing docs could never be recovered by
  // retrying.
  it('re-extracts when a previous extraction left the directory incomplete', async function() {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-extract-partial-'));
    const archivePath = path.join(base, 'export.tar.gz');
    const exportPath = path.join(base, 'export.tar');

    const docs = buildDocs(3);
    await makeArchive(archivePath, docs);

    // Stand in for an extraction that died after mkdir but before the entries
    // were written.
    await fsp.mkdir(exportPath);

    const result = await gzipFormat.input(archivePath);

    assert.strictEqual(result.docs.length, docs.length);
  });

  // A completed extraction must still be reused rather than redone: the
  // overrideLocale branch of `import()` calls `input()` a second time on the
  // same archive and depends on the already-extracted directory.
  it('reuses a completed extraction instead of re-extracting', async function() {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-extract-reuse-'));
    const archivePath = path.join(base, 'export.tar.gz');
    const exportPath = path.join(base, 'export.tar');

    const docs = buildDocs(3);
    await makeArchive(archivePath, docs);

    const first = await gzipFormat.input(archivePath);
    assert.strictEqual(first.docs.length, docs.length);

    // input() removes the archive after extracting, so a second call can only
    // succeed by reusing what is already on disk. Mark the extracted docs so a
    // silent re-extraction would be visible.
    const docsPath = path.join(exportPath, 'aposDocs.json');
    const marked = JSON.parse(await fsp.readFile(docsPath, 'utf8'));
    marked[0].title = 'reused-not-reextracted';
    await fsp.writeFile(docsPath, JSON.stringify(marked));

    const second = await gzipFormat.input(archivePath);

    assert.strictEqual(second.docs[0].title, 'reused-not-reextracted');
  });
});

// Run `fn` with `fs`'s write-stream constructors swapped for ones that buffer
// their bytes and only write the file `delayMs` later, so any consumer that
// looks at the file before the write finishes sees no file at all. Paths
// outside `dir` are left on the real implementation.
async function withLaggingWrites(dir, delayMs, fn) {
  const realCreateWriteStream = fs.createWriteStream;
  const realWriteStream = fs.WriteStream;

  const lagging = (filePath, ...rest) => {
    if (typeof filePath !== 'string' || !path.resolve(filePath).startsWith(path.resolve(dir))) {
      return realCreateWriteStream.call(fs, filePath, ...rest);
    }
    const chunks = [];
    return new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
      final(callback) {
        setTimeout(() => {
          fsp
            .writeFile(filePath, Buffer.concat(chunks))
            .then(() => callback())
            .catch(callback);
        }, delayMs);
      }
    });
  };

  fs.createWriteStream = lagging;
  fs.WriteStream = lagging;

  try {
    return await fn();
  } finally {
    fs.createWriteStream = realCreateWriteStream;
    fs.WriteStream = realWriteStream;
  }
}

function buildDocs(count) {
  return Array.from({ length: count }, (item, index) => ({
    _id: `doc-${index}`,
    title: `Doc ${index}`,
    type: 'topic',
    // Padding so the payload is big enough to span multiple stream chunks.
    description: 'x'.repeat(2048)
  }));
}

async function makeArchive(archivePath, docs) {
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

  pack.entry({ name: 'aposDocs.json' }, JSON.stringify(docs));
  pack.entry({ name: 'aposAttachments.json' }, '[]');
  pack.entry({
    name: 'attachments/',
    type: 'directory'
  });

  pack.finalize();
  await done;
}
