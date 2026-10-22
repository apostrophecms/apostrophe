import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/create-apostrophe.js', import.meta.url));
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
);

describe('bin smoke', function () {
  it('public entry point is importable', async function () {
    await import('../src/index.js');
  });

  it('--version prints the package version and exits 0', function () {
    const out = execFileSync(process.execPath, [ bin, '--version' ], { encoding: 'utf8' });
    assert.equal(out.trim(), pkg.version);
  });

  it('--help prints usage and exits 0', function () {
    const out = execFileSync(process.execPath, [ bin, '--help' ], { encoding: 'utf8' });
    assert.match(out, /Usage:/);
    assert.match(out, /telemetry/);
  });
});
