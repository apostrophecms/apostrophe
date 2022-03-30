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

describe('Assets', function() {
  const {
    publicFolderPath,
    getScriptMarkup,
    getStylesheetMarkup,
    expectedBundlesNames,
    deleteBuiltFolders,
    allBundlesAreIncluded
  } = loadUtils();

  after(async function() {
    await deleteBuiltFolders(publicFolderPath, true);
    return t.destroy(apos);
  });

  this.timeout(60000);

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

    assert(verifiedBundles.length === 2);

    const [ verified1, verified2 ] = verifiedBundles;

    assert(verified1.bundleName === 'extra');
    assert(verified1.paths.length === 2);
    assert(verified1.paths[0].endsWith('.js'));
    assert(verified1.paths[1].endsWith('.scss'));

    assert(verified2.bundleName === 'extra2');
    assert(verified2.paths.length === 1);

    const filled = fillExtraBundles(verifiedBundles);

    filled.js.forEach((name) => {
      assert(expectedEntryPointsNames.js.includes(name));
    });

    filled.css.forEach((name) => {
      assert(expectedEntryPointsNames.css.includes(name));
    });

    // await t.destroy(apos);
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
    await checkBundlesExists('default/', expectedBundlesNames);

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
    ];

    await apos.doc.db.insertMany(pagesToInsert);

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
  });
});

function loadUtils () {
  const publicFolderPath = path.join(process.cwd(), 'test/public');

  const getScriptMarkup = (file) =>
    `<script src="/apos-frontend/default/${file}.js"></script>`;

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

  return {
    publicFolderPath,
    getScriptMarkup,
    getStylesheetMarkup,
    expectedBundlesNames,
    deleteBuiltFolders,
    allBundlesAreIncluded
  };
}
