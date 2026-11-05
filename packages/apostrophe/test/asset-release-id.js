const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const childProcess = require('child_process');

// `getReleaseId` is called for every asset URL in production. Finding the
// release id from git means running a process, so that must happen once.

describe('Asset release id', function() {
  let apos;
  const vars = [ 'APOS_RELEASE_ID', 'HEROKU_RELEASE_VERSION', 'PLATFORM_TREE_ID' ];
  const saved = {};
  const { execSync } = childProcess;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({ root: module });
  });

  beforeEach(function() {
    for (const name of vars) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
    delete apos.asset.releaseIdFallback;
  });

  afterEach(function() {
    childProcess.execSync = execSync;
    for (const name of vars) {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    }
    delete apos.asset.releaseIdFallback;
  });

  after(async function() {
    return t.destroy(apos);
  });

  it('asks git for the release id only once', function() {
    let calls = 0;
    childProcess.execSync = (command, options) => {
      assert.match(command, /^git rev-parse/);
      calls++;
      return 'abc1234\n';
    };
    assert.equal(apos.asset.getReleaseId(), 'abc1234');
    assert.equal(apos.asset.getReleaseId(), 'abc1234');
    assert.equal(apos.asset.getAssetBaseUrl(), apos.asset.isProductionMode()
      ? '/apos-frontend/releases/abc1234/default'
      : '/apos-frontend/default');
    apos.asset.getReleaseId();
    assert.equal(calls, 1);
  });

  it('still lets the environment decide, every time', function() {
    childProcess.execSync = () => 'abc1234\n';
    assert.equal(apos.asset.getReleaseId(), 'abc1234');
    process.env.APOS_RELEASE_ID = 'from-env';
    assert.equal(apos.asset.getReleaseId(), 'from-env');
  });

  it('keeps throwing when there is no release id to find', function() {
    let calls = 0;
    childProcess.execSync = () => {
      calls++;
      throw new Error('not a git checkout');
    };
    assert.throws(() => apos.asset.getReleaseId(), /APOS_RELEASE_ID/);
    assert.throws(() => apos.asset.getReleaseId(), /APOS_RELEASE_ID/);
    assert.equal(calls, 2);
  });
});
