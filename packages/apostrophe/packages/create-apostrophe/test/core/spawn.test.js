import assert from 'node:assert/strict';
import { run, tail } from '../../src/core/spawn.js';

const node = process.execPath;

describe('core/spawn — tail', function () {
  it('returns short output whole, trailing whitespace trimmed', function () {
    assert.equal(tail('one\ntwo\n\n'), 'one\ntwo');
  });

  it('keeps the last N lines and says how many it dropped', function () {
    const out = tail(Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n'), 3);
    assert.equal(out, '… (7 earlier lines omitted)\nline7\nline8\nline9');
  });

  it('handles CRLF, so a Windows child reads the same as a POSIX one', function () {
    assert.equal(tail('a\r\nb\r\nc', 2), '… (1 earlier lines omitted)\nb\nc');
  });

  it('is empty for empty, whitespace, or absent output', function () {
    for (const input of [ '', '   \n\n', undefined, null ]) {
      assert.equal(tail(input), '', `input: ${JSON.stringify(input)}`);
    }
  });
});

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
