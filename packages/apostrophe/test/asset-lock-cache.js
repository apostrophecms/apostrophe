const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('node:path');

// The build skip logic used to rely on the lock file modified time, which is
// unreliable (fresh checkouts, restored CI/Docker build artifacts, clock
// skew). When the lock file content changed but its mtime was not newer than a
// leftover build, the admin UI build was skipped and a stale bundle served.
// These tests cover the content-hash based detection that forces a rebuild and
// clears the bundler caches on a lock file change.
describe('Assets - lock file cache invalidation', function() {
  this.timeout(5 * 60 * 1000);

  let apos;
  const lockPath = path.join(process.cwd(), 'test/package-lock.json');
  let lockSnapshot;

  before(async function() {
    lockSnapshot = await fs.readFile(lockPath, 'utf8');
    apos = await t.create({
      root: module,
      modules: {}
    });
  });

  after(async function() {
    await fs.writeFile(lockPath, lockSnapshot);
    await fs.remove(apos.asset.getLockFileHashPath());
    await t.destroy(apos);
  });

  afterEach(async function() {
    // Restore the lock file after any test that mutated it.
    await fs.writeFile(lockPath, lockSnapshot);
  });

  function mutateLock(key) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock[key] = (lock[key] || 0) + 1;
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf8');
  }

  it('hashes the lock file content, stable across reads', async function() {
    const hash = await apos.asset.getLockFileHash();
    assert(typeof hash === 'string' && hash.length > 0);
    assert.strictEqual(await apos.asset.getLockFileHash(), hash);
  });

  it('produces a different hash when the lock content changes', async function() {
    const before = await apos.asset.getLockFileHash();
    mutateLock('__test');
    const after = await apos.asset.getLockFileHash();
    assert.notStrictEqual(before, after);
  });

  it('round-trips the saved lock file hash', async function() {
    await apos.asset.saveLockFileHash('abc123');
    assert.strictEqual(await apos.asset.readSavedLockFileHash(), 'abc123');
    await apos.asset.saveLockFileHash(null);
    assert.strictEqual(await apos.asset.readSavedLockFileHash(), null);
  });

  it('reports no change when the saved hash matches', async function() {
    await apos.asset.saveLockFileHash(await apos.asset.getLockFileHash());
    const changed = await apos.asset.checkLockFileChanged(
      await apos.asset.getLockFileHash()
    );
    assert.strictEqual(changed, false);
  });

  it('reports a change when content differs', async function() {
    await apos.asset.saveLockFileHash('a-different-old-hash');
    const changed = await apos.asset.checkLockFileChanged(
      await apos.asset.getLockFileHash()
    );
    assert.strictEqual(changed, true);
  });

  it('treats a first build (no saved hash) as a change', async function() {
    await apos.asset.saveLockFileHash(null);
    const changed = await apos.asset.checkLockFileChanged(
      await apos.asset.getLockFileHash()
    );
    assert.strictEqual(changed, true);
  });

  it('forces a rebuild when content changed but the lock mtime is older', async function() {
    const tsFile = path.join(
      apos.asset.getBundleRootDir(), 'apos-build-timestamp.txt'
    );

    // Cold build: establishes the bundle, its timestamp and the saved hash.
    await apos.asset.tasks.build.task({ 'check-apos-build': false });
    const ts1 = parseInt(await fs.readFile(tsFile, 'utf8'), 10);
    assert.strictEqual(
      await apos.asset.readSavedLockFileHash(),
      await apos.asset.getLockFileHash()
    );

    // Dependency change: the lock content changes, but its mtime is OLDER than
    // the freshly built artifacts (fresh checkout / restored build cache).
    mutateLock('__test2');
    const older = new Date(Date.now() - 5 * 60 * 1000);
    await fs.utimes(lockPath, older, older);

    // The auto build (skip path) must not skip - it should rebuild.
    await apos.asset.tasks.build.task({ 'check-apos-build': true });
    const ts2 = parseInt(await fs.readFile(tsFile, 'utf8'), 10);

    assert(ts2 > ts1, `expected a rebuild (ts2=${ts2} > ts1=${ts1})`);
    assert.strictEqual(
      await apos.asset.readSavedLockFileHash(),
      await apos.asset.getLockFileHash()
    );
  });
});

// The webpack file system cache is keyed on the lock file content, but an
// external build module (e.g. @apostrophecms/vite) keeps a cache that is not,
// so it must be cleared explicitly when the lock file changes.
describe('Assets - build module cache cleared on lock change', function() {
  this.timeout(t.timeout);

  let apos;
  let clearCalls = 0;

  before(async function() {
    apos = await t.create({
      root: module,
      autoBuild: false,
      modules: {
        'asset-vite-mock': {
          before: '@apostrophecms/asset',
          handlers(self) {
            return {
              '@apostrophecms/asset:afterInit': {
                async registerExternalBuild() {
                  self.apos.asset.configureBuildModule(self, {
                    alias: 'vite',
                    devServer: false,
                    hmr: false
                  });
                }
              }
            };
          },
          methods(self) {
            return {
              async build() {
                return { entrypoints: [] };
              },
              async watch() {},
              async startDevServer() {
                return { entrypoints: [] };
              },
              async entrypoints() {
                return [];
              },
              async clearCache() {
                clearCalls++;
              }
            };
          }
        }
      }
    });
  });

  after(async function() {
    await fs.remove(apos.asset.getLockFileHashPath());
    await t.destroy(apos);
  });

  it('clears the build module cache when the lock content changes', async function() {
    await apos.asset.saveLockFileHash('an-old-hash');
    clearCalls = 0;
    const changed = await apos.asset.checkLockFileChanged(
      await apos.asset.getLockFileHash()
    );
    assert.strictEqual(changed, true);
    assert.strictEqual(clearCalls, 1);
  });

  it('leaves the build module cache alone when the lock is unchanged', async function() {
    await apos.asset.saveLockFileHash(await apos.asset.getLockFileHash());
    clearCalls = 0;
    const changed = await apos.asset.checkLockFileChanged(
      await apos.asset.getLockFileHash()
    );
    assert.strictEqual(changed, false);
    assert.strictEqual(clearCalls, 0);
  });

  it('forces a rebuild but keeps the cache when no lock file is found', async function() {
    await apos.asset.saveLockFileHash('an-old-hash');
    clearCalls = 0;
    // null hash => no lock file present
    const changed = await apos.asset.checkLockFileChanged(null);
    assert.strictEqual(changed, true);
    assert.strictEqual(clearCalls, 0);
  });
});
