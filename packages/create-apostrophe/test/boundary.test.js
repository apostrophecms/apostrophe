import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd });

// A path the boundary override matches (src/core/**/*.js). The file need not
// exist on disk — lintText uses filePath only to resolve the config.
const probe = fileURLToPath(new URL('../src/core/__probe__.js', import.meta.url));

const importFrom = spec => `import x from ${JSON.stringify(spec)};\nexport { x };\n`;

async function ruleHits(code) {
  const [ result ] = await eslint.lintText(code, { filePath: probe });
  return result.messages.filter(m => m.ruleId === 'no-restricted-imports');
}

describe('UI/logic boundary (eslint no-restricted-imports)', function () {
  it('flags an import from ui/ inside core/', async function () {
    const hits = await ruleHits(importFrom('../ui/render.js'));
    assert.equal(hits.length, 1, 'expected the boundary rule to fire');
  });

  it('flags a deeper ui/ import too', async function () {
    const hits = await ruleHits(importFrom('../../src/ui/flow.js'));
    assert.equal(hits.length, 1);
  });

  it('allows a non-ui import', async function () {
    const hits = await ruleHits(importFrom('node:fs/promises'));
    assert.equal(hits.length, 0, 'non-ui imports must not trip the boundary rule');
  });
});
