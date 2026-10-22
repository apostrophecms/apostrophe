// Same darn tests but loading package.json via searching up the tree,
// to verify that feature

const assert = require('assert');
const path = require('path');

// console.log = function(s) {
//   console.trace(s);
// };

describe('moog', function() {

  describe('synth', function() {
    it('exists', function() {
      assert( require('../../index.js') );
    });

    var synth = require('../../index.js')({
      localModules: __dirname + '/../project_modules',
      root: module
    });

    it('has a `create` method', function() {
      assert(synth.create);
    });
    it('has a `createAll` method', function() {
      assert(synth.createAll);
    });
    it('has a `bridge` method', function() {
      assert(synth.bridge);
    });
  });

  describe('synth.create', function() {
    var synth;

    it('should create a subclass with no options', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': { }
      });

      synth.create('testModule', {}, function(err, testModule) {
        assert(!err);
        assert(testModule);
        assert(testModule._options.color === 'blue');
        return done();
      });
    });

    it('should create a subclass with overrides of default options', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': {
          color: 'red'
        }
      });

      synth.create('testModule', {}, function(err, testModule) {
        assert(!err);
        assert(testModule._options.color === 'red');
        return done();
      });
    });

    it('should create a subclass with overrides of default options in localModules folder and npm', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
          // testModuleTwo is defined in ./../project_modules and
          // ./node_modules
          'testModuleTwo': { }
        }
      );

      synth.create('testModuleTwo', {}, function(err, testModuleTwo) {
        assert(!err);
        assert(testModuleTwo._options.color === 'red');
        return done();
      });
    });

    it('should create a subclass with overrides of default options at runtime', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': { }
      });

      synth.create('testModule', { color: 'purple' }, function(err, testModule) {
        assert(!err);
        assert(testModule._options.color === 'purple');
        return done();
      });
    });

    it('should create a subclass with a new name using the `extend` property', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'myTestModuleExtend': {
          extend: 'testModule',
          color: 'red'
        }
      });

      synth.create('myTestModuleExtend', {}, function(err, myTestModule) {
        if (err) {
          console.error(err);
        }
        assert(!err);
        assert(myTestModule);
        assert(myTestModule._options.color === 'red');
        return done();
      });
    });

    it('should create a subclass with a new name by extending a module defined in localModules', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'myTestModule': {
          extend: 'testModuleLocalOnly',
          newProperty: 42
        }
      });

      synth.create('myTestModule', {}, function(err, myTestModule) {
        assert(!err);
        assert(myTestModule);
        assert(myTestModule._options.color === 'purple');
        assert(myTestModule._options.newProperty === 42);
        return done();
      });
    });

    it('should create a subclass of a subclass', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'myTestModule': {
          extend: 'testModule'
        },
        'mySubTestModule': {
          extend: 'myTestModule',
          color: 'orange'
        }
      });

      synth.create('myTestModule', {}, function(err, myTestModule) {
        assert(!err);
        assert(myTestModule);
        assert(myTestModule._options.color === 'blue');
        synth.create('mySubTestModule', {}, function(err, mySubTestModule) {
          assert(!err);
          assert(mySubTestModule);
          assert(mySubTestModule._options.color === 'orange');
          return done();
        });
      });
    });

    it('should create a subclass when both parent and subclass are in npm', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModuleThree': {}
      });

      synth.create('testModuleThree', {}, function(err, testModuleThree) {
        if (err) {
          console.error(err);
        }
        assert(!err);
        assert(testModuleThree);
        assert(testModuleThree._options.age === 30);
        return done();
      });
    });

  });


  describe('synth.createAll', function() {
    var synth;

    it('should create two subclasses', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': { },
        'testModuleTwo': { }
      });

      synth.createAll({}, {}, function(err, modules) {
        assert(!err);
        assert(modules.testModule);
        assert(modules.testModuleTwo);
        return done();
      });
    });

    it('should create two subclasses with runtime options passed using `specific` options', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': { },
        'testModuleTwo': { }
      });

      synth.createAll({}, {
        testModule: { color: 'green' },
        testModuleTwo: { color: 'green' }
      }, function(err, modules) {
        assert(!err);
        assert(modules.testModule);
        assert(modules.testModule._options.color === 'green');
        assert(modules.testModuleTwo);
        assert(modules.testModuleTwo._options.color === 'green');
        return done();
      });
    });

    it('should create two subclasses with runtime options passed using `global` options', function(done) {
      synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': { },
        'testModuleTwo': { }
      });

      synth.createAll({ color: 'green' }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testModule);
        assert(modules.testModule._options.color === 'green');
        assert(modules.testModuleTwo);
        assert(modules.testModuleTwo._options.color === 'green');
        return done();
      });
    });
  });

  describe('synth.bridge', function() {
    it('should run successfully', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': { },
        'testModuleTwo': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        synth.bridge(modules);
        assert(!err);
        assert(modules.testModule);
        assert(modules.testModuleTwo);
        return done();
      });
    });

    it('should pass modules to each other', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': {
          construct: function(self, options) {
            self.setBridge = function(modules) {
              self.otherModule = modules.testModuleTwo;
            };
          }
        },
        'testModuleTwo': {
          construct: function(self, options) {
            self.setBridge = function(modules) {
              self.otherModule = modules.testModule;
            };
          }
        }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        synth.bridge(modules);
        assert(modules.testModule.otherModule);
        assert(modules.testModuleTwo.otherModule);
        return done();
      });
    });
  });

  describe('module structure', function() {

    it('should accept a `defaultBaseClass` that is inherited by empty definitions', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        defaultBaseClass: 'testModule',
        root: module
      });

      synth.define({
        'newModule': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.newModule);
        assert(modules.newModule._options.color === 'blue');
        return done();
      });
    });

    // =================================================================
    // PASSING
    // =================================================================

    it('should accept a synchronous `construct` method', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testModule);
        return done();
      });
    });

    it('should accept an asynchronous `construct` method', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModuleTwo': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testModuleTwo);
        return done();
      });
    });

    it('should accept a synchronous `beforeConstruct` method', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testModule': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testModule);
        return done();
      });
    });

    it('should accept an asynchronous `beforeConstruct` method', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testBeforeConstructAsync': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testBeforeConstructAsync);
        return done();
      });
    });

    // =================================================================
    // FAILING
    // =================================================================

    it('should catch a synchronous Error during `construct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'failingModuleSync': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(err);
        assert(err.message === 'I have failed.');
        return done();
      });
    });

    it('should catch an asynchronous Error during `construct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'failingModuleAsync': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(err);
        assert(err.message === 'I have failed.');
        return done();
      });
    });

    it('should catch a synchronous Error during `beforeConstruct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'failingBeforeConstructSync': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(err);
        assert(err.message === 'I have failed.');
        return done();
      });
    });

    it('should catch an asynchronous Error during `beforeConstruct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'failingBeforeConstructAsync': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(err);
        assert(err.message === 'I have failed.');
        return done();
      });
    });
  });

  describe('order of operations', function() {

    // =================================================================
    // MULTIPLE `construct`s AND `beforeConstruct`s
    // =================================================================

    it('should call both the project-level `construct` and the npm module\'s `construct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testDifferentConstruct': {
          extend: 'testModule'
        }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testDifferentConstruct._options);
        assert(modules.testDifferentConstruct._differentOptions);
        return done();
      });
    });

    it('should call both the project-level `beforeConstruct` and the npm module\'s `beforeConstruct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testDifferentConstruct': {
          extend: 'testModule'
        }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testDifferentConstruct._bcOptions);
        assert(modules.testDifferentConstruct._bcDifferentOptions);
        return done();
      });
    });

    it('should override the project-level `construct` using a definitions-level `construct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testDifferentConstruct': {
          extend: 'testModule',
          construct: function(self, options) {
            self._definitionsLevelOptions = options;
          }
        }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testDifferentConstruct._options);
        assert(!modules.testDifferentConstruct._differentOptions);
        assert(modules.testDifferentConstruct._definitionsLevelOptions);
        return done();
      });
    });

    it('should override the project-level `beforeConstruct` using a definitions-level `beforeConstruct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testDifferentConstruct': {
          extend: 'testModule',
          beforeConstruct: function(self, options) {
            self._bcDefinitionsLevelOptions = options;
          }
        }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testDifferentConstruct._bcOptions);
        assert(!modules.testDifferentConstruct._bcDifferentOptions);
        assert(modules.testDifferentConstruct._bcDefinitionsLevelOptions);
        return done();
      });
    });

    // =================================================================
    // ORDER OF OPERATIONS
    // =================================================================

    it('should respect baseClass-first order-of-operations for `beforeConstruct` and `construct`', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'testOrderOfOperations': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.testOrderOfOperations._bcOrderOfOperations[0] === 'notlast');
        assert(modules.testOrderOfOperations._bcOrderOfOperations[1] === 'last');
        assert(modules.testOrderOfOperations._orderOfOperations[0] === 'first');
        assert(modules.testOrderOfOperations._orderOfOperations[1] === 'second');
        return done();
      });
    });

    it('should respect baseClass-first order-of-operations for `beforeConstruct` and `construct` with subclassing', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'subTestOrderOfOperations': {
          extend: 'testOrderOfOperations',
          beforeConstruct: function(self, options) {
            self._bcOrderOfOperations = (self._bcOrderOfOperations || []).concat('first');
          },
          construct: function(self, options) {
            self._orderOfOperations = (self._orderOfOperations || []).concat('third');
          }
        }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.subTestOrderOfOperations._bcOrderOfOperations[0] === 'first');
        assert(modules.subTestOrderOfOperations._bcOrderOfOperations[1] === 'notlast');
        assert(modules.subTestOrderOfOperations._bcOrderOfOperations[2] === 'last');
        assert(modules.subTestOrderOfOperations._orderOfOperations[0] === 'first');
        assert(modules.subTestOrderOfOperations._orderOfOperations[1] === 'second');
        assert(modules.subTestOrderOfOperations._orderOfOperations[2] === 'third');
        return done();
      });
    });
  });

  describe('bundles', function() {
    it('should expose two new modules via a bundle', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module,
        bundles: ['testBundle']
      });

      synth.define({
        'bundleModuleOne': { },
        'bundleModuleTwo': { }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(!err);
        assert(modules.bundleModuleOne);
        assert(modules.bundleModuleOne._options.color === 'blue');
        assert(modules.bundleModuleTwo);
        assert(modules.bundleModuleTwo._options.color === 'blue');
        return done();
      });
    });
  });

  describe('metadata', function() {
    it('should expose correct dirname metadata for npm, project level, and explicitly defined classes in the chain', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define('metadataExplicit', {
        color: 'red',
        extend: 'metadataProject'
      });

      synth.create('metadataExplicit', { }, function(err, module) {
        if (err) {
          console.error(err);
        }
        assert(!err);
        assert(module);
        assert(module.__meta);
        assert(module.__meta.chain);
        assert(module.__meta.chain[0]);
        assert(module.__meta.chain[0].dirname === path.dirname(__dirname) + '/node_modules/metadataNpm');
        assert(module.__meta.chain[1]);
        assert(module.__meta.chain[1].dirname === __dirname + '/../project_modules/metadataNpm');
        assert(module.__meta.chain[2]);
        assert(module.__meta.chain[2].dirname === __dirname + '/../project_modules/metadataProject');
        assert(module.__meta.chain[3]);
        assert(module.__meta.chain[3].dirname === __dirname + '/../project_modules/metadataExplicit');
        return done();
      });
    });
  });

  describe('error handling', function() {
    it('should prevent cyclical module definitions', function(done) {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });

      synth.define({
        'myNewModuleOne': {
          extend: 'myNewModuleTwo'
        },
        'myNewModuleTwo': {
          extend: 'myNewModuleOne'
        }
      });

      synth.createAll({ }, { }, function(err, modules) {
        assert(err);
        return done();
      });
    });
  });

  describe('replace option', function() {
    it('should substitute a replacement type when replace option is used', function() {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });
      synth.define('replaceTestOriginal');
      synth.define('replaceTestReplacement');
      var instance = synth.create('replaceTestOriginal', {});
      assert(instance._options);
      assert(!instance._options.color);
      assert(instance._options.size === 'large');
    });
  });

  describe('improve option', function() {
    it('should substitute an implicit subclass when improve option is used', function() {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });
      synth.define('improveTestOriginal');
      synth.define('improveTestReplacement');
      var instance = synth.create('improveTestOriginal', {});
      assert(instance._options);
      assert(instance._options.color === 'red');
      assert(instance._options.size === 'large');
    });
    it('should require the original for you if needed', function() {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });
      synth.define('improveTestReplacement');
      var instance = synth.create('improveTestOriginal', {});
      assert(instance._options);
      assert(instance._options.color === 'red');
      assert(instance._options.size === 'large');
    });
  });

  describe('nestedModuleSubdirs option', function() {
    it('should load a module from a regular folder without the nesting feature enabled', function() {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        root: module
      });
      synth.define('testModuleSimple');
      var instance = synth.create('testModuleSimple', {});
      assert(instance._options);
      assert(instance._options.color === 'red');
    });
    it('should load a module from a nested or non-nested folder with the nesting option enabled', function() {
      var synth = require('../../index.js')({
        localModules: __dirname + '/../project_modules',
        nestedModuleSubdirs: true,
        root: module
      });
      synth.define('testModuleSimple');
      var instance = synth.create('testModuleSimple', {});
      assert(instance._options);
      assert(instance._options.color === 'red');
      synth.define('nestedModule');
      var instance = synth.create('nestedModule', {});
      assert(instance._options);
      assert(instance._options.color === 'green');
    });
  });
  it('should load a project level module properly when a transitive dependency not in package.json nevertheless has the same name and appears in node_modules', function() {
    var synth = require('../../index.js')({
      localModules: __dirname + '/../project_modules',
      root: module
    });
    synth.define('sameNameAsTransitiveDependency');
    var instance = synth.create('sameNameAsTransitiveDependency', {});
    assert(instance.confirm === 'loaded');
  });
});
