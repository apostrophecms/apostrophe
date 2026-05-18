import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/create-apostrophe.js', import.meta.url));

// Phase 0 skeleton smoke test. Real contract/exports/boundary suites land in
// later steps & phases; this exists so `mocha` has a file to run and the
// placeholder bin is exercised (exits 0).
describe('skeleton', function () {
  it('public entry point is importable', async function () {
    await import('../src/index.js');
  });

  it('placeholder bin runs and exits 0', function () {
    const out = execFileSync(process.execPath, [ bin ], { encoding: 'utf8' });
    assert.match(out, /skeleton placeholder/);
  });
});
