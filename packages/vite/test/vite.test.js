const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');

const getAppConfig = (modules = {}) => {
  return {
    '@apostrophecms/express': {
      options: {
        session: { secret: 'supersecret' }
      }
    },
    '@apostrophecms/vite': {
      options: {
        alias: 'vite'
      },
      before: '@apostrophecms/asset'
    },
    ...modules
  };
};

describe('@apostrophecms/vite', function () {
  let apos;

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  describe('init', function () {
    before(async function () {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        testModule: true,
        autoBuild: false,
        modules: getAppConfig()
      });
    });
    it('should have vite enabled', function () {
      const actual = {
        isViteEnabled: Object.keys(apos.modules).includes('@apostrophecms/vite'),
        buildModuleAlias: apos.asset.getBuildModuleAlias(),
        buildModuleConfigName: apos.asset.getBuildModuleConfig().name
      };

      const expected = {
        isViteEnabled: true,
        buildModuleAlias: 'vite',
        buildModuleConfigName: '@apostrophecms/vite'
      };

      assert.deepEqual(actual, expected);
    });
  });

  describe('specs', function () {
    before(async function () {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        testModule: true,
        autoBuild: false,
        modules: getAppConfig()
      });
    });

    it('should apply manifest', async function () {
      const manifest = {
        // Circular dependency with `bar.js`
        '_shared-dependency.js': {
          file: 'assets/shared-dependency.js',
          name: 'shared-dependency',
          css: [
            'assets/shared-dependency.css'
          ],
          dynamicImports: [ 'bar.js' ]
        },
        'modules/asset/images/background.png': {
          file: 'assets/background.png',
          src: 'modules/asset/images/background.png'
        },
        'baz.js': {
          file: 'assets/baz.js',
          name: 'baz',
          src: 'baz.js',
          imports: [
            '_shared-dependency.js'
          ],
          css: [
            'assets/baz.css'
          ],
          isDynamicEntry: true
        },
        // Circular dependency with `shared-dependency.js`
        'bar.js': {
          file: 'assets/bar.js',
          name: 'bar',
          src: 'bar.js',
          imports: [
            '_shared-dependency.js'
          ],
          css: [
            'assets/bar.css'
          ],
          isDynamicEntry: true
        },
        'src/apos.js': {
          file: 'apos-build.js',
          name: 'apos',
          src: 'src/apos.js',
          isEntry: true,
          css: [
            'assets/apos.css'
          ]
        },
        'src/src.js': {
          file: 'src-build.js',
          name: 'src',
          src: 'src/src.js',
          isEntry: true,
          css: [
            'assets/src.css'
          ],
          assets: [
            'assets/background.png'
          ],
          dynamicImports: [ 'baz.js' ]
        },
        'src/article.js': {
          file: 'article-build.js',
          name: 'article',
          src: 'src/article.js',
          imports: [
            '_shared-dependency.js'
          ],
          css: [
            'assets/article.css'
          ],
          isEntry: true
        },
        'src/tools.js': {
          file: 'tools-build.js',
          name: 'tools',
          src: 'src/tools.js',
          isEntry: true
        }
      };

      const entrypoints = [
        {
          name: 'src',
          type: 'index'
        },
        {
          name: 'article',
          type: 'custom'
        },
        {
          name: 'tools',
          type: 'custom'
        },
        {
          name: 'apos',
          type: 'apos'
        },
        {
          name: 'public',
          type: 'bundled'
        }
      ];

      const actual = await apos.vite.applyManifest(entrypoints, manifest);
      const expected = [
        {
          name: 'src',
          type: 'index',
          manifest: {
            root: 'dist',
            files: {
              js: [ 'src-build.js' ],
              css: [
                'assets/src.css',
                'assets/baz.css',
                'assets/shared-dependency.css',
                'assets/bar.css'
              ],
              assets: [ 'assets/background.png' ],
              imports: [],
              dynamicImports: [ 'assets/baz.js' ]
            },
            src: { js: [ 'src/src.js' ] },
            devServer: false
          }
        },
        {
          name: 'article',
          type: 'custom',
          manifest: {
            root: 'dist',
            files: {
              js: [ 'article-build.js' ],
              css: [
                'assets/article.css',
                'assets/shared-dependency.css',
                'assets/bar.css'
              ],
              assets: [],
              imports: [ 'assets/shared-dependency.js' ],
              dynamicImports: []
            },
            src: { js: [ 'src/article.js' ] },
            devServer: false
          }
        },
        {
          name: 'tools',
          type: 'custom',
          manifest: {
            root: 'dist',
            files: {
              js: [ 'tools-build.js' ],
              css: [],
              assets: [],
              imports: [],
              dynamicImports: []
            },
            src: { js: [ 'src/tools.js' ] },
            devServer: false
          }
        },
        {
          name: 'apos',
          type: 'apos',
          manifest: {
            root: 'dist',
            files: {
              js: [ 'apos-build.js' ],
              css: [ 'assets/apos.css' ],
              assets: [],
              imports: [],
              dynamicImports: []
            },
            src: { js: [ 'src/apos.js' ] },
            devServer: false
          }
        },
        {
          name: 'public',
          type: 'bundled'
        }
      ];

      assert.deepEqual(actual, expected);
    });

    describe('isHostnameAllowed', function () {
      it('should allow localhost by default', function () {
        assert(apos.vite.isHostnameAllowed('localhost', undefined));
        assert(apos.vite.isHostnameAllowed('localhost:3000', undefined));
      });

      it('should allow 127.0.0.1 by default', function () {
        assert(apos.vite.isHostnameAllowed('127.0.0.1', undefined));
        assert(apos.vite.isHostnameAllowed('127.0.0.1:3000', undefined));
      });

      it('should allow ::1 (IPv6) by default', function () {
        assert(apos.vite.isHostnameAllowed('[::1]:3000', undefined));
      });

      it('should reject custom hostname by default', function () {
        assert(!apos.vite.isHostnameAllowed('example.com', undefined));
        assert(!apos.vite.isHostnameAllowed('example.com:3000', undefined));
      });

      it('should allow exact match in allowedHosts', function () {
        assert(apos.vite.isHostnameAllowed('example.com', [ 'example.com' ]));
        assert(apos.vite.isHostnameAllowed('example.com:3000', [ 'example.com' ]));
      });

      it('should support wildcard patterns', function () {
        assert(apos.vite.isHostnameAllowed('sub.example.com', [ '.example.com' ]));
        assert(apos.vite.isHostnameAllowed('example.com', [ '.example.com' ]));
        assert(!apos.vite.isHostnameAllowed('notexample.com', [ '.example.com' ]));
      });

      it('should allow all when allowedHosts is true', function () {
        assert(apos.vite.isHostnameAllowed('anything.com', true));
        assert(apos.vite.isHostnameAllowed('192.168.1.1', true));
      });

      it('should handle IPv6 with port in brackets', function () {
        assert(apos.vite.isHostnameAllowed('[::1]:3000', [ '::1' ]));
        assert(apos.vite.isHostnameAllowed('[2001:db8::1]:3000', [ '2001:db8::1' ]));
      });

      it('should handle IPv6 without port', function () {
        assert(apos.vite.isHostnameAllowed('[::1]', [ '::1' ]));
        assert(apos.vite.isHostnameAllowed('[2001:db8::1]', [ '2001:db8::1' ]));
      });

      it('should return true for empty hostname', function () {
        assert(apos.vite.isHostnameAllowed('', undefined));
        assert(apos.vite.isHostnameAllowed(null, undefined));
      });

      it('should check multiple allowed hosts', function () {
        const allowed = [ 'example.com', 'test.local', 'localhost' ];
        assert(apos.vite.isHostnameAllowed('example.com', allowed));
        assert(apos.vite.isHostnameAllowed('test.local', allowed));
        assert(apos.vite.isHostnameAllowed('localhost', allowed));
        assert(!apos.vite.isHostnameAllowed('notallowed.com', allowed));
      });

      it('should handle credentials in hostname', function () {
        assert(apos.vite.isHostnameAllowed('user:pass@localhost', undefined));
        assert(apos.vite.isHostnameAllowed('user:pass@localhost:3000', undefined));
        assert(apos.vite.isHostnameAllowed('user:pass@example.com', [ 'example.com' ]));
        assert(apos.vite.isHostnameAllowed('user:pass@[::1]:3000', undefined));
        assert(apos.vite.isHostnameAllowed('user:pass@[2001:db8::1]:3000', [ '2001:db8::1' ]));
      });
    });
  });

  describe('Build', function () {
    before(async function () {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        testModule: true,
        autoBuild: false,
        modules: getAppConfig(getBuildModules())
      });
    });
    it('should copy source files and generate entrypoints', async function () {
      const build = async () => {
        await apos.vite.reset();
        apos.vite.currentSourceMeta = await apos.vite
          .computeSourceMeta({ copyFiles: true });
        const entrypoints = apos.asset.getBuildEntrypoints();
        await apos.vite.createImports(entrypoints);
      };
      await build();
      const rootDirSrc = apos.vite.buildRootSource;
      const meta = apos.vite.currentSourceMeta;

      const aposStat = await fs.stat(path.join(rootDirSrc, 'apos.js'));
      const srcStat = await fs.stat(path.join(rootDirSrc, 'src.js'));

      assert.ok(aposStat.isFile());
      assert.ok(srcStat.isFile());

      // Assert meta entries
      const coreModule = '@apostrophecms/admin-bar';
      const coreModuleOverride = '@apostrophecms/my-admin-bar';
      const aposContent = await fs.readFile(path.join(rootDirSrc, 'apos.js'), 'utf8');
      const srcContent = await fs.readFile(path.join(rootDirSrc, 'src.js'), 'utf8');

      {
        const entry = meta.find((entry) => entry.id === coreModule);
        assert.ok(entry);
        assert.ok(entry.files.includes('src/index.js'));
        assert.ok(entry.files.includes('apos/components/TheAposAdminBar.vue'));
        assert.ok(entry.files.includes('apos/apps/AposAdminBar.js'));
      }

      {
        const entry = meta.find((entry) => entry.id === coreModuleOverride);
        assert.ok(entry);
        assert.ok(entry.files.includes('src/index.js'));
        assert.ok(entry.files.includes('apos/apps/AposAdminBar.js'));
      }

      // I. Test sources overrides
      // 1. from the core admin-bar module
      const adminBarAppContent = await fs.readFile(
        path.join(rootDirSrc, coreModule, 'apos', 'apps', 'AposAdminBar.js'),
        'utf8'
      );
      // 2. from the core admin-bar module
      const adminBarSrcContent = await fs.readFile(
        path.join(rootDirSrc, coreModule, 'src', 'index.js'),
        'utf8'
      );
      // 3. from the admin-bar-component module
      const adminBarComponentContent = await fs.readFile(
        path.join(rootDirSrc, 'admin-bar-component', 'apos', 'components', 'TheAposAdminBar.vue'),
        'utf8'
      );
      assert.match(adminBarAppContent, /console\.log\('AposAdminBar\.js'\);/);
      assert.match(adminBarSrcContent, /console\.log\('src\/index\.js'\);/);
      assert.match(adminBarComponentContent, /<h1>The Apos Admin Bar<\/h1>/);

      // II. Core Entrypoints
      if (process.platform === 'win32') {
        // 1. src.js
        {
          const match = srcContent.match(/"[^"]+\/@apostrophecms\/admin-bar\/ui\/src\/index.js";/g);
          assert.equal(match?.length, 1, 'The core admin-bar module should be imported once');
        }
        // 2. apos.js
        {
          const match = aposContent.match(
            /import TheAposAdminBar from "[^"]+\/admin-bar-component\/apos\/components\/TheAposAdminBar\.vue";/g
          );
          assert.equal(match?.length, 1, 'TheAposAdminBar.vue component override should be imported once');
        }
        {
          const match = aposContent.match(
            /window\.apos\.vueComponents\["TheAposAdminBar"\] = TheAposAdminBar;/g
          );
          assert.equal(match?.length, 1, 'TheAposAdminBar.vue component should be registered once');
        }
        {
          const match = aposContent.match(
            /import AposAdminBar_[\w\d]+ from "[^"]+\/@apostrophecms\/admin-bar\/ui\/apos\/apps\/AposAdminBar\.js";/g
          );
          assert.equal(match?.length, 1, 'AposAdminBar.js App import should be present once');
        }
        {
          const match = aposContent.match(
            /AposAdminBar_[\d]+App\(\);/g
          );
          assert.equal(match?.length, 1, 'AposAdminBar.js App should be called once');
        }
        assert.match(
          aposContent,
          /import AposCommandMenuKey from "[^"]+\/@apostrophecms\/command-menu\/ui\/apos\/components\/AposCommandMenuKey\.vue";/
        );
        assert.match(
          aposContent,
          /import Link from "[^"]+\/@apostrophecms\/rich-text-widget\/ui\/apos\/tiptap-extensions\/Link\.js";/
        );
      } else {
        {
          const match = srcContent.match(/".\/@apostrophecms\/admin-bar\/src\/index.js";/g);
          assert.equal(match?.length, 1, 'The core admin-bar module should be imported once');
        }
        {
          const match = aposContent.match(
            /import TheAposAdminBar from ".\/admin-bar-component\/apos\/components\/TheAposAdminBar\.vue";/g
          );
          assert.equal(match?.length, 1, 'TheAposAdminBar.vue component override should be imported once');
        }
        {
          const match = aposContent.match(
            /window\.apos\.vueComponents\["TheAposAdminBar"\] = TheAposAdminBar;/g
          );
          assert.equal(match?.length, 1, 'TheAposAdminBar.vue component should be registered once');
        }
        {
          const match = aposContent.match(
            /import AposAdminBar_[\w\d]+ from ".\/@apostrophecms\/admin-bar\/apos\/apps\/AposAdminBar\.js";/g
          );
          assert.equal(match?.length, 1, 'AposAdminBar.js App import should be present once');
        }
        {
          const match = aposContent.match(
            /AposAdminBar_[\d]+App\(\);/g
          );
          assert.equal(match?.length, 1, 'AposAdminBar.js App should be called once');
        }
        assert.match(
          aposContent,
          /import AposCommandMenuKey from ".\/@apostrophecms\/command-menu\/apos\/components\/AposCommandMenuKey\.vue";/
        );
        assert.match(
          aposContent,
          /import Link from ".\/@apostrophecms\/rich-text-widget\/apos\/tiptap-extensions\/Link\.js";/
        );
      }
      // III. Extra Build Entrypoints & Rebundle Modules
      const articleEntryContent = await fs.readFile(
        path.join(rootDirSrc, 'article.js'),
        'utf8'
      );

      if (process.platform === 'win32') {
        assert(articleEntryContent.includes('article-page/ui/src/main.scss'));
        assert(articleEntryContent.includes('article-page/ui/src/index.js'));
        assert(articleEntryContent.includes('article-page/ui/src/main.js'));
        const toolsEntryContent = await fs.readFile(
          path.join(rootDirSrc, 'tools.js'),
          'utf8'
        );
        assert(toolsEntryContent.includes('selected-article-widget/ui/src/tabs.js'));
        {
          const match = srcContent.match(
            /import topic_\d+App from "[^"]+\/@apostrophecms\/home-page\/ui\/src\/topic\.js";/g
          );
          assert.equal(match?.length, 1, 'home-page topic.js should be imported once');
        }
        {
          const match = srcContent.match(
            /import main_\d+App from "[^"]+\/@apostrophecms\/home-page\/ui\/src\/main\.js";/g
          );
          assert.equal(match?.length, 1, 'home-page main.js should be imported once');
        }
        {
          const match = srcContent.match(
            /import topic_\d+App from "[^"]+\/article-widget\/ui\/src\/topic\.js";/g
          );
          assert.equal(match?.length, 1, 'article-widget topic.js should be imported once');
        }
        {
          const match = srcContent.match(
            /import carousel_\d+App from "[^"]+\/article-widget\/ui\/src\/carousel\.js";/g
          );
          assert.equal(match?.length, 1, 'article-widget carousel.js should be imported once');
        }
      } else {
        assert(articleEntryContent.includes('article-page/src/main.scss'));
        assert(articleEntryContent.includes('article-page/src/index.js'));
        assert(articleEntryContent.includes('article-page/src/main.js'));
        const toolsEntryContent = await fs.readFile(
          path.join(rootDirSrc, 'tools.js'),
          'utf8'
        );
        assert(toolsEntryContent.includes('selected-article-widget/src/tabs.js'));
        {
          const match = srcContent.match(
            /import topic_\d+App from ".\/@apostrophecms\/home-page\/src\/topic\.js";/g
          );
          assert.equal(match?.length, 1, 'home-page topic.js should be imported once');
        }
        {
          const match = srcContent.match(
            /import main_\d+App from ".\/@apostrophecms\/home-page\/src\/main\.js";/g
          );
          assert.equal(match?.length, 1, 'home-page main.js should be imported once');
        }
        {
          const match = srcContent.match(
            /import topic_\d+App from ".\/article-widget\/src\/topic\.js";/g
          );
          assert.equal(match?.length, 1, 'article-widget topic.js should be imported once');
        }
        {
          const match = srcContent.match(
            /import carousel_\d+App from ".\/article-widget\/src\/carousel\.js";/g
          );
          assert.equal(match?.length, 1, 'article-widget carousel.js should be imported once');
        }
      }
    });

    it('should copy public bundled assets', async function () {
      const build = async () => {
        await apos.vite.reset();
        apos.vite.currentSourceMeta = await apos.vite
          .computeSourceMeta({ copyFiles: true });
        const entrypoints = apos.asset.getBuildEntrypoints();
        await apos.vite.createImports(entrypoints);
      };
      const rootDir = apos.vite.buildRoot;

      await build();

      {
        const stat = await fs.stat(path.join(rootDir, 'public.js'));
        const content = await fs.readFile(path.join(rootDir, 'public.js'), 'utf8');

        const expected = 'console.log(\'public/article.js\');console.log(\'public/nested/article.js\');';
        const actual = content.replace(/\s/g, '');

        assert.ok(stat.isFile());
        assert.equal(actual, expected, 'unexpected public.js content');
      }

      {
        const stat = await fs.stat(path.join(rootDir, 'public.css'));
        const content = await fs.readFile(path.join(rootDir, 'public.css'), 'utf8');

        const expected = '.article-main{margin:0;}.article-nested-main{margin:0;}';
        const actual = content.replace(/\s/g, '');

        assert.ok(stat.isFile());
        assert.equal(actual, expected, 'unexpected public.css content');
      }
    });

    it('should build', async function () {
      await apos.vite.reset();
      await apos.task.invoke('@apostrophecms/asset:build', {
        'check-apos-build': false
      });

      const bundleDir = apos.asset.getBundleRootDir();
      assert.ok(fs.existsSync(path.join(bundleDir, '.manifest.json')));
      assert.ok(fs.existsSync(path.join(bundleDir, 'apos-bundle.css')));
      assert.ok(fs.existsSync(path.join(bundleDir, 'apos-module-bundle.js')));
      assert.ok(fs.existsSync(path.join(bundleDir, 'apos-public-module-bundle.js')));
      assert.ok(fs.existsSync(path.join(bundleDir, 'apos-src-module-bundle.js')));
      assert.ok(fs.existsSync(path.join(bundleDir, 'article-module-bundle.js')));
      assert.ok(fs.existsSync(path.join(bundleDir, 'public-module-bundle.js')));
      assert.ok(fs.existsSync(path.join(bundleDir, 'public-src-module-bundle.js')));
      assert.ok(fs.existsSync(path.join(bundleDir, 'tools-module-bundle.js')));
    });
  });
});

function getBuildModules(assetOptions = {}) {
  return {
    '@apostrophecms/asset': {
      options: {
        rebundleModules: {
          'article-page': 'article',
          'article-widget': 'main',
          'selected-article-widget:tabs': 'tools',
          '@apostrophecms/my-home-page:main': 'main'
        },
        ...assetOptions
      }
    },
    'admin-bar-component': {},
    '@apostrophecms/home-page': {
      build: {
        vite: {
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
      build: {
        vite: {
          bundles: {
            main: {}
          }
        }
      }
    },
    'article-widget': {
      build: {
        vite: {
          bundles: {
            topic: {},
            carousel: {}
          }
        }
      }
    },
    'selected-article-widget': {
      build: {
        vite: {
          bundles: {
            tabs: {}
          }
        }
      }
    }
  };
}
