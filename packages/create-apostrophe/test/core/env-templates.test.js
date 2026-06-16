import assert from 'node:assert/strict';
import {
  standaloneEnv, externalBackendEnv, externalFrontendEnv, SECRET_KEYS
} from '../../src/core/env-templates.js';

describe('core/env-templates', function () {
  it('SECRET_KEYS is the frozen provisional set', function () {
    assert.deepEqual([ ...SECRET_KEYS ], [
      'APOS_SESSION_SECRET',
      'APOS_UPLOADFS_DISABLED_FILE_KEY'
    ]);
  });

  it('standalone template has empty secret slots, no front key', function () {
    const t = standaloneEnv();
    for (const k of SECRET_KEYS) {
      assert.match(t, new RegExp(`^${k}=$`, 'm'), `${k} slot present and empty`);
    }
    assert.match(t, /gitignored/);
    assert.doesNotMatch(t, /APOS_EXTERNAL_FRONT_KEY/);
  });

  it('externalBackendEnv(name) adds dev keys + secret slots, labels by name', function () {
    const t = externalBackendEnv('astro');
    assert.match(t, /^APOS_EXTERNAL_FRONT_KEY=dev$/m);
    assert.match(t, /^APOS_DEV=1$/m);
    assert.match(t, /Astro backend/); // name titled into the header
    for (const k of SECRET_KEYS) {
      assert.match(t, new RegExp(`^${k}=$`, 'm'));
    }
  });

  it('externalFrontendEnv(name) is just the matching front key, no secrets', function () {
    const t = externalFrontendEnv('astro');
    assert.match(t, /^APOS_EXTERNAL_FRONT_KEY=dev$/m);
    assert.match(t, /Astro frontend/);
    for (const k of SECRET_KEYS) {
      assert.doesNotMatch(t, new RegExp(k));
    }
  });

  it('templates are frontend-name parametrized (works for a future name)', function () {
    assert.match(externalBackendEnv('nextjs'), /Nextjs backend/);
    assert.match(externalFrontendEnv('nextjs'), /Nextjs frontend/);
  });
});
