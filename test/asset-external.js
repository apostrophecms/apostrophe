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
    await fs.remove(publicBuildPath);
    await t.destroy(apos);
  });

  beforeEach(async function () {
    await fs.remove(publicBuildPath);
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
              async startDevServer() {
                actualDevServer = true;
                return {
                  entrypoints: []
                };
              },
              async entrypoints() {
                return [];
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
              async build() { },
              async watch() { },
              async startDevServer() {},
              async entrypoints() {
                return [];
              }
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

  it('should inject custom bundles dynamic CSS (PRO-6904)', async function () {
    await t.destroy(apos);

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        'asset-vite': {
          before: '@apostrophecms/asset',
          handlers(self) {
            return {
              '@apostrophecms/asset:afterInit': {
                async registerExternalBuild() {
                  self.apos.asset.configureBuildModule(self, {
                    alias: 'vite',
                    devServer: false,
                    hmr: false
                  });
                }
              }
            };
          },
          methods(self) {
            return {
              async build() {
                return {
                  entrypoints: []
                };
              },
              async watch() { },
              async startDevServer() {
                return {
                  entrypoints: []
                };
              },
              async entrypoints() {
                return [];
              }
            };
          }
        }
      }
    });

    // Mock the build manifest
    apos.asset.currentBuildManifest = {
      sourceMapsRoot: null,
      devServerUrl: null,
      hmrTypes: [],
      entrypoints: [
        {
          name: 'src',
          type: 'index',
          scenes: [ 'apos', 'public' ],
          outputs: [ 'css', 'js' ],
          condition: 'module',
          manifest: {
            root: 'dist',
            name: 'src',
            devServer: false
          },
          bundles: [
            'apos-src-module-bundle.js',
            'apos-bundle.css',
            'public-src-module-bundle.js',
            'public-bundle.css'
          ]
        },
        {
          name: 'counter-react',
          type: 'custom',
          scenes: [ 'counter-react' ],
          outputs: [ 'css', 'js' ],
          condition: 'module',
          prologue: '',
          ignoreSources: [],
          manifest: {
            root: 'dist',
            name: 'counter-react',
            devServer: false
          },
          bundles: [ 'counter-react-module-bundle.js' ]
        },
        {
          name: 'counter-svelte',
          type: 'custom',
          scenes: [ 'counter-svelte' ],
          outputs: [ 'css', 'js' ],
          condition: 'module',
          manifest: {
            root: 'dist',
            name: 'counter-svelte',
            devServer: false
          },
          bundles: [
            'counter-svelte-module-bundle.js',
            'counter-svelte-bundle.css'
          ]
        },
        {
          name: 'counter-vue',
          type: 'custom',
          scenes: [ 'counter-vue' ],
          outputs: [ 'css', 'js' ],
          condition: 'module',
          manifest: {
            root: 'dist',
            name: 'counter-vue',
            devServer: false
          },
          bundles: [ 'counter-vue-module-bundle.js', 'counter-vue-bundle.css' ]
        },
        {
          name: 'apos',
          type: 'apos',
          scenes: [ 'apos' ],
          outputs: [ 'js' ],
          condition: 'module',
          manifest: {
            root: 'dist',
            name: 'apos',
            devServer: false
          },
          bundles: [ 'apos-module-bundle.js', 'apos-bundle.css' ]
        }
      ]
    };

    // `counter-svelte` has `ui/src/counter-svelte.scss`.
    // `counter-vue` doesn't have any CSS but has dynamic CSS, extracted
    // from Vue components.
    apos.asset.extraBundles = {
      js: [ 'counter-react', 'counter-svelte', 'counter-vue' ],
      css: [ 'counter-svelte ' ]
    };
    apos.asset.rebundleModules = [];

    const payload = {
      page: {
        type: '@apostrophecms/home-page'
      },
      scene: 'apos',
      template: '@apostrophecms/home-page:page',
      content: '[stylesheets-placeholder:1]\n[scripts-placeholder:1]',
      scriptsPlaceholder: '[scripts-placeholder:1]',
      stylesheetsPlaceholder: '[stylesheets-placeholder:1]',
      widgetsBundles: { 'counter-vue': {} }
    };

    const injected = apos.template.insertBundlesMarkup(payload);

    // All bundles are injected, including the dynamic CSS from `counter-vue`
    const actual = injected.replace(/>\s+</g, '><');
    const expected = '<link rel="stylesheet" href="/apos-frontend/default/apos-bundle.css">' +
      '<link rel="stylesheet" href="/apos-frontend/default/counter-svelte-bundle.css">' +
      '<link rel="stylesheet" href="/apos-frontend/default/counter-vue-bundle.css">' +
      '<script type="module" src="/apos-frontend/default/apos-src-module-bundle.js"></script>' +
      '<script type="module" src="/apos-frontend/default/apos-module-bundle.js"></script>' +
      '<script type="module" src="/apos-frontend/default/counter-react-module-bundle.js"></script>' +
      '<script type="module" src="/apos-frontend/default/counter-svelte-module-bundle.js"></script>' +
      '<script type="module" src="/apos-frontend/default/counter-vue-module-bundle.js"></script>';

    assert.equal(actual, expected, 'Bundles are not injected correctly');

    const injectedPublic = apos.template.insertBundlesMarkup({
      ...payload,
      scene: 'public'
    });

    // Showcases that the only the dynamic Vue CSS is injected, because the widget
    // owning the bundle counter-vue is present.
    const actualPublic = injectedPublic.replace(/>\s+</g, '><');
    const expectedPublic = '<link rel="stylesheet" href="/apos-frontend/default/public-bundle.css">' +
      '<link rel="stylesheet" href="/apos-frontend/default/counter-vue-bundle.css">' +
      '<script type="module" src="/apos-frontend/default/public-src-module-bundle.js"></script>' +
      '<script type="module" src="/apos-frontend/default/counter-vue-module-bundle.js"></script>';

    assert.equal(actualPublic, expectedPublic, 'Bundles are not injected correctly');

  });
});
