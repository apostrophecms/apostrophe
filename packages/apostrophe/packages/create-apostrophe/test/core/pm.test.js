import assert from 'node:assert/strict';
import {
  detectPackageManager,
  assertSupportedPackageManager,
  SUPPORTED_PACKAGE_MANAGERS
} from '../../src/core/pm.js';
import { UnsupportedPackageManagerError } from '../../src/core/errors.js';

describe('core/pm', function () {
  it('detects the manager from the user-agent first token', function () {
    assert.equal(detectPackageManager('npm/9.8.1 node/v20.5.0 linux x64'), 'npm');
    assert.equal(detectPackageManager('pnpm/8.6.0 npm/? node/v20'), 'pnpm');
    assert.equal(detectPackageManager('yarn/1.22.19 npm/? node/v20'), 'yarn');
  });

  it('is unknown for empty / unrecognized agents', function () {
    assert.equal(detectPackageManager(''), 'unknown');
    assert.equal(detectPackageManager('bun/1.0.0 node/v20'), 'unknown');
  });

  it('assertSupportedPackageManager: npm/unknown pass, others throw', function () {
    assert.equal(assertSupportedPackageManager('npm'), 'npm');
    assert.equal(assertSupportedPackageManager('unknown'), 'unknown');
    for (const pm of [ 'pnpm', 'yarn', 'bun' ]) {
      assert.throws(
        () => assertSupportedPackageManager(pm),
        (err) => {
          assert.ok(err instanceof UnsupportedPackageManagerError);
          assert.equal(err.packageManager, pm);
          // error carries the single-source list, no hardcoded copy
          assert.equal(err.supported, SUPPORTED_PACKAGE_MANAGERS);
          assert.equal(err.errorCode, 'unsupported_pm');
          assert.doesNotMatch(err.message, /npm only|supports/);
          return true;
        }
      );
    }
  });

  it('with no arg, reads npm_config_user_agent', function () {
    const saved = process.env.npm_config_user_agent;
    try {
      process.env.npm_config_user_agent = 'yarn/3.0.0 node/v20';
      assert.equal(detectPackageManager(), 'yarn');
      delete process.env.npm_config_user_agent;
      assert.equal(detectPackageManager(), 'unknown');
    } finally {
      if (saved === undefined) {
        delete process.env.npm_config_user_agent;
      } else {
        process.env.npm_config_user_agent = saved;
      }
    }
  });
});
