const t = require('../test-lib/test.js');
const assert = require('assert').strict;
const fs = require('fs-extra');
const path = require('path');
const Promise = require('bluebird');

const {
  checkModulesWebpackConfig,
  getWebpackExtensions,
  fillExtraBundles
} = require('../modules/@apostrophecms/asset/lib/webpack/utils');

let apos;

const badModules = {
  badModuleConfig: {
    options: {
      ignoreNoCodeWarning: true
    },
    webpack: {
      badprop: {}
    }
  },
  badModuleConfig2: {
    options: {
      ignoreNoCodeWarning: true
    },
    webpack: []
  }
};

const pagesToInsert = (homeId) => ([
  {
    _id: 'parent:en:published',
    aposLocale: 'en:published',
    metaType: 'doc',
    aposDocId: 'parent',
    type: 'bundle-page',
    slug: '/bundle',
    visibility: 'public',
    path: `${homeId.replace(':en:published', '')}/bundle`,
    level: 1,
    rank: 0,
    main: {
      _id: 'areaId',
      metaType: 'area',
      items: [
        {
          _id: 'widgetId',
          metaType: 'widget',
          type: 'bundle'
        }
      ]
    }
  },
  {
    _id: 'child:en:published',
    title: 'Bundle',
    aposLocale: 'en:published',
    metaType: 'doc',
    aposDocId: 'child',
    type: 'bundle',
    slug: 'child',
    visibility: 'public'
  }
]);

const modules = {
  '@apostrophecms/page': {
    options: {
      park: [],
      types: [
        {
          name: 'bundle-page',
          label: 'Bundle Page'
        }
      ]
    }
  },
  bundle: {},
  'bundle-page': {},
  'bundle-widget': {}
};

describe('Assets', function() {
  const {
    publicFolderPath,
    cacheFolderPath,
    getScriptMarkup,
    getStylesheetMarkup,
    expectedBundlesNames,
    deleteBuiltFolders,
    allBundlesAreIncluded,
    removeCache,
    getCacheMeta,
    retryAssertTrue
  } = loadUtils();

  after(async function() {
    await deleteBuiltFolders(publicFolderPath, true);
    await removeCache();
    return t.destroy(apos);
  });

  this.timeout(5 * 60 * 1000);

  it('should exist on the apos object', async function() {
    apos = await t.create({
      root: module,
      modules
    });
    assert(apos.asset);
  });

  it('should serve static files', async function() {
    const text = await apos.http.get('/static-test.txt');
    assert(text.match(/served/));
  });

  it('should check that webpack configs in modules are well formatted', async function () {
    const translate = apos.task.getReq().t;

    assert.doesNotThrow(() => checkModulesWebpackConfig(apos.modules, translate));

    await t.destroy(apos);

    apos = await t.create({
      root: module,
      modules: badModules
    });

    assert.throws(() => checkModulesWebpackConfig(apos.modules, translate));

    await t.destroy(apos);
  });

  it('should get webpack extensions from modules and fill extra bundles', async function () {
    const expectedEntryPointsNames = {
      js: [ 'extra', 'extra2' ],
      css: [ 'extra' ]
    };

    apos = await t.create({
      root: module,
      modules
    });

    const { extensions, verifiedBundles } = await getWebpackExtensions({
      name: 'src',
      getMetadata: apos.synth.getMetadata,
      modulesToInstantiate: apos.modulesToBeInstantiated()
    });

    assert(Object.keys(extensions).length === 2);
    assert(!extensions.ext1.resolve.alias.ext1);
    assert(extensions.ext1.resolve.alias.ext1Overriden);
    assert(extensions.ext2.resolve.alias.ext2);

    assert(Object.keys(verifiedBundles).length === 2);

    assert(verifiedBundles.extra.js.length === 1);
    assert(verifiedBundles.extra.scss.length === 1);

    assert(verifiedBundles.extra2.js.length === 1);
    assert(verifiedBundles.extra2.scss.length === 0);

    const filled = fillExtraBundles(verifiedBundles);

    filled.js.forEach((name) => {
      assert(expectedEntryPointsNames.js.includes(name));
    });

    filled.css.forEach((name) => {
      assert(expectedEntryPointsNames.css.includes(name));
    });
  });

  it('should build the right bundles in dev and prod modes', async function () {
    process.env.NODE_ENV = 'production';

    await apos.asset.tasks.build.task();

    const getPath = (p) => `${publicFolderPath}/apos-frontend/` + p;
    const [ releaseId ] = await fs.readdir(getPath('releases'));

    const checkFileExists = async (p) => fs.pathExists(getPath(p));
    const releasePath = `releases/${releaseId}/default/`;

    await checkBundlesExists(releasePath, expectedBundlesNames);
    await deleteBuiltFolders(publicFolderPath);

    process.env.NODE_ENV = 'development';

    await apos.asset.tasks.build.task();

    async function checkBundlesExists (folderPath, fileNames) {
      for (const fileName of fileNames) {
        const extraBundleExists = await checkFileExists(folderPath + fileName);
        assert(extraBundleExists);
      }
    }

    return checkBundlesExists('default/', expectedBundlesNames);
  });

  it('should load the right bundles inside the right page', async function () {
    const { _id: homeId } = await apos.page.find(apos.task.getAnonReq(), { level: 0 }).toObject();
    const jar = apos.http.jar();

    await apos.doc.db.insertMany(pagesToInsert(homeId));

    const bundlePage = await apos.http.get('/bundle', { jar });

    assert(bundlePage.includes(getStylesheetMarkup('public-bundle')));
    assert(!bundlePage.includes(getStylesheetMarkup('extra-bundle')));

    assert(bundlePage.includes(getScriptMarkup('public-module-bundle')));
    assert(!bundlePage.includes(getScriptMarkup('extra-module-bundle')));
    assert(bundlePage.includes(getScriptMarkup('extra2-module-bundle')));

    const childPage = await apos.http.get('/bundle/child', { jar });

    assert(childPage.includes(getStylesheetMarkup('public-bundle')));
    assert(childPage.includes(getStylesheetMarkup('extra-bundle')));

    assert(childPage.includes(getScriptMarkup('public-module-bundle')));
    assert(childPage.includes(getScriptMarkup('extra-module-bundle')));
    assert(!childPage.includes(getScriptMarkup('extra2-module-bundle')));
  });

  it('should load all the bundles on all pages when the user is logged in', async function () {
    const user = {
      ...apos.user.newInstance(),
      title: 'toto',
      username: 'toto',
      password: 'tata',
      email: 'toto@mail.com',
      role: 'admin'
    };

    const jar = apos.http.jar();

    await apos.user.insert(apos.task.getReq(), user);

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'toto',
          password: 'tata',
          session: true
        },
        jar
      }
    );

    const homePage = await apos.http.get('/', { jar });
    assert(homePage.match(/logged in/));

    const bundlePage = await apos.http.get('/bundle', { jar });

    allBundlesAreIncluded(bundlePage);

    await t.destroy(apos);
  });

  it('should inject modules and nomodules scripts for extra bundles when es5 enabled', async function () {
    const jar = apos.http.jar();

    const es5Modules = {
      ...modules,
      '@apostrophecms/asset': {
        options: {
          es5: true
        }
      }
    };

    apos = await t.create({
      root: module,
      modules: es5Modules
    });

    const { _id: homeId } = await apos.page.find(apos.task.getAnonReq(), { level: 0 }).toObject();

    await apos.doc.db.insertMany(pagesToInsert(homeId));

    await apos.asset.tasks.build.task();

    const bundlePage = await apos.http.get('/bundle', { jar });

    assert(bundlePage.includes(getScriptMarkup('public-module-bundle', 'module')));
    assert(bundlePage.includes(getScriptMarkup('public-nomodule-bundle', 'nomodule')));

    assert(bundlePage.includes(getScriptMarkup('extra2-module-bundle', 'module')));
    assert(bundlePage.includes(getScriptMarkup('extra2-nomodule-bundle', 'nomodule')));
  });

  it('should build with cache and gain performance', async function() {
    await t.destroy(apos);
    await removeCache();
    await removeCache(cacheFolderPath.replace('/webpack-cache', '/changed'));

    const es5Modules = {
      ...modules,
      '@apostrophecms/asset': {
        options: {
          es5: true
        }
      }
    };

    apos = await t.create({
      root: module,
      modules: es5Modules
    });
    assert.throws(() => fs.readdirSync(cacheFolderPath), {
      code: 'ENOENT'
    });

    let startTime;

    // Cold run
    startTime = Date.now();
    await apos.asset.tasks.build.task({
      'check-apos-build': false
    });
    const execTime = Date.now() - startTime;
    const { meta, folders } = getCacheMeta();
    assert.equal(folders.length, 3);
    assert.equal(Object.keys(meta).length, 3);
    assert(meta['default:apos']);
    assert(meta['default:src']);
    assert(meta['default:src-es5']);

    // Cache
    startTime = Date.now();
    await apos.asset.tasks.build.task({
      'check-apos-build': false
    });
    const execTimeCached = Date.now() - startTime;
    const { meta: meta2, folders: folders2 } = getCacheMeta();
    assert.equal(folders2.length, 3);
    assert.equal(Object.keys(meta2).length, 3);
    assert(meta2['default:apos']);
    assert(meta2['default:src']);
    assert(meta2['default:src-es5']);

    // Expect at least 40% gain, in reallity it should be 50+
    const gain = (execTime - execTimeCached) / execTime * 100;
    assert(gain >= 20, `Expected gain >=20%, got ${gain}%`);

    // Modification times
    assert(meta['default:apos'].mdate);
    assert(meta2['default:apos'].mdate);
    assert(meta['default:src'].mdate);
    assert(meta2['default:src'].mdate);
    assert(meta['default:src-es5'].mdate);
    assert(meta2['default:src-es5'].mdate);
    assert(
      new Date(meta['default:apos'].mdate) < new Date(meta2['default:apos'].mdate)
    );
    assert.equal(
      new Date(meta2['default:apos'].mdate).toISOString(),
      fs.statSync(meta2['default:apos'].location).mtime.toISOString()
    );
    assert(
      new Date(meta['default:src'].mdate) < new Date(meta2['default:src'].mdate)
    );
    assert.equal(
      new Date(meta2['default:src'].mdate).toISOString(),
      fs.statSync(meta2['default:src'].location).mtime.toISOString()
    );
    assert(
      new Date(meta['default:src-es5'].mdate) < new Date(meta2['default:src-es5'].mdate)
    );
    assert.equal(
      new Date(meta2['default:src-es5'].mdate).toISOString(),
      fs.statSync(meta2['default:src-es5'].location).mtime.toISOString()
    );
  });

  it('should invalidate build cache when namespace changes', async function() {
    process.env.APOS_DEBUG_NAMESPACE = 'test';
    await apos.asset.tasks.build.task({
      'check-apos-build': false
    });
    const { meta, folders } = getCacheMeta();
    assert.equal(folders.length, 6);
    assert.equal(Object.keys(meta).length, 6);
    assert(meta['test:apos']);
    assert(meta['test:src']);
    assert(meta['test:src-es5']);
    assert(meta['default:apos']);
    assert(meta['default:src']);
    assert(meta['default:src-es5']);
    delete process.env.APOS_DEBUG_NAMESPACE;
  });

  it('should invalidate build cache when packages change', async function() {
    await t.destroy(apos);
    const lock = require('./package-lock.json');
    assert.equal(lock.version, 'current');
    lock.version = 'new';
    fs.writeFileSync(
      path.join(process.cwd(), 'test/package-lock.json'),
      JSON.stringify(lock, null, '  '),
      'utf8'
    );
    const es5Modules = {
      ...modules,
      '@apostrophecms/asset': {
        options: {
          es5: true
        }
      }
    };

    apos = await t.create({
      root: module,
      modules: es5Modules
    });
    await apos.asset.tasks.build.task({
      'check-apos-build': false
    });

    const { meta, folders } = getCacheMeta();
    assert.equal(folders.length, 9);
    assert.equal(Object.keys(meta).length, 9);
    assert(meta['default:apos_2']);
    assert(meta['default:src_2']);
    assert(meta['default:src-es5_2']);
  });

  it('should invalidate build cache when configuration changes', async function() {
    await t.destroy(apos);
    const es5Modules = {
      ...modules,
      'bundle-page': {
        webpack: {
          extensions: {
            ext1: {
              resolve: {
                alias: {
                  ext1: 'changed'
                }
              }
            }
          }
        }
      },
      '@apostrophecms/asset': {
        options: {
          es5: true
        }
      }
    };
    apos = await t.create({
      root: module,
      modules: es5Modules
    });
    await apos.asset.tasks.build.task({
      'check-apos-build': false
    });

    const { meta, folders } = getCacheMeta();
    assert.equal(folders.length, 11);
    assert.equal(Object.keys(meta).length, 11);
    assert(!meta['default:apos_3']);
    assert(meta['default:src_3']);
    assert(meta['default:src-es5_3']);
  });

  it('should clear build cache', async function() {
    const cacheFolders = fs.readdirSync(cacheFolderPath, 'utf8');
    assert(cacheFolders.length > 0);
    await apos.asset.tasks['clear-cache'].task();

    assert.equal(fs.readdirSync(cacheFolderPath, 'utf8').length, 0);
  });

  it('should be able to override the build cache location via APOS_ASSET_CACHE', async function() {
    await t.destroy(apos);
    await removeCache();
    const altCacheLoc = cacheFolderPath.replace('/webpack-cache', '/changed');
    await removeCache(altCacheLoc);
    process.env.APOS_ASSET_CACHE = altCacheLoc;

    apos = await t.create({
      root: module,
      modules
    });
    assert.throws(() => fs.readdirSync(altCacheLoc), {
      code: 'ENOENT'
    });
    await apos.asset.tasks.build.task({
      'check-apos-build': false
    });
    const { meta, folders } = getCacheMeta(altCacheLoc);
    assert.equal(folders.length, 2);
    assert.equal(Object.keys(meta).length, 2);
    assert(meta['default:apos']);
    assert(meta['default:src']);

    delete process.env.APOS_ASSET_CACHE;
    await removeCache(altCacheLoc);
  });

  it('should watch and rebuild assets and reload page in development (bundle src)', async function() {
    await t.destroy(apos);
    let result = {};
    const cb = (obj) => {
      result = obj;
    };

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        ...modules,
        '@apostrophecms/asset': {
          extendMethods() {
            return {
              async watchUiAndRebuild(_super) {
                return _super(cb);
              }
            };
          }
        }
      }
    });
    const restartId = apos.asset.restartId;
    assert(apos.asset.buildWatcher);
    assert(apos.asset.restartId);
    assert(!result.builds);
    assert(!result.changes);

    // Modify asset and rebuild
    const assetPath = path.join(process.cwd(), 'test/modules/bundle-page/ui/src/extra.js');
    const assetPathPublic = path.join(process.cwd(), 'test/public/apos-frontend/default/extra-module-bundle.js');
    const assetContent = 'export default () => {};\n';
    fs.writeFileSync(
      assetPath,
      'export default () => { \'bundle-page-watcher-test-src\'; };\n',
      'utf8'
    );

    await retryAssertTrue(
      async () => (await fs.readFile(assetPathPublic, 'utf8')).match(/bundle-page-watcher-test-src/),
      'Unable to verify public asset was rebuilt by the watcher',
      500,
      10000
    );

    await retryAssertTrue(
      () => apos.asset.restartId !== restartId,
      'Unable to verify restartId has been changed',
      500,
      10000
    );

    await retryAssertTrue(
      () => result.builds.length === 1 && result.builds.includes('src'),
      'Unable to verify build "src" has been triggered',
      50,
      1000
    );

    await retryAssertTrue(
      () => result.changes.length === 1 && result.changes[0].includes('modules/bundle-page/ui/src/extra.js'),
      'Unable to verify changes contain the proper file',
      50,
      1000
    );

    await t.destroy(apos);
    assert.equal(apos.asset.buildWatcher, null);
    apos = null;
    fs.writeFileSync(assetPath, assetContent, 'utf8');
  });

  it('should watch and rebuild assets and reload page in development (src, src-es5)', async function() {
    await t.destroy(apos);
    let result = {};
    const setTestResult = (obj) => {
      result = obj;
    };
    const rootPath = process.cwd();
    const assetPathJs = path.join(rootPath, 'test/modules/default-page/ui/src/index.js');
    const assetPathScss = path.join(rootPath, 'test/modules/default-page/ui/src/index.scss');
    const assetPathPublicJs = path.join(rootPath, 'test/public/apos-frontend/default/public-module-bundle.js');
    const assetPathPublicCss = path.join(rootPath, 'test/public/apos-frontend/default/public-bundle.css');
    const assetPathAposJs = path.join(rootPath, 'test/public/apos-frontend/default/apos-module-bundle.js');
    const assetPathAposCss = path.join(rootPath, 'test/public/apos-frontend/default/apos-bundle.css');
    const assetContentJs = 'export default () => {};\n';
    const assetContentScss = '.default-page {color:red};\n';
    // Resurrect the default assets content if test has failed
    fs.writeFileSync(assetPathJs, assetContentJs, 'utf8');
    fs.writeFileSync(assetPathScss, assetContentScss, 'utf8');

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        'default-page': {},
        '@apostrophecms/asset': {
          options: {
            es5: true
          },
          extendMethods() {
            return {
              async watchUiAndRebuild(_super) {
                return _super(setTestResult);
              }
            };
          }
        }
      }
    });
    // Assert defaults
    const restartId = apos.asset.restartId;
    assert(apos.asset.buildWatcher);
    assert(apos.asset.restartId);
    assert(!result.builds);
    assert(!result.changes);

    // * modify assets and rebuild
    fs.writeFileSync(
      assetPathJs,
      'export default () => { \'default-page-watcher-test-src\'; };\n',
      'utf8'
    );
    fs.writeFileSync(
      assetPathScss,
      '.default-page-watcher-test-src{color:red};\n',
      'utf8'
    );

    // * change is in the public bundle
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathPublicJs, 'utf8')).match(/default-page-watcher-test-src/),
      'Unable to verify public JS asset was rebuilt by the watcher',
      500,
      10000
    );
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathPublicCss, 'utf8')).match(/\.default-page-watcher-test-src/),
      'Unable to verify public CSS asset was rebuilt by the watcher',
      500,
      10000
    );

    // * change is in the apos bundle
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathAposJs, 'utf8')).match(/default-page-watcher-test-src/),
      'Unable to verify apos JS asset was rebuilt by the watcher',
      500,
      10000
    );
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathAposCss, 'utf8')).match(/\.default-page-watcher-test-src/),
      'Unable to verify apos CSS asset was rebuilt by the watcher',
      500,
      10000
    );

    // * page has been restarted
    await retryAssertTrue(
      () => apos.asset.restartId !== restartId,
      'Unable to verify restartId has been changed',
      500,
      10000
    );

    // * only src related builds were triggered
    await retryAssertTrue(
      () => result.builds.length === 2 &&
        result.builds.includes('src') &&
        result.builds.includes('src-es5'),
      'Unable to verify builds "src" and "src-es5" have been triggered',
      50,
      1000
    );

    // * changes detected
    await retryAssertTrue(
      () =>
        result.changes.length === 2 &&
        result.changes
          .filter(f =>
            (f.includes('modules/default-page/ui/src/index.js') ||
            f.includes('modules/default-page/ui/src/index.scss'))
          )
          .length === 2,
      'Unable to verify changes contain the proper source files',
      50,
      1000
    );

    await t.destroy(apos);
    assert.equal(apos.asset.buildWatcher, null);
    apos = null;
    fs.writeFileSync(assetPathJs, assetContentJs, 'utf8');
    fs.writeFileSync(assetPathScss, assetContentScss, 'utf8');
  });

  it('should watch and rebuild assets and reload page in development (public)', async function() {
    await t.destroy(apos);
    let result = {};
    const setTestResult = (obj) => {
      result = obj;
    };
    const rootPath = process.cwd();
    const assetPathJs = path.join(rootPath, 'test/modules/default-page/ui/public/index.js');
    const assetPathCss = path.join(rootPath, 'test/modules/default-page/ui/public/index.css');
    const assetPathPublicJs = path.join(rootPath, 'test/public/apos-frontend/default/public-module-bundle.js');
    const assetPathPublicCss = path.join(rootPath, 'test/public/apos-frontend/default/public-bundle.css');
    const assetPathAposJs = path.join(rootPath, 'test/public/apos-frontend/default/apos-module-bundle.js');
    const assetPathAposCss = path.join(rootPath, 'test/public/apos-frontend/default/apos-bundle.css');
    const assetContentJs = 'export default () => {};\n';
    const assetContentScss = '.default-page {color:red};\n';
    // Resurrect the default assets content if test has failed
    fs.writeFileSync(assetPathJs, assetContentJs, 'utf8');
    fs.writeFileSync(assetPathCss, assetContentScss, 'utf8');

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        'default-page': {},
        '@apostrophecms/asset': {
          options: {
            es5: true
          },
          extendMethods() {
            return {
              async watchUiAndRebuild(_super) {
                return _super(setTestResult);
              }
            };
          }
        }
      }
    });
    // Assert defaults
    const restartId = apos.asset.restartId;
    assert(apos.asset.buildWatcher);
    assert(apos.asset.restartId);
    assert(!result.builds);
    assert(!result.changes);

    // * modify assets and rebuild
    fs.writeFileSync(
      assetPathJs,
      'export default () => { \'default-page-watcher-test-public\'; };\n',
      'utf8'
    );
    fs.writeFileSync(
      assetPathCss,
      '.default-page-watcher-test-public{color:red};\n',
      'utf8'
    );

    // * change is in the public bundle
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathPublicJs, 'utf8')).match(/default-page-watcher-test-public/),
      'Unable to verify public JS asset was rebuilt by the watcher',
      500,
      10000
    );
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathPublicCss, 'utf8')).match(/\.default-page-watcher-test-public/),
      'Unable to verify public CSS asset was rebuilt by the watcher',
      500,
      10000
    );

    // * change is in the apos bundle
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathAposJs, 'utf8')).match(/default-page-watcher-test-public/),
      'Unable to verify apos JS asset was rebuilt by the watcher',
      500,
      10000
    );
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathAposCss, 'utf8')).match(/\.default-page-watcher-test-public/),
      'Unable to verify apos CSS asset was rebuilt by the watcher',
      500,
      10000
    );

    // * page has been restarted
    await retryAssertTrue(
      () => apos.asset.restartId !== restartId,
      'Unable to verify restartId has been changed',
      500,
      10000
    );

    // * only public build was triggered
    await retryAssertTrue(
      () => result.builds.length === 1 &&
        result.builds.includes('public'),
      'Unable to verify build "public" has been triggered',
      50,
      1000
    );

    // * changes detected
    await retryAssertTrue(
      () =>
        result.changes.length === 2 &&
        result.changes
          .filter(f =>
            (f.includes('modules/default-page/ui/public/index.js') ||
            f.includes('modules/default-page/ui/public/index.css'))
          )
          .length === 2,
      'Unable to verify changes contain the proper source files',
      50,
      1000
    );

    await t.destroy(apos);
    assert.equal(apos.asset.buildWatcher, null);
    apos = null;
    fs.writeFileSync(assetPathJs, assetContentJs, 'utf8');
    fs.writeFileSync(assetPathCss, assetContentScss, 'utf8');
  });

  it('should watch and rebuild assets and reload page in development (apos)', async function() {
    await t.destroy(apos);
    let result = {};
    const setTestResult = (obj) => {
      result = obj;
    };
    const rootPath = process.cwd();
    const assetPathJs = path.join(rootPath, 'test/modules/default-page/ui/apos/components/FakeComponent.vue');
    const assetPathAposJs = path.join(rootPath, 'test/public/apos-frontend/default/apos-module-bundle.js');
    const assetContentJs = '<template><span /></template>\n';
    fs.writeFileSync(assetPathJs, assetContentJs, 'utf8');

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        'default-page': {
          options: {
            components: {
              fake: 'FakeComponent'
            }
          }
        },
        '@apostrophecms/asset': {
          options: {
            es5: true
          },
          extendMethods() {
            return {
              async watchUiAndRebuild(_super) {
                return _super(setTestResult);
              }
            };
          }
        }
      }
    });
    // Assert defaults
    const restartId = apos.asset.restartId;
    assert(apos.asset.buildWatcher);
    assert(apos.asset.restartId);
    assert(!result.builds);
    assert(!result.changes);

    // * modify assets and rebuild
    fs.writeFileSync(
      assetPathJs,
      '<template><span>default-page-watcher-test-apos</span></template>\n',
      'utf8'
    );

    // * change is in the apos bundle
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathAposJs, 'utf8'))
        .includes('default-page-watcher-test-apos'),
      'Unable to verify apos JS asset was rebuilt by the watcher',
      500,
      20000
    );

    // * page has been restarted
    await retryAssertTrue(
      () => apos.asset.restartId !== restartId,
      'Unable to verify restartId has been changed',
      500,
      10000
    );

    // * only apos build was triggered
    await retryAssertTrue(
      () => result.builds.length === 1 &&
        result.builds.includes('apos'),
      'Unable to verify build "apos" has been triggered',
      50,
      1000
    );

    // * changes detected
    await retryAssertTrue(
      () =>
        result.changes.length === 1 &&
        result.changes[0].includes('modules/default-page/ui/apos/components/FakeComponent.vue'),
      'Unable to verify changes contain the proper source files',
      50,
      1000
    );

    await t.destroy(apos);
    assert.equal(apos.asset.buildWatcher, null);
    apos = null;
    fs.writeFileSync(assetPathJs, assetContentJs, 'utf8');
  });

  it('should watch but not rebuild assets and not reload page when changes are not in use', async function() {
    await t.destroy(apos);
    let result = {};
    let rebuilt = false;
    const setTestResult = (obj) => {
      result = obj;
      rebuilt = true;
    };
    const rootPath = process.cwd();
    const assetPathJs = path.join(rootPath, 'test/modules/default-page/ui/src/index.js');
    const assetPathScss = path.join(rootPath, 'test/modules/default-page/ui/src/index.scss');
    const assetPathPublicJs = path.join(rootPath, 'test/public/apos-frontend/default/public-module-bundle.js');
    const assetPathPublicCss = path.join(rootPath, 'test/public/apos-frontend/default/public-bundle.css');
    const assetPathAposJs = path.join(rootPath, 'test/public/apos-frontend/default/apos-module-bundle.js');
    const assetPathAposCss = path.join(rootPath, 'test/public/apos-frontend/default/apos-bundle.css');
    const assetContentJs = 'export default () => {};\n';
    const assetContentScss = '.default-page {color:red};\n';
    // Resurrect the default assets content if test has failed
    fs.writeFileSync(assetPathJs, assetContentJs, 'utf8');
    fs.writeFileSync(assetPathScss, assetContentScss, 'utf8');

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        '@apostrophecms/asset': {
          options: {
            es5: true
          },
          extendMethods() {
            return {
              async watchUiAndRebuild(_super) {
                return _super(setTestResult);
              }
            };
          }
        }
      }
    });
    // Assert defaults
    const restartId = apos.asset.restartId;
    assert(apos.asset.buildWatcher);
    assert(apos.asset.restartId);
    assert(!result.builds);
    assert(!result.changes);
    assert.equal(rebuilt, false);

    // * modify assets
    fs.writeFileSync(
      assetPathJs,
      'export default () => { \'default-page-watcher-test-src\'; };\n',
      'utf8'
    );
    fs.writeFileSync(
      assetPathScss,
      '.default-page-watcher-test-src{color:red};\n',
      'utf8'
    );

    // * rebuild handler has been triggered
    await retryAssertTrue(
      () => rebuilt === true,
      'Unable to verify rebuild has been triggered',
      500,
      10000
    );

    // * change is NOT in the public bundle
    await retryAssertTrue(
      async () => !(await fs.readFile(assetPathPublicJs, 'utf8')).match(/default-page-watcher-test-src/),
      'Unable to verify public JS asset was NOT rebuilt by the watcher',
      500,
      1000
    );
    await retryAssertTrue(
      async () => !(await fs.readFile(assetPathPublicCss, 'utf8')).match(/\.default-page-watcher-test-src/),
      'Unable to verify public CSS asset was NOT rebuilt by the watcher',
      500,
      1000
    );

    // * change is NOT in the apos bundle
    await retryAssertTrue(
      async () => !(await fs.readFile(assetPathAposJs, 'utf8')).match(/default-page-watcher-test-src/),
      'Unable to verify apos JS asset was NOT rebuilt by the watcher',
      500,
      1000
    );
    await retryAssertTrue(
      async () => !(await fs.readFile(assetPathAposCss, 'utf8')).match(/\.default-page-watcher-test-src/),
      'Unable to verify apos CSS asset was NOT rebuilt by the watcher',
      500,
      1000
    );

    // * page has NOT been restarted
    await retryAssertTrue(
      () => apos.asset.restartId === restartId,
      'Unable to verify restartId has NOT been changed',
      500,
      1000
    );

    // * no builds were triggered
    await retryAssertTrue(
      () => result.builds.length === 0,
      'Unable to verify builds "src" and "src-es5" have NOT been triggered',
      50,
      1000
    );

    // * changes detected
    await retryAssertTrue(
      () =>
        result.changes.length === 2 &&
        result.changes
          .filter(f =>
            (f.includes('modules/default-page/ui/src/index.js') ||
            f.includes('modules/default-page/ui/src/index.scss'))
          )
          .length === 2,
      'Unable to verify changes contain the proper source files',
      50,
      1000
    );

    await t.destroy(apos);
    assert.equal(apos.asset.buildWatcher, null);
    apos = null;
    fs.writeFileSync(assetPathJs, assetContentJs, 'utf8');
    fs.writeFileSync(assetPathScss, assetContentScss, 'utf8');
  });

  it('should watch and rebuild assets in a debounced queue', async function() {
    await t.destroy(apos);
    let timesRebuilt = 0;
    const inc = () => {
      timesRebuilt += 1;
    };

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        ...modules,
        '@apostrophecms/asset': {
          extendMethods() {
            return {
              async watchUiAndRebuild(_super) {
                return _super(inc);
              }
            };
          }
        }
      }
    });
    assert(apos.asset.buildWatcher);

    const assetPath = path.join(process.cwd(), 'test/modules/bundle-page/ui/src/extra.js');
    const assetPathPublic = path.join(process.cwd(), 'test/public/apos-frontend/default/extra-module-bundle.js');
    const assetContent = 'export default () => {};\n';

    // Modify below the debounce rate
    for (const i of [ 1, 2, 3 ]) {
      await fs.writeFile(
        assetPath,
        `export default () => { 'bundle-page-watcher-test-${i}'; };\n`,
        'utf8'
      );
      await Promise.delay(300);
    }
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathPublic, 'utf8')).match(/bundle-page-watcher-test-3/),
      'Unable to verify public asset rebuilding by the watcher',
      500,
      10000
    );
    await retryAssertTrue(
      () => timesRebuilt === 1,
      `Expected to rebuild 1 time, got ${timesRebuilt}`,
      100,
      5000
    );

    // Modify above the debounce rate, test the queue cap
    timesRebuilt = 0;
    for (const i of [ 1, 2, 3 ]) {
      await fs.writeFile(
        assetPath,
        `export default () => { 'bundle-page-watcher-test-${i}0'; };\n`,
        'utf8'
      );
      await Promise.delay(1050);
    }
    await retryAssertTrue(
      async () => (await fs.readFile(assetPathPublic, 'utf8')).match(/bundle-page-watcher-test-30/),
      'Unable to verify public asset rebuilding by the watcher',
      500,
      10000
    );
    await retryAssertTrue(
      () => timesRebuilt === 2,
      `Expected to rebuild 2 times, got ${timesRebuilt}`,
      100,
      5000
    );

    await t.destroy(apos);
    apos = null;
    fs.writeFileSync(assetPath, assetContent, 'utf8');
  });

  it('should be able to setup the debounce time', async function() {
    await t.destroy(apos);

    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/asset': {
          options: {
            watchDebounceMs: 500
          }
        }
      }
    });
    assert.equal(apos.asset.buildWatcherDebounceMs, 500);
  });

  it('should be able to register an external build watcher', async function() {
    await t.destroy(apos);

    const chokidar = require('chokidar');
    let instance;

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        '@apostrophecms/asset': {
          methods(self) {
            return {
              registerBuildWatcher() {
                self.buildWatcher = chokidar.watch([ __filename ], {
                  cwd: self.apos.rootDir,
                  ignoreInitial: true
                });
                instance = self.buildWatcher;
              }
            };
          }
        }
      }
    });
    assert.equal(apos.asset.buildWatcher, instance);
  });

  it('should not watch if explicitly disabled by option or env in development', async function() {
    await t.destroy(apos);
    process.env.APOS_ASSET_WATCH = '0';

    apos = await t.create({
      root: module,
      autoBuild: true
    });
    assert(!apos.asset.buildWatcher);
    delete process.env.APOS_ASSET_WATCH;
    await t.destroy(apos);

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules: {
        '@apostrophecms/asset': {
          options: {
            watch: false
          }
        }
      }
    });
    assert(!apos.asset.buildWatcher);
  });

  it('should not watch if autoBuild is disabled', async function() {
    await t.destroy(apos);

    apos = await t.create({
      root: module
    });
    assert(!apos.asset.buildWatcher);
  });

  it('should not watch in production', async function() {
    await t.destroy(apos);
    process.env.NODE_ENV = 'production';

    apos = await t.create({
      root: module,
      autoBuild: true,
      modules
    });
    assert(!apos.asset.buildWatcher);
    process.env.NODE_ENV = 'development';
  });
});

function loadUtils () {
  const publicFolderPath = path.join(process.cwd(), 'test/public');
  const cacheFolderPath = process.env.APOS_ASSET_CACHE ||
              path.join(process.cwd(), 'test/data/temp/webpack-cache');

  const getScriptMarkup = (file, mod) => {
    const moduleStr = mod === 'module' ? ' type="module"' : ' nomodule';

    return `<script${mod ? moduleStr : ''} src="/apos-frontend/default/${file}.js"></script>`;
  };

  const getStylesheetMarkup = (file) =>
    `<link href="/apos-frontend/default/${file}.css" rel="stylesheet" />`;

  const expectedBundlesNames = [ 'extra-module-bundle.js', 'extra2-module-bundle.js', 'extra-bundle.css' ];

  const deleteBuiltFolders = async (publicPath, deleteAposBuild = false) => {
    await fs.remove(publicPath + '/apos-frontend');
    await fs.remove(publicPath + '/uploads');

    if (deleteAposBuild) {
      await fs.remove(path.join(process.cwd(), 'test/apos-build'));
    }
  };

  const allBundlesAreIncluded = (page) => {
    assert(page.includes(getStylesheetMarkup('apos-bundle')));
    assert(page.includes(getStylesheetMarkup('extra-bundle')));

    assert(page.includes(getScriptMarkup('apos-module-bundle')));
    assert(page.includes(getScriptMarkup('extra-module-bundle')));
    assert(page.includes(getScriptMarkup('extra2-module-bundle')));
  };

  const removeCache = async (loc) => {
    await fs.remove(loc || cacheFolderPath);
  };

  const getCacheMeta = (loc) => {
    const cacheFolders = fs.readdirSync(loc || cacheFolderPath, 'utf8');
    const i = {};
    const meta = cacheFolders
      .reduce((prev, folder) => {
        const location = `${loc || cacheFolderPath}/${folder}/.apos`;
        const m = fs.readFileSync(location, 'utf8');
        let [ mdate, id ] = m.split(' ');
        // e.g. default:apos_2, default:apos_3, etc
        if (prev[id]) {
          i[id] = (i[id] || 1) + 1;
          id = `${id}_${i[id]}`;
        }
        return {
          ...prev,
          [id]: {
            mdate: new Date(mdate),
            folder,
            location
          }
        };
      }, {});
    return {
      folders: cacheFolders,
      meta
    };
  };

  // Retry `max` ms with `delay` ms between the retries
  // until `assertFn` returns true or fail with `failMsg`
  const retryAssertTrue = async (assertFn, failMsg, delay, max) => {
    let current = 0;
    while (!(await assertFn())) {
      await Promise.delay(delay);
      current += delay;
      if (current >= max) {
        assert.fail(`${failMsg}`);
      }
    }
  };

  return {
    publicFolderPath,
    cacheFolderPath,
    getScriptMarkup,
    getStylesheetMarkup,
    expectedBundlesNames,
    deleteBuiltFolders,
    allBundlesAreIncluded,
    removeCache,
    getCacheMeta,
    retryAssertTrue
  };
}
