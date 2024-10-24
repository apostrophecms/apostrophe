const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('fs-extra');
const t = require('../test-lib/test.js');

describe('Asset - External Build', function () {
  let apos;
  const publicPath = path.join(process.cwd(), 'test/public');
  const publicBuildPath = path.join(publicPath, 'apos-frontend');

  this.timeout(t.timeout);

  after(async function () {
    // await fs.remove(publicBuildPath);
    await t.destroy(apos);
  });

  beforeEach(async function () {
    // await fs.remove(publicBuildPath);
  });

  it('should register external build module', async function () {
    let actualInit;
    let actualBuilt = false;
    let actualDevServer;

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
                    devServer: true,
                    hmr: true
                  });
                }
              }
            };
          },
          methods(self) {
            return {
              async build() {
                actualBuilt = true;
                return {
                  entrypoints: []
                };
              },
              async watch() { },
              startDevServer() {
                actualDevServer = true;
                return {
                  entrypoints: []
                };
              }
            };
          }
        }
      }
    });

    assert.ok(apos.asset.buildWatcher);
    assert.equal(actualInit, true);
    assert.equal(actualBuilt, false);
    assert.equal(actualDevServer, true);
    assert.equal(apos.asset.hasBuildModule(), true);
    assert.equal(apos.asset.getBuildModuleAlias(), 'vite');
    assert.deepEqual(apos.asset.getBuildModuleConfig(), {
      name: 'asset-vite',
      alias: 'vite',
      devServer: true,
      hmr: true
    });
    assert.equal(apos.asset.getBuildModule().__meta.name, 'asset-vite');
    // Webpack build wasn't triggered
    assert.throws(() => fs.readdirSync(path.join(publicBuildPath, 'default/apos-module-bundle.js')), {
      code: 'ENOENT'
    });
  });

  it('should support `build` configuration per module (BC)', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/asset': {
          options: {
            rebundleModules: {
              'article-page': 'article',
              'article-widget': 'main',
              'selected-article-widget:tabs': 'tools',
              '@apostrophecms/my-home-page:main': 'main'
            }
          }
        },
        webpack: {
          before: '@apostrophecms/asset',
          init() {},
          handlers(self) {
            return {
              '@apostrophecms/asset:afterInit': {
                async registerExternalBuild() {
                  self.apos.asset.configureBuildModule(self, {
                    alias: 'webpack',
                    hasDevServer: true,
                    hasHMR: true
                  });
                }
              }
            };
          },
          methods(self) {
            return {
              async build() {}
            };
          }
        },
        '@apostrophecms/home-page': {
          webpack: {
            bundles: {
              topic: {},
              main: {}
            }
          },
          build: {
            webpack: {
              bundles: {
                topic: {},
                main: {}
              }
            }
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          init() {}
        },
        'article-page': {
          webpack: {
            bundles: {
              main: {}
            },
            extensions: {
              topic: {
                resolve: {
                  alias: {
                    Utils: path.join(process.cwd(), 'lib/utils/')
                  }
                }
              },
              ext1 ({ mode, alias = {} }) {
                return {
                  mode,
                  resolve: {
                    alias: {
                      ext1: 'ext1-path',
                      ...alias
                    }
                  }
                };
              }
            },
            extensionOptions: {
              ext1: {
                mode: 'production'
              }
            }
          },
          build: {
            webpack: {
              bundles: {
                main: {}
              },
              // Here only to demonstrate that it's BC,
              // this is ignored by the new Vite build module
              extensions: {
                topic: {
                  resolve: {
                    alias: {
                      Utils: path.join(process.cwd(), 'lib/utils/')
                    }
                  }
                },
                ext1 ({ mode, alias = {} }) {
                  return {
                    mode,
                    resolve: {
                      alias: {
                        ext1: 'ext1-path',
                        ...alias
                      }
                    }
                  };
                }
              },
              extensionOptions: {
                ext1: {
                  mode: 'production'
                }
              }
            }
          }
        },
        'article-widget': {
          webpack: {
            bundles: {
              topic: {},
              carousel: {}
            }
          },
          build: {
            webpack: {
              bundles: {
                topic: {},
                carousel: {}
              }
            }
          }
        },
        'selected-article-widget': {
          webpack: {
            bundles: {
              tabs: {}
            }
          },
          build: {
            webpack: {
              bundles: {
                tabs: {}
              }
            }
          }
        }
      }
    });

    const actual = apos.asset.moduleBuildExtensions.webpack;
    const expected = {};
    await apos.asset.setWebpackExtensions(expected);

    assert.deepEqual(
      actual,
      expected,
      '`build` configuration is not identical to the legacy `webpack` configuration'
    );
  });
});
