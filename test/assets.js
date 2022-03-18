const t = require('../test-lib/test.js');
const assert = require('assert');
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

describe('Assets', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should exist on the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'extends-webpack': {},
        'extends-webpack-sub': {}
      }
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

    apos = await t.create({
      root: module,
      modules: {
        'extends-webpack': {},
        'extends-webpack-sub': {}
      }
    });
  });

  it('should get webpack extensions from modules and fill extra bundles', async function () {
    const extraBundles = [];
    const expectedBundlesNames = [ 'my-bundle.js', 'my-sub-bundle.js', 'my-sub-bundle.css' ];

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

    assert(verified1.bundleName === 'my-bundle');
    assert(verified1.paths.length === 1);

    assert(verified2.bundleName === 'my-sub-bundle');
    assert(verified2.paths.length === 2);
    assert(verified2.paths[0].endsWith('.js'));
    assert(verified2.paths[1].endsWith('.scss'));

    fillExtraBundles(verifiedBundles, extraBundles);

    extraBundles.forEach((name) => {
      assert(expectedBundlesNames.includes(name));
    });
  });
});
