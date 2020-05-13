let t = require('../test-lib/test.js');
let assert = require('assert');
let _ = require('lodash');

describe('Apostrophe', function() {

  this.timeout(t.timeout);

  // BOOTSTRAP FUNCTIONS ------------------------------------------- //

  it('should merge the options and local.js correctly', async function() {
    let apos;
    try {
      apos = await require('../index.js')({
        root: module,
        shortName: 'test',
        overrideTest: 'test', // overriden by data/local.js
        argv: {
          _: []
        },
        __testDefaults: {
          modules: {}
        }
      });
      assert(apos.options.overrideTest === 'foo');
    } finally {
      await t.destroy(apos);
    }
  });

  it('should accept a `__localPath` option and invoke local.js as a function if it is provided as one', async function() {
    let apos;
    try {
      apos = await require('../index.js')({
        root: module,
        argv: {
          _: []
        },
        shortName: 'test',
        overrideTest: 'test', // overriden by data/local_fn.js

        __localPath: '/data/local_fn.js',
        __testDefaults: {
          modules: {}
        }
      });
      assert(apos.options.overrideTest === 'foo');
    } finally {
      await t.destroy(apos);
    }
  });

  it('should invoke local.js as a function with the apos and config object', async function() {
    let apos;
    try {
      apos = await require('../index.js')({
        root: module,
        argv: {
          _: []
        },
        shortName: 'test',
        overrideTest: 'test', // concated in local_fn_b.js

        __localPath: '/data/local_fn_b.js',
        __testDefaults: {
          modules: {}
        }
      });
      assert(apos.options.overrideTest === 'test-foo');
    } finally {
      await t.destroy(apos);
    }
  });

  it('should accept a `__testDefaults` option and load the test modules correctly', async function() {
    let apos;
    try {
      apos = await require('../index.js')({
        root: module,
        argv: {
          _: []
        },
        shortName: 'test',

        __testDefaults: {
          modules: {
            '@apostrophecms/test-module': {}
          }
        }
      });
      assert(apos.modules['@apostrophecms/test-module']);
    } finally {
      await t.destroy(apos);
    }
  });

  it('should create the modules and invoke the construct function correctly', async function() {
    let apos;
    try {
      apos = await require('../index.js')({
        root: module,
        argv: {
          _: []
        },
        shortName: 'test',
        __testDefaults: {
          modules: {
            '@apostrophecms/test-module': {}
          }
        }
      });
      assert(apos.test && apos.test.color === 'red');
    } finally {
      await t.destroy(apos);
    }
  });

  it('should load the default modules and implicitly subclass the base module correctly', async function() {
    let apos;
    try {
      let defaultModules = require('../defaults.js').modules;

      apos = await require('../index.js')({
        root: module,
        argv: {
          _: []
        },
        shortName: 'test'
      });
      // color = blue is inherited from our implicit subclass of the base module
      assert(apos.assets && apos.assets.color === 'blue');
      // make sure that our modules match what is specifed in defaults.js
      assert(_.difference(_.keys(defaultModules), _.keys(apos.modules)).length === 0);
    } finally {
      await t.destroy(apos);
    }
  });
});
