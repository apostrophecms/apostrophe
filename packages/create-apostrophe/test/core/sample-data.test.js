import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import dbConnect from '@apostrophecms/db-connect';
import {
  importSampleData, resolveAssets, DEFAULT_ASSETS
} from '../../src/core/steps/sample-data.js';
import { StageError } from '../../src/core/errors.js';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// A fetch stub that serves fixed bytes (or simulates a network/HTTP failure).
function stubFetch(bytes, {
  ok = true, status = 200, throws = false
} = {}) {
  return async () => {
    if (throws) {
      throw new Error('ENOTFOUND static.apostrophecms.com');
    }
    return {
      ok,
      status,
      headers: {
        get: (k) => (k.toLowerCase() === 'content-length' ? String(bytes.length) : null)
      },
      body: Readable.from([ Buffer.from(bytes) ])
    };
  };
}

function writeManifest(appRoot, obj) {
  mkdirSync(join(appRoot, '.apostrophe'), { recursive: true });
  writeFileSync(
    join(appRoot, '.apostrophe', 'sample-data.json'),
    typeof obj === 'string' ? obj : JSON.stringify(obj)
  );
}

describe('core/steps/sample-data — resolveAssets', function () {
  let appRoot;
  beforeEach(function () {
    appRoot = mkdtempSync(join(tmpdir(), 'ca-seed-'));
  });
  afterEach(function () {
    rmSync(appRoot, {
      recursive: true,
      force: true
    });
  });

  it('no manifest → embedded DEFAULT_ASSETS (both)', function () {
    assert.deepEqual(resolveAssets(appRoot), { ...DEFAULT_ASSETS });
  });

  it('manifest wholesale-replaces; each asset optional (db only)', function () {
    const db = {
      url: 'https://x/db.zip',
      sha256: 'a'.repeat(64)
    };
    writeManifest(appRoot, { db });
    assert.deepEqual(resolveAssets(appRoot), { db });
  });

  it('manifest with both assets', function () {
    const m = {
      db: {
        url: 'https://x/db.zip',
        sha256: 'a'.repeat(64)
      },
      uploads: {
        url: 'https://x/up.zip',
        sha256: 'b'.repeat(64)
      }
    };
    writeManifest(appRoot, m);
    assert.deepEqual(resolveAssets(appRoot), m);
  });

  /** @type {Array<[string, any]>} */
  const invalidCases = [
    [ 'unparseable JSON', '{ not json' ],
    [ 'not an object', '"a string"' ],
    [ 'an array', '[]' ],
    [ 'declares neither asset', {} ],
    [ 'declares neither asset (unknown keys)', { foo: 1 } ],
    [ 'bad sha length', {
      db: {
        url: 'https://x/db.zip',
        sha256: 'abc'
      }
    } ],
    [ 'uppercase sha', {
      db: {
        url: 'https://x/db.zip',
        sha256: 'A'.repeat(64)
      }
    } ],
    [ 'non-https url', {
      db: {
        url: 'http://x/db.zip',
        sha256: 'a'.repeat(64)
      }
    } ],
    [ 'missing sha', { db: { url: 'https://x/db.zip' } } ]
  ];
  for (const [ label, body ] of invalidCases) {
    it(`seed_manifest_invalid: ${label}`, function () {
      writeManifest(appRoot, body);
      assert.throws(
        () => resolveAssets(appRoot),
        (err) => err instanceof StageError &&
          err.stage === 'sample_data' &&
          err.errorCode === 'seed_manifest_invalid'
      );
    });
  }
});

describe('core/steps/sample-data — download + checksum', function () {
  let appRoot;
  const DB_BYTES = Buffer.from('pretend-zip-bytes');
  const dbManifest = (sha) => ({
    db: {
      url: 'https://x/db.zip',
      sha256: sha
    }
  });

  // Inject no-op DB ops so these tests isolate the download/verify stage.
  const noopDbDeps = {
    resolveDbUri: () => 'sqlite:///tmp/x.sqlite',
    restore: async () => {},
    unpackDbStream: async () => Readable.from('')
  };

  beforeEach(function () {
    appRoot = mkdtempSync(join(tmpdir(), 'ca-seed-'));
  });
  afterEach(function () {
    rmSync(appRoot, {
      recursive: true,
      force: true
    });
  });

  it('matching sha256 passes verification', async function () {
    writeManifest(appRoot, dbManifest(sha256(DB_BYTES)));
    await importSampleData(
      {
        appRoot,
        dbChoice: 'sqlite',
        shortName: 'site'
      },
      {
        ...noopDbDeps,
        fetchImpl: stubFetch(DB_BYTES)
      }
    );
    // No throw == verified.
  });

  it('mismatched sha256 → seed_checksum_failed (before any DB write)', async function () {
    writeManifest(appRoot, dbManifest('f'.repeat(64)));
    let restored = false;
    await assert.rejects(
      () => importSampleData(
        {
          appRoot,
          dbChoice: 'sqlite',
          shortName: 'site'
        },
        {
          ...noopDbDeps,
          restore: async () => {
            restored = true;
          },
          fetchImpl: stubFetch(DB_BYTES)
        }
      ),
      (err) => err instanceof StageError && err.errorCode === 'seed_checksum_failed'
    );
    assert.equal(restored, false, 'must not write to the DB when the checksum fails');
  });

  it('non-2xx response → seed_download_failed', async function () {
    writeManifest(appRoot, dbManifest(sha256(DB_BYTES)));
    await assert.rejects(
      () => importSampleData(
        {
          appRoot,
          dbChoice: 'sqlite',
          shortName: 'site'
        },
        {
          ...noopDbDeps,
          fetchImpl: stubFetch(DB_BYTES, {
            ok: false,
            status: 404
          })
        }
      ),
      (err) => err instanceof StageError && err.errorCode === 'seed_download_failed'
    );
  });

  it('network error → seed_download_failed', async function () {
    writeManifest(appRoot, dbManifest(sha256(DB_BYTES)));
    await assert.rejects(
      () => importSampleData(
        {
          appRoot,
          dbChoice: 'sqlite',
          shortName: 'site'
        },
        {
          ...noopDbDeps,
          fetchImpl: stubFetch(DB_BYTES, { throws: true })
        }
      ),
      (err) => err instanceof StageError && err.errorCode === 'seed_download_failed'
    );
  });
});

describe('core/steps/sample-data — error mapping (stubbed unpack/restore/uploads)', function () {
  let appRoot;
  const BYTES = Buffer.from('zip');

  beforeEach(function () {
    appRoot = mkdtempSync(join(tmpdir(), 'ca-seed-'));
  });
  afterEach(function () {
    rmSync(appRoot, {
      recursive: true,
      force: true
    });
  });

  function deps(over = {}) {
    return {
      fetchImpl: stubFetch(BYTES),
      resolveDbUri: () => 'sqlite:///tmp/x.sqlite',
      restore: async () => {},
      unpackDbStream: async () => Readable.from('{"_collection":"x","_indexes":[]}\n'),
      extractAttachments: async () => {},
      ...over
    };
  }

  it('unpack failure → seed_unpack_failed', async function () {
    writeManifest(appRoot, {
      db: {
        url: 'https://x/db.zip',
        sha256: sha256(BYTES)
      }
    });
    await assert.rejects(
      () => importSampleData({
        appRoot,
        dbChoice: 'sqlite',
        shortName: 'site'
      }, deps({
        unpackDbStream: async () => {
          throw new Error('garbled zip');
        }
      })),
      (err) => err instanceof StageError && err.errorCode === 'seed_unpack_failed'
    );
  });

  it('restore failure → seed_restore_failed', async function () {
    writeManifest(appRoot, {
      db: {
        url: 'https://x/db.zip',
        sha256: sha256(BYTES)
      }
    });
    await assert.rejects(
      () => importSampleData({
        appRoot,
        dbChoice: 'sqlite',
        shortName: 'site'
      }, deps({
        restore: async () => {
          throw new Error('restore boom');
        }
      })),
      (err) => err instanceof StageError && err.errorCode === 'seed_restore_failed'
    );
  });

  it('uploads failure → seed_uploads_failed', async function () {
    writeManifest(appRoot, {
      uploads: {
        url: 'https://x/up.zip',
        sha256: sha256(BYTES)
      }
    });
    await assert.rejects(
      () => importSampleData({
        appRoot,
        dbChoice: 'sqlite',
        shortName: 'site'
      }, deps({
        extractAttachments: async () => {
          throw new Error('extract boom');
        }
      })),
      (err) => err instanceof StageError && err.errorCode === 'seed_uploads_failed'
    );
  });

  it('restores the dump (no pre-drop — restore self-clears its collections)', async function () {
    writeManifest(appRoot, {
      db: {
        url: 'https://x/db.zip',
        sha256: sha256(BYTES)
      }
    });
    let restoredUri;
    await importSampleData({
      appRoot,
      dbChoice: 'sqlite',
      shortName: 'site'
    }, deps({
      resolveDbUri: () => 'sqlite:///tmp/site.sqlite',
      restore: async (uri) => {
        restoredUri = uri;
      }
    }));
    assert.equal(restoredUri, 'sqlite:///tmp/site.sqlite');
  });

  it('uploads target is <appRoot>/public/uploads (with the downloaded file)', async function () {
    writeManifest(appRoot, {
      uploads: {
        url: 'https://x/up.zip',
        sha256: sha256(BYTES)
      }
    });
    let seenRoot;
    let seenZip;
    await importSampleData({
      appRoot,
      dbChoice: 'sqlite',
      shortName: 'site'
    }, deps({
      extractAttachments: async (zipPath, uploadsRoot) => {
        seenZip = zipPath;
        seenRoot = uploadsRoot;
      }
    }));
    assert.equal(seenRoot, join(appRoot, 'public', 'uploads'));
    assert.match(seenZip, /uploads\.zip$/);
  });
});

describe('core/steps/sample-data — db restore into a real sqlite (no network/zip)', function () {
  let appRoot;
  const JSONL = [
    '{"_collection":"articles","_indexes":[]}',
    '{"_doc":{"_id":"a1","title":"Hello"}}',
    '{"_doc":{"_id":"a2","title":"World"}}'
  ].join('\n');
  const BYTES = Buffer.from('db-zip-bytes');

  beforeEach(function () {
    appRoot = mkdtempSync(join(tmpdir(), 'ca-seed-'));
  });
  afterEach(function () {
    rmSync(appRoot, {
      recursive: true,
      force: true
    });
  });

  it('downloads (stubbed), restores via the real db module, reads back', async function () {
    writeManifest(appRoot, {
      db: {
        url: 'https://x/db.zip',
        sha256: sha256(BYTES)
      }
    });
    // Real resolveDbUri/restore (default deps); only fetch and the unzip are
    // stubbed — the latter yields the JSONL the real restore consumes.
    await importSampleData(
      {
        appRoot,
        dbChoice: 'sqlite',
        shortName: 'site'
      },
      {
        fetchImpl: stubFetch(BYTES),
        unpackDbStream: async () => Readable.from(JSONL)
      }
    );

    const uri = `sqlite://${resolve(appRoot, 'data', 'site.sqlite')}`;
    assert.ok(existsSync(resolve(appRoot, 'data', 'site.sqlite')));
    const client = await dbConnect(uri);
    try {
      const docs = await client.db().collection('articles').find({}).toArray();
      assert.deepEqual(docs.map((d) => d.title).sort(), [ 'Hello', 'World' ]);
    } finally {
      await client.close();
    }
  });
});
