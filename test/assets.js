const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

const {
  checkModulesWebpackConfig,
  getWebpackExtensions,
  fillExtraBundles
} = require('../modules/@apostrophecms/asset/lib/webpack/utils');

let apos;

const badModules = {
  badModuleConfig: {
    webpack: {
      badprop: {}
    }
  },
  badModuleConfig2: {
    webpack: []
  }
};

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

const allModules = {
  ...modules,
  'extends-webpack': {},
  'extends-webpack-sub': {}
};

describe('Assets', function() {
  const publicFolderPath = path.join(process.cwd(), 'test/public');

  async function deleteBuiltFolders (publicPath) {
    await fs.remove(publicPath + '/apos-frontend');
    await fs.remove(publicPath + '/uploads');
  }
  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

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
    apos = await t.create({
      root: module,
      modules: allModules
    });

    const expectedBundlesNames = [ 'extra-bundle.js', 'extra-bundle2.js', 'extra-bundle.css' ];

    const { extensions, verifiedBundles } = await getWebpackExtensions({
      name: 'src',
      getMetadata: apos.synth.getMetadata,
      modulesToInstantiate: apos.modulesToBeInstantiated()
    });

    assert(Object.keys(extensions).length === 3);
    assert(extensions.ext2.rules[0].overriden);
    assert(extensions.ext3);

    assert(verifiedBundles.length === 2);

    const [ verified1, verified2 ] = verifiedBundles;

    assert(verified1.bundleName === 'extra-bundle');
    assert(verified1.paths.length === 2);
    assert(verified1.paths[0].endsWith('.js'));
    assert(verified1.paths[1].endsWith('.scss'));

    assert(verified2.bundleName === 'extra-bundle2');
    assert(verified2.paths.length === 1);

    const filled = fillExtraBundles(verifiedBundles);

    filled.js.forEach((name) => {
      assert(expectedBundlesNames.includes(name));
    });

    filled.css.forEach((name) => {
      assert(expectedBundlesNames.includes(name));
    });

    await t.destroy(apos);
  });

  it('should build the right bundles in dev and prod modes', async function () {
    process.env.NODE_ENV = 'production';

    apos = await t.create({
      root: module,
      modules
    });

    await apos.asset.tasks.build.task();

    const getPath = (p) => `${publicFolderPath}/apos-frontend/` + p;
    const [ releaseId ] = await fs.readdir(
      getPath('releases')
    );

    const checkFileExists = async (p) => fs.pathExists(getPath(p));
    const releasePath = `releases/${releaseId}/default/`;
    const bundlesNames = [ 'extra-bundle.js', 'extra-bundle.css', 'extra-bundle2.js' ];

    await checkBundlesExists(releasePath, bundlesNames);
    await deleteBuiltFolders(publicFolderPath);

    process.env.NODE_ENV = 'development';

    await apos.asset.tasks.build.task();
    await checkBundlesExists('default/', bundlesNames);

    async function checkBundlesExists (folderPath, fileNames) {
      for (const fileName of fileNames) {
        const extraBundleExists = await checkFileExists(folderPath + fileName);
        assert(extraBundleExists);
      }
    }
  });

  it('should load the right bundles inside the right page', async function () {
    const { _id: homeId } = await apos.page.find(apos.task.getAnonReq(), { level: 0 }).toObject();
    const jar = apos.http.jar();

    const pagesToInsert = [
      {
        _id: 'parent:en:published',
        aposLocale: 'en:published',
        metaType: 'doc',
        aposDocId: 'parent',
        type: 'bundle-page',
        slug: '/bundle',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent`,
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
        aposLocale: 'en:published',
        aposDocId: 'child',
        type: 'bundle-page',
        slug: '/bundle/child',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/child`,
        level: 2,
        rank: 0
      }
    ];

    await apos.doc.db.insertMany(pagesToInsert);

    const page = await apos.http.get(
      '/bundle',
      {
        jar
      }
    );

    const getScriptMarkup = (file) =>
      `<script src="/apos-frontend/default/${file}.js"></script>`;

    const getStylesheetMarkup = (file) =>
      `<link href="/apos-frontend/default/${file}.css" rel="stylesheet" />`;

    assert(page.includes(getStylesheetMarkup('public-bundle')));
    assert(!page.includes(getStylesheetMarkup('extra-bundle')));
    assert(!page.includes(getStylesheetMarkup('extra-bundle2')));

    assert(page.includes(getScriptMarkup('public-module-bundle')));
    assert(!page.includes(getScriptMarkup('extra-bundle')));
    assert(page.includes(getScriptMarkup('extra-bundle2')));

    await deleteBuiltFolders(publicFolderPath);
  });
});
