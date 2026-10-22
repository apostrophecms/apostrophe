// Step: seed a freshly scaffolded project with the kit's sample database dump
// and uploaded images. Runs only for kits with `seedData: true` (the
// `*-demo-data` variants): resolve the asset set → download + checksum-verify →
// restore the DB → copy attachments.
//
// Security: no shell — node:fs only; downloads are verified against an embedded
// (or kit-supplied) sha256 before any DB write; zip entries are zip-slip guarded.

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { StageError } from '../errors.js';
import {
  resolveDbUri as realResolveDbUri,
  restore as realRestore,
  clearDatabase as realClearDatabase
} from '../db.js';

const STAGE = 'sample_data';

/** No-op task handle for headless callers that don't render progress. */
const NOOP_TASK = Object.freeze({
  succeed() {},
  fail() {},
  progress() {}
});

/**
 * Settle a task (succeed/fail) around `fn`, re-throwing on failure so the
 * error still propagates.
 *
 * @template T
 * @param {import('../../index.js').TaskHandle} task
 * @param {(task: import('../../index.js').TaskHandle) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function runTask(task, fn) {
  try {
    const out = await fn(task);
    task.succeed();
    return out;
  } catch (err) {
    task.fail();
    throw err;
  }
}

/**
 * Embedded, npm-signed default assets (computed 2026-05-22 from the validated
 * `public-demo` archives). A cloned kit may wholesale-replace these via
 * {@link resolveAssets}; verification is always on, so a tampered CDN can't
 * substitute bytes.
 */
export const DEFAULT_ASSETS = Object.freeze({
  db: {
    url: 'https://static.apostrophecms.com/public-demo/starter-database.jsonl.zip',
    sha256: '862fc4b380675e0eaade8447f6a137807ce54b54acbbee79636e581e0c5f29b1'
  },
  uploads: {
    url: 'https://static.apostrophecms.com/public-demo/starter-uploads.zip',
    sha256: 'b1a70f3372f8c897fd934abbe711cc1a8b0aeaf7d38b165890dd96939ab62f58'
  }
});

const ASSET_KEYS = [ 'db', 'uploads' ];
const SHA256_RE = /^[0-9a-f]{64}$/;
const MANIFEST_REL = path.join('.apostrophe', 'sample-data.json');

/**
 * Downloads the uploads archive (progress bar) then imports everything
 * (spinner): the DB wipe+restore and the uploads extract. A db-only manifest
 * shows only the import task. Downloads are verified before any DB write.
 *
 * @param {{
 *   appRoot: string,
 *   dbChoice: import('../../index.js').DbChoice,
 *   dbUri?: string,
 *   shortName: string
 * }} opts
 * @param {{
 *   task?: (label: string, opts?: { progress?: boolean })
 *     => import('../../index.js').TaskHandle,
 *   fetchImpl?: typeof globalThis.fetch,
 *   resolveDbUri?: typeof realResolveDbUri,
 *   restore?: typeof realRestore,
 *   clearDatabase?: typeof realClearDatabase,
 *   unpackDbStream?: (zipPath: string) => Promise<Readable>,
 *   extractAttachments?: (zipPath: string, uploadsRoot: string) => Promise<void>
 * }} [deps]
 * @returns {Promise<void>}
 * @throws {StageError} stage 'sample_data' on any seed failure.
 */
export async function importSampleData(
  {
    appRoot, dbChoice, dbUri, shortName
  },
  {
    task = () => NOOP_TASK,
    fetchImpl = globalThis.fetch,
    resolveDbUri = realResolveDbUri,
    restore = realRestore,
    clearDatabase = realClearDatabase,
    unpackDbStream = defaultUnpackDbStream,
    extractAttachments = defaultExtractAttachments
  } = {}
) {
  const assets = resolveAssets(appRoot);

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'apos-seed-'));
  try {
    const files = {};

    if (assets.uploads) {
      files.uploads = path.join(tmpDir, 'uploads.zip');
      await runTask(
        task('Downloading sample content', { progress: true }),
        (t) => downloadAndVerify(
          fetchImpl, assets.uploads, files.uploads, (f) => t.progress?.(f)
        )
      );
    }

    await runTask(task('Importing sample content'), async () => {
      if (assets.db) {
        files.db = path.join(tmpDir, 'database.zip');
        await downloadAndVerify(fetchImpl, assets.db, files.db);
        const uri = resolveDbUri({
          dbChoice,
          dbUri,
          appRoot,
          shortName
        });
        try {
          await clearDatabase(uri);
        } catch (err) {
          throw new StageError(STAGE, {
            code: 'seed_clear_failed',
            cause: err
          });
        }
        let stream;
        try {
          stream = await unpackDbStream(files.db);
        } catch (err) {
          throw new StageError(STAGE, {
            code: 'seed_unpack_failed',
            cause: err
          });
        }
        try {
          await restore(uri, stream);
        } catch (err) {
          throw new StageError(STAGE, {
            code: 'seed_restore_failed',
            cause: err
          });
        }
      }
      if (assets.uploads) {
        const uploadsRoot = path.join(appRoot, 'public', 'uploads');
        try {
          await extractAttachments(files.uploads, uploadsRoot);
        } catch (err) {
          throw new StageError(STAGE, {
            code: 'seed_uploads_failed',
            cause: err
          });
        }
      }
    });
  } finally {
    await fsp.rm(tmpDir, {
      recursive: true,
      force: true
    });
  }
}

/**
 * Resolve which assets to seed. With no kit manifest the embedded
 * {@link DEFAULT_ASSETS} are used; a kit's
 * `<appRoot>/.apostrophe/sample-data.json` **wholesale-replaces** them
 * (defaults not consulted), each asset optional. A malformed, mis-shaped, or
 * empty manifest is a kit misconfiguration.
 *
 * @param {string} appRoot
 * @returns {{
 *   db?: { url: string, sha256: string },
 *   uploads?: { url: string, sha256: string }
 * }}
 * @throws {StageError} stage 'sample_data', code 'seed_manifest_invalid'.
 */
export function resolveAssets(appRoot) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(appRoot, MANIFEST_REL), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { ...DEFAULT_ASSETS };
    }
    throw manifestInvalid(err);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw manifestInvalid(err);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw manifestInvalid(new Error('manifest is not a JSON object'));
  }

  /** @type {Record<string, { url: string, sha256: string }>} */
  const resolved = {};
  for (const key of ASSET_KEYS) {
    if (parsed[key] === undefined) {
      continue;
    }
    if (!isValidAsset(parsed[key])) {
      throw manifestInvalid(
        new Error(`manifest "${key}" is not a valid { url, sha256 } pair`)
      );
    }
    resolved[key] = {
      url: parsed[key].url,
      sha256: parsed[key].sha256
    };
  }
  if (Object.keys(resolved).length === 0) {
    throw manifestInvalid(new Error('manifest declares neither "db" nor "uploads"'));
  }
  return resolved;
}

/**
 * A declared asset must be `{ url: <https>, sha256: <64-hex-lowercase> }`.
 * @param {unknown} a
 * @returns {boolean}
 */
function isValidAsset(a) {
  if (!a || typeof a !== 'object') {
    return false;
  }
  const { url, sha256 } = /** @type {{ url?: unknown, sha256?: unknown }} */ (a);
  if (typeof url !== 'string' || typeof sha256 !== 'string') {
    return false;
  }
  if (!SHA256_RE.test(sha256)) {
    return false;
  }
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** @param {Error} cause */
function manifestInvalid(cause) {
  return new StageError(STAGE, {
    code: 'seed_manifest_invalid',
    cause
  });
}

/**
 * Stream a download to disk, teeing through a sha256 hash. The file is only
 * accepted if the digest matches `asset.sha256` — a mismatch aborts before
 * any DB write.
 *
 * @param {typeof globalThis.fetch} fetchImpl
 * @param {{ url: string, sha256: string }} asset
 * @param {string} destPath
 * @param {((fraction: number) => void)} [onProgress]
 * @returns {Promise<void>}
 * @throws {StageError} 'seed_download_failed' / 'seed_checksum_failed'.
 */
async function downloadAndVerify(fetchImpl, asset, destPath, onProgress) {
  let res;
  try {
    res = await fetchImpl(asset.url);
  } catch (err) {
    throw new StageError(STAGE, {
      code: 'seed_download_failed',
      cause: err
    });
  }
  if (!res || !res.ok) {
    throw new StageError(STAGE, {
      code: 'seed_download_failed',
      cause: new Error(`unexpected response ${res ? res.status : '?'} for ${asset.url}`)
    });
  }

  const total = Number(res.headers.get('content-length')) || 0;
  const hash = crypto.createHash('sha256');
  let loaded = 0;
  let lastPct = -1;

  try {
    await pipeline(
      toNodeReadable(res.body),
      async function * tee(source) {
        for await (const chunk of source) {
          hash.update(chunk);
          loaded += chunk.length;
          if (total && onProgress) {
            const pct = Math.floor((loaded / total) * 100);
            if (pct !== lastPct) {
              lastPct = pct;
              onProgress(loaded / total);
            }
          }
          yield chunk;
        }
      },
      fs.createWriteStream(destPath)
    );
  } catch (err) {
    throw new StageError(STAGE, {
      code: 'seed_download_failed',
      cause: err
    });
  }

  if (hash.digest('hex') !== asset.sha256) {
    throw new StageError(STAGE, {
      code: 'seed_checksum_failed',
      cause: new Error(`sha256 mismatch for ${asset.url}`)
    });
  }
}

/**
 * fetch bodies are WHATWG streams; tests may inject a Node Readable directly.
 * @param {any} body
 * @returns {Readable}
 */
function toNodeReadable(body) {
  if (body && typeof body.pipe === 'function') {
    return body;
  }
  return Readable.fromWeb(body);
}

/**
 * Open the single `.jsonl` entry of the DB zip as a readable stream, closing
 * the archive once the stream is consumed. The dump is db-connect's own
 * restore format (flat, one file entry).
 *
 * @param {string} zipPath
 * @returns {Promise<Readable>}
 */
function defaultUnpackDbStream(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) {
        reject(err);
        return;
      }
      let found = false;
      zip.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) {
          zip.readEntry();
          return;
        }
        found = true;
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr) {
            zip.close();
            reject(streamErr);
            return;
          }
          stream.once('end', () => zip.close());
          stream.once('error', () => zip.close());
          resolve(stream);
        });
      });
      zip.once('error', reject);
      zip.once('end', () => {
        if (!found) {
          zip.close();
          reject(new Error('database archive contains no file entry'));
        }
      });
      zip.readEntry();
    });
  });
}

/**
 * Extract the uploads archive — which holds the attachment files directly,
 * at its root — into `<uploadsRoot>/attachments/`. Directory entries and
 * zip-slip-escaping entries are skipped.
 *
 * @param {string} zipPath
 * @param {string} uploadsRoot  `<appRoot>/public/uploads`
 * @returns {Promise<void>}
 */
function defaultExtractAttachments(zipPath, uploadsRoot) {
  const attachmentsRoot = path.join(uploadsRoot, 'attachments');
  return new Promise((resolve, reject) => {
    // autoClose:false — we collect all entries first, then open their read
    // streams; the default would close the file on the last entry. extractAll
    // closes it when done.
    yauzl.open(zipPath, {
      lazyEntries: true,
      autoClose: false
    }, (err, zip) => {
      if (err) {
        reject(err);
        return;
      }
      /** @type {Array<{ entry: any, dest: string }>} */
      const entries = [];
      zip.on('entry', (entry) => {
        const name = entry.fileName;
        const dest = name.endsWith('/')
          ? null
          : safeJoin(attachmentsRoot, name);
        if (dest) {
          entries.push({
            entry,
            dest
          });
        }
        zip.readEntry();
      });
      zip.once('error', reject);
      zip.once('end', () => {
        extractAll(zip, entries).then(resolve, reject);
      });
      zip.readEntry();
    });
  });
}

/**
 * @param {any} zip
 * @param {Array<{ entry: any, dest: string }>} entries
 */
async function extractAll(zip, entries) {
  try {
    for (const { entry, dest } of entries) {
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      const stream = await openEntry(zip, entry);
      await pipeline(stream, fs.createWriteStream(dest));
    }
  } finally {
    zip.close();
  }
}

/**
 * @param {any} zip
 * @param {any} entry
 * @returns {Promise<Readable>}
 */
function openEntry(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(stream);
    });
  });
}

/**
 * Join an archive entry path under `root`, returning `null` if the resolved
 * destination escapes `root` (zip-slip: `..` segments or absolute paths).
 *
 * @param {string} root
 * @param {string} name
 * @returns {string | null}
 */
function safeJoin(root, name) {
  const dest = path.resolve(root, name);
  if (dest !== root && !dest.startsWith(root + path.sep)) {
    return null;
  }
  return dest;
}
