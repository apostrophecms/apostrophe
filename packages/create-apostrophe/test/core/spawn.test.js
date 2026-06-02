import assert from 'node:assert/strict';
import { run } from '../../src/core/spawn.js';

const node = process.execPath;

describe('core/spawn', function () {
  it('captures stdout and a zero exit code', async function () {
    const r = await run(node, [ '-e', 'process.stdout.write("hi")' ]);
    assert.equal(r.code, 0);
    assert.equal(r.stdout, 'hi');
    assert.equal(r.error, null);
  });

  it('reports a non-zero exit code without throwing', async function () {
    const r = await run(node, [ '-e', 'process.exit(3)' ]);
    assert.equal(r.code, 3);
    assert.equal(r.error, null);
  });

  it('returns an ENOENT error (not a throw) for a missing binary', async function () {
    const r = await run('definitely-not-a-real-binary-xyz', [ 'arg' ]);
    assert.equal(r.code, null);
    assert.equal(r.error?.code, 'ENOENT');
  });

  it('does not run a shell: metacharacter args are inert literals', async function () {
    // If a shell were involved, `; echo pwned` would execute. With
    // shell:false it is a single, literal argv entry echoed back unchanged.
    const evil = '; echo pwned > /tmp/ca-pwned';
    const r = await run(node, [ '-e', 'process.stdout.write(process.argv[1])', evil ]);
    assert.equal(r.code, 0);
    assert.equal(r.stdout, evil);
  });

  it('writes provided input to stdin', async function () {
    const r = await run(
      node,
      [ '-e', 'process.stdin.on("data", d => process.stdout.write("got:" + d))' ],
      { input: 'secret\n' }
    );
    assert.equal(r.code, 0);
    assert.equal(r.stdout, 'got:secret\n');
  });
});
