const t = require('../test-lib/test.js');
const assert = require('assert');
const path = require('path');
const {
  checkModulesWebpackConfig,
  mergeWebpackConfigs
} = require('../modules/@apostrophecms/asset/lib/webpack/utils');
const webpackBaseConfig = require('../modules/@apostrophecms/asset/lib/webpack/src/webpack.config');

let apos;

const modules = {
  '@apostrophecms/i18n': {
    options: {
      locales: {
        en: {}
      }
    }
  },
  mod1: {
    extend: '@apostrophecms/module',
    webpack: {
      extensions: {
        ext1: {
          rules: [
            {
              test: /\.ext1$/,
              loader: 'ext1-loader',
              options: { sourceMap: true }
            }
          ]
        },
        ext2: {
          rules: [
            {
              test: /\.ext2$/,
              loader: 'ext2-loader',
              options: { sourceMap: true }
            }
          ]
        }
      }
    }
  },
  mod2: {
    extend: '@apostrophecms/module',
    webpack: {
      extensions: {
        ext1: {
          rules: [
            {
              test: /\.ext1$/,
              loader: 'ext1-loader',
              options: { sourceMap: false }
            }
          ]
        }
      }
    }
  }
};

const badModules = {
  ...modules,
  badModules: {
    webpack: {
      badprop: {}
    }
  }
};

describe('Assets', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should should exist on the apos object', async function() {
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
    const [ valid, err ] = check(apos.modules, apos.task.getReq().t);

    assert(valid);
    assert(!err);

    await t.destroy(apos);

    apos = await t.create({
      root: module,
      modules: badModules
    });

    const [ valid2, err2 ] = check(apos.modules, apos.task.getReq().t);

    assert(!valid2);
    assert(err2);

    await t.destroy(apos);

    apos = await t.create({
      root: module,
      modules
    });

    function check (modules, t) {
      try {
        checkModulesWebpackConfig(modules, t);

        return [ true, false ];
      } catch (err) {
        return [ false, err ];
      }
    }
  });

  it('shoud merge webpack configs from modules with the Apostrophe one', async function () {
    const buildPath = (p) => {
      return path.join(process.cwd(), p);
    };

    const webpackInstanceConfig = webpackBaseConfig({
      importFile: buildPath('apos-build/default/src-import.js'),
      modulesDir: buildPath('apos-build/default/src/modules'),
      outputPath: buildPath('public/apos-frontend/default'),
      outputFilename: 'src-build.js'
    }, apos);

    const mergedConfig = mergeWebpackConfigs(apos.modules, webpackInstanceConfig);

    const ext1Loaders = mergedConfig.rules.filter((rule) => rule.loader === 'ext1-loader');
    assert(ext1Loaders.length === 1);
    assert(ext1Loaders[0].options.sourceMap === false);
    assert(mergedConfig.rules);
  });
});
