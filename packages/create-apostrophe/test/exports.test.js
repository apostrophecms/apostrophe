import assert from 'node:assert/strict';

// Uses package self-referencing (Node resolves the package by its own name via
// the "exports" map from within the package), so this verifies the published
// surface independently of node_modules layout.

async function importByName(spec) {
  return import(spec);
}

describe('public exports map', function () {
  it('resolves the public entry point', async function () {
    const mod = await importByName('create-apostrophe');
    assert.ok(mod, 'create-apostrophe should resolve to src/index.js');
  });

  it('exposes exactly { createProject, runCli } at the public surface', async function () {
    const mod = await importByName('create-apostrophe');
    const names = Object.keys(mod).sort();
    assert.deepEqual(names, [ 'createProject', 'runCli' ]);
    assert.equal(typeof mod.createProject, 'function');
    assert.equal(typeof mod.runCli, 'function');
  });

  for (const sub of [
    'create-apostrophe/src/core/store.js',
    'create-apostrophe/src/ui/flow.js',
    'create-apostrophe/src/telemetry/index.js',
    'create-apostrophe/src/index.js',
    'create-apostrophe/package.json'
  ]) {
    it(`blocks private subpath: ${sub}`, async function () {
      await assert.rejects(
        () => importByName(sub),
        err => err.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
        `expected ${sub} to be hidden by the exports map`
      );
    });
  }
});
