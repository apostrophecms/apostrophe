const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('fs-extra');
const t = require('../test-lib/test.js');

describe('Asset - External Build', function () {
  let apos;
  const publicPath = path.join(process.cwd(), 'test/public');
  const releasePath = path.join(publicPath, 'apos-frontend');

  this.timeout(t.timeout);

  after(async function () {
    await fs.remove(releasePath);
    await t.destroy(apos);
  });

  beforeEach(async function () {
    await fs.remove(releasePath);
  });

  it('should register external build module', async function () {
    let actualInit;
    let actualBuilt;

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        'asset-vite': {
          before: '@apostrophecms/asset',
          init(self) {
            actualInit = true;
          },
          handlers(self) {
            return {
              '@apostrophecms/asset:afterInit': {
                async registerExternalBuild() {
                  self.apos.asset.configureBuildModule(self, {
                    alias: 'vite',
                    hasDevServer: true,
                    hasHMR: true
                  });
                }
              }
            };
          },
          methods(self) {
            return {
              async build() {
                actualBuilt = true;
              }
            };
          }
        }
      }
    });

    assert.equal(apos.asset.buildWatcher, null);
    assert.equal(actualInit, true);
    assert.equal(actualBuilt, true);
    assert.equal(apos.asset.hasBuildModule(), true);
    assert.equal(apos.asset.getBuildModuleAlias(), 'vite');
    assert.deepEqual(apos.asset.getBuildModuleConfig(), {
      name: 'asset-vite',
      alias: 'vite',
      hasDevServer: true,
      hasHMR: true
    });
    assert.equal(apos.asset.getBuildModule().__meta.name, 'asset-vite');
    // Webpack build wasn't triggered
    assert.throws(() => fs.readdirSync(releasePath), {
      code: 'ENOENT'
    });
  });
});
