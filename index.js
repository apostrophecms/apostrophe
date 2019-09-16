// Use of console permitted here because we sometimes need to
// print something before the utils module exists. -Tom

/* eslint no-console: 0 */

var path = require('path');
var _ = require('@sailshq/lodash');
var argv = require('yargs').argv;
var fs = require('fs');
var async = require('async');
var npmResolve = require('resolve');
var defaults = require('./defaults.js');
var glob = require('glob');

module.exports = function(options) {

  traceStartup('begin');

  // The core is not a true moog object but it must look enough like one
  // to participate as a promise event emitter
  var self = {
    __meta: {
      name: 'apostrophe'
    }
  };

  // The core must have a reference to itself in order to use the
  // promise event emitter code
  self.apos = self;

  require('./lib/modules/apostrophe-module/lib/events.js')(self, options);

  try {
    // Determine root module and root directory
    self.root = options.root || getRoot();
    self.rootDir = options.rootDir || path.dirname(self.root.filename);
    self.npmRootDir = options.npmRootDir || self.rootDir;

    testModule();

    self.options = mergeConfiguration(options, defaults);
    autodetectBundles();
    acceptGlobalOptions();

    // Legacy events
    self.handlers = {};

    // Module-based, promisified events (self.on and self.emit of each module)
    self.eventHandlers = {};

    traceStartup('defineModules');
    defineModules();
  } catch (err) {
    if (options.initFailed) {
      // Report error in an extensible way
      return options.initFailed(err);
    } else {
      throw err;
    }
  }

  // No return statement here because we need to
  // return "self" after kicking this process off

  async.series([
    instantiateModules,
    modulesReady,
    modulesAfterInit,
    lintModules,
    migrate,
    afterInit
  ], function(err) {
    if (err) {
      if (options.initFailed) {
        // Report error in an extensible way
        return options.initFailed(err);
      } else {
        throw err;
      }
    }
    traceStartup('startup end');
    if (self.argv._.length) {
      self.emit('runTask');
    } else {
      // The apostrophe-express module adds this method
      self.listen();
    }
  });

  // EVENT HANDLING (legacy events)
  //
  // apos.emit(eventName, /* arg1, arg2, arg3... */)
  //
  // Emit an Apostrophe legacy event. All handlers that have been set
  // with apos.on for the same eventName will be invoked. Any additional
  // arguments are received by the handler functions as arguments.
  //
  // See the `self.on` and `self.emit` methods of all modules
  // (via the `apostrophe-module`) base class for a better,
  // promisified event system.

  self.emit = function(eventName /* ,arg1, arg2, arg3... */) {
    var handlers = self.handlers[eventName];
    if (!handlers) {
      return;
    }
    var args = Array.prototype.slice.call(arguments, 1);
    var i;
    for (i = 0; (i < handlers.length); i++) {
      handlers[i].apply(self, args);
    }
  };

  // Install an Apostrophe legacy event handler. The handler will be called
  // when apos.emit is invoked with the same eventName. The handler
  // will receive any additional arguments passed to apos.emit.
  //
  // See the `self.on` and `self.emit` methods of all modules
  // (via the `apostrophe-module`) base class for a better,
  // promisified event system.

  self.on = function(eventName, fn) {
    self.handlers[eventName] = (self.handlers[eventName] || []).concat([ fn ]);
  };

  // Remove an Apostrophe event handler. If fn is not supplied, all
  // handlers for the given eventName are removed.
  self.off = function(eventName, fn) {
    if (!fn) {
      delete self.handlers[eventName];
      return;
    }
    self.handlers[eventName] = _.filter(self.handlers[eventName], function(_fn) {
      return fn !== _fn;
    });
  };

  // Legacy feature only. New code should call the `emit` method of the
  // relevant module to implement a promise event instead. Will be removed
  // in 3.x.
  //
  // For every module, if the method `method` exists,
  // invoke it. The method may optionally take a callback.
  // The method must take exactly as many additional
  // arguments as are passed here between `method`
  // and the final `callback`.

  self.callAll = function(method, /* argument, ... */ callback) {
    var args = Array.prototype.slice.call(arguments);
    var extraArgs = args.slice(1, args.length - 1);
    callback = args[args.length - 1];
    return async.eachSeries(_.keys(self.modules), function(name, callback) {
      return invoke(name, method, extraArgs, callback);
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null);
    });
  };

  /**
   * Allow to bind a callAll method for one module. Legacy feature.
   * Use promise events instead.
   */
  self.callOne = function(moduleName, method, /* argument, ... */ callback) {
    var args = Array.prototype.slice.call(arguments);
    var extraArgs = args.slice(2, args.length - 1);
    callback = args[args.length - 1];
    return invoke(moduleName, method, extraArgs, callback);
  };

  // Destroys the Apostrophe object, freeing resources such as
  // HTTP server ports and database connections. Does **not**
  // delete any data; the persistent database and media files
  // remain available for the next startup. Invokes
  // the `apostropheDestroy` methods of all modules that
  // provide one, and also emits the `destroy` promise event on
  // the `apostrophe` module; use this mechanism to free your own
  // server-side resources that could prevent garbage
  // collection by the JavaScript engine, such as timers
  // and intervals.
  self.destroy = function(callback) {
    return self.callAllAndEmit('apostropheDestroy', 'destroy', callback);
  };

  // Returns true if Apostrophe is running as a command line task
  // rather than as a server
  self.isTask = function() {
    return !!self.argv._.length;
  };

  // Returns an array of modules that are instances of the given
  // module name, i.e. they are of that type or they extend it.
  // For instance, `apos.instancesOf('apostrophe-pieces')` returns
  // an array of active modules in your project that extend
  // pieces, such as `apostrophe-users`, `apostrophe-groups` and
  // your own piece types

  self.instancesOf = function(name) {
    return _.filter(self.modules, function(module) {
      return self.synth.instanceOf(module, name);
    });
  };

  // Returns true if the object is an instance of the given
  // moog type name or a subclass thereof. A convenience wrapper
  // for `apos.synth.instanceOf`

  self.instanceOf = function(object, name) {
    return self.synth.instanceOf(object, name);
  };

  // Return self so that app.js can refer to apos
  // in inline functions, etc.
  return self;

  // SUPPORTING FUNCTIONS BEGIN HERE

  // Merge configuration from defaults, data/local.js and app.js
  function mergeConfiguration(options, defaults) {
    var config = {};
    var local = {};
    var localPath = options.__localPath || '/data/local.js';
    var reallyLocalPath = self.rootDir + localPath;

    if (fs.existsSync(reallyLocalPath)) {
      local = require(reallyLocalPath);
    }

    // Otherwise making a second apos instance
    // uses the same modified defaults object

    config = _.cloneDeep(options.__testDefaults || defaults);

    _.merge(config, options);

    if (typeof (local) === 'function') {
      if (local.length === 1) {
        _.merge(config, local(self));
      } else if (local.length === 2) {
        local(self, config);
      } else {
        throw new Error('data/local.js may export an object, a function that takes apos as an argument and returns an object, OR a function that takes apos and config as objects and directly modifies config');
      }
    } else {
      _.merge(config, local || {});
    }

    return config;
  }

  function getRoot() {
    var _module = module;
    var m = _module;
    while (m.parent) {
      // The test file is the root as far as we are concerned,
      // not mocha itself
      if (m.parent.filename.match(/\/node_modules\/mocha\//)) {
        return m;
      }
      m = m.parent;
      _module = m;
    }
    return _module;
  }

  function nestedModuleSubdirs() {
    if (!options.nestedModuleSubdirs) {
      return;
    }
    var configs = glob.sync(self.moogOptions.localModules + '/**/modules.js');
    _.each(configs, function(config) {
      try {
        _.merge(self.options.modules, require(config));
      } catch (e) {
        console.error('When nestedModuleSubdirs is active, any modules.js file beneath ' + self.moogOptions.localModules + '\nmust export an object containing configuration for Apostrophe modules.\nThe file ' + config + ' did not parse.');
        throw e;
      }
    });
  }

  function autodetectBundles() {
    var modules = _.keys(self.options.modules);
    _.each(modules, function(name) {
      var path = getNpmPath(name);
      if (!path) {
        return;
      }
      var module = require(path);
      if (module.moogBundle) {
        self.options.bundles = (self.options.bundles || []).concat(name);
        _.each(module.moogBundle.modules, function(name) {
          if (!_.has(self.options.modules, name)) {
            var bundledModule = require(require('path').dirname(path) + '/' + module.moogBundle.directory + '/' + name);
            if (bundledModule.improve) {
              self.options.modules[name] = {};
            }
          }
        });
      }
    });
  }

  function getNpmPath(name) {
    var parentPath = path.resolve(self.npmRootDir);
    try {
      return npmResolve.sync(name, { basedir: parentPath });
    } catch (e) {
      // Not found via npm. This does not mean it doesn't
      // exist as a project-level thing
      return null;
    }
  }

  function acceptGlobalOptions() {
    // Truly global options not specific to a module
    if (options.testModule) {
      // Test command lines have arguments not
      // intended as command line task arguments
      self.argv = {
        _: []
      };
      self.options.shortName = self.options.shortName || 'test';
    } else if (options.argv) {
      // Allow injection of any set of command line arguments.
      // Useful with multiple instances
      self.argv = options.argv;
    } else {
      self.argv = argv;
    }

    self.shortName = self.options.shortName;
    if (!self.shortName) {
      throw "Specify the `shortName` option and set it to the name of your project's repository or folder";
    }
    self.title = self.options.title;
    self.baseUrl = self.options.baseUrl;
    self.prefix = self.options.prefix || '';
  }

  // Tweak the Apostrophe environment suitably for
  // unit testing a separate npm module that extends
  // Apostrophe, like apostrophe-workflow. For instance,
  // a node_modules subdirectory with a symlink to the
  // module itself is created so that the module can
  // be found by Apostrophe during testing. Invoked
  // when options.testModule is true. There must be a
  // test/ or tests/ subdir of the module containing
  // a test.js file that runs under mocha via devDependencies.

  function testModule() {
    if (!options.testModule) {
      return;
    }
    if (!options.shortName) {
      options.shortName = 'test';
    }
    defaults = _.cloneDeep(defaults);
    _.defaults(defaults, {
      'apostrophe-express': {}
    });
    _.defaults(defaults['apostrophe-express'], {
      port: 7900,
      secret: 'irrelevant'
    });
    var m = findTestModule();
    // Allow tests to be in test/ or in tests/
    var testDir = require('path').dirname(m.filename);
    var testRegex;
    if (process.platform === "win32") {
      testRegex = /\\tests?$/;
    } else {
      testRegex = /\/tests?$/;
    }
    var moduleDir = testDir.replace(testRegex, '');
    if (testDir === moduleDir) {
      throw new Error('Test file must be in test/ or tests/ subdirectory of module');
    }
    var moduleName = require('path').basename(moduleDir);
    try {
      // Use the given name in the package.json file if it is present
      var packageName = JSON.parse(fs.readFileSync(path.resolve(moduleDir, 'package.json'), 'utf8')).name;
      if (typeof packageName === 'string') {
        moduleName = packageName;
      }
    } catch (e) {}
    var testDependenciesDir = testDir + require("path").normalize('/node_modules/');
    if (!fs.existsSync(testDependenciesDir + moduleName)) {
      // Ensure dependencies directory exists
      if (!fs.existsSync(testDependenciesDir)) {
        fs.mkdirSync(testDependenciesDir);
      }
      // Ensure potential module scope directory exists before the symlink creation
      if (moduleName.charAt(0) === '@' && moduleName.includes(require("path").sep)) {
        var scope = moduleName.split(require("path").sep)[0];
        var scopeDir = testDependenciesDir + scope;
        if (!fs.existsSync(scopeDir)) {
          fs.mkdirSync(scopeDir);
        }
      }
      // Windows 10 got an issue with permission , known issue at https://github.com/nodejs/node/issues/18518
      // Therefore need to have if else statement to determine type of symlinkSync uses.
      var type;
      if (process.platform === "win32") {
        type = "junction";
      } else {
        type = "dir";
      }
      fs.symlinkSync(moduleDir, testDependenciesDir + moduleName, type);
    }

    // Not quite superfluous: it'll return self.root, but
    // it also makes sure we encounter mocha along the way
    // and throws an exception if we don't
    function findTestModule() {
      var m = module;
      var nodeModuleRegex;
      if (process.platform === "win32") {
        nodeModuleRegex = /node_modules\\mocha/;
      } else {
        nodeModuleRegex = /node_modules\/mocha/;
      }
      while (m) {
        if (m.parent && m.parent.filename.match(nodeModuleRegex)) {
          return m;
        }
        m = m.parent;
        if (!m) {
          throw new Error('mocha does not seem to be running, is this really a test?');
        }
      }
    }
  }

  function defineModules() {
    // Set moog-require up to create our module manager objects

    self.moogOptions = {
      root: self.root,
      bundles: [ 'apostrophe' ].concat(self.options.bundles || []),
      localModules: self.options.modulesSubdir || self.options.__testLocalModules || (self.rootDir + '/lib/modules'),
      defaultBaseClass: 'apostrophe-module',
      nestedModuleSubdirs: self.options.nestedModuleSubdirs
    };
    var synth = require('moog-require')(self.moogOptions);

    self.synth = synth;

    // Just like on the browser side, we can
    // call apos.define rather than apos.synth.define
    self.define = self.synth.define;
    self.redefine = self.synth.redefine;
    self.create = self.synth.create;

    nestedModuleSubdirs();

    _.each(self.options.modules, function(options, name) {
      synth.define(name, options);
    });

    return synth;
  }

  function instantiateModules(callback) {
    traceStartup('instantiateModules');
    self.modules = {};
    return async.eachSeries(_.keys(self.options.modules), function(item, callback) {
      traceStartup('Instantiating module ' + item);
      var improvement = self.synth.isImprovement(item);
      if (self.options.modules[item] && (improvement || self.options.modules[item].instantiate === false)) {
        // We don't want an actual instance of this module, we are using it
        // as an abstract base class in this particular project (but still
        // configuring it, to easily carry those options to subclasses, which
        // is how we got here)
        return setImmediate(callback);
      }
      return self.synth.create(item, { apos: self }, function(err, obj) {
        if (err) {
          return callback(err);
        }
        return callback(null);
      });
    }, function(err) {
      return setImmediate(function() {
        return callback(err);
      });
    });
  }

  function modulesReady(callback) {
    traceStartup('modulesReady');
    return self.callAllAndEmit('modulesReady', 'modulesReady', callback);
  }

  function modulesAfterInit(callback) {
    traceStartup('modulesAfterInit');
    return self.callAllAndEmit('afterInit', 'afterInit', callback);
  }

  function lintModules(callback) {
    traceStartup('lintModules');
    _.each(self.modules, function(module, name) {
      if (module.options.extends && ((typeof module.options.extends) === 'string')) {
        lint('The module ' + name + ' contains an "extends" option. This is probably a\nmistake. In Apostrophe "extend" is used to extend other modules.');
      }
      if (module.options.singletonWarningIfNot && (name !== module.options.singletonWarningIfNot)) {
        lint('The module ' + name + ' extends ' + module.options.singletonWarningIfNot + ', which is normally\na singleton (Apostrophe creates only one instance of it). Two competing\ninstances will lead to problems. If you are adding project-level code to it,\njust use lib/modules/' + module.options.singletonWarningIfNot + '/index.js and do not use "extend".\nIf you are improving it via an npm module, use "improve" rather than "extend".\nIf neither situation applies you should probably just make a new module that does\nnot extend anything.\n\nIf you are sure you know what you are doing, you can set the\nsingletonWarningIfNot: false option for this module.');
      }
      if (name.match(/-widgets$/) && (!extending(module)) && (!module.options.ignoreNoExtendWarning)) {
        lint('The module ' + name + ' does not extend anything.\n\nA `-widgets` module usually extends `apostrophe-widgets` or\n`apostrophe-pieces-widgets`. Or possibly you forgot to npm install something.\n\nIf you are sure you are doing the right thing, set the\n`ignoreNoExtendWarning` option to `true` for this module.');
      } else if (name.match(/-pages$/) && (name !== 'apostrophe-pages') && (!extending(module)) && (!module.options.ignoreNoExtendWarning)) {
        lint('The module ' + name + ' does not extend anything.\n\nA `-pages` module usually extends `apostrophe-custom-pages` or\n`apostrophe-pieces-pages`. Or possibly you forgot to npm install something.\n\nIf you are sure you are doing the right thing, set the\n`ignoreNoExtendWarning` option to `true` for this module.');
      } else if ((!extending(module)) && (!hasConstruct(name)) && (!isMoogBundle(name)) && (!module.options.ignoreNoCodeWarning)) {
        lint('The module ' + name + ' does not extend anything and does not have a\n`beforeConstruct`, `construct` or `afterConstruct` function. This usually means that you:\n\n1. Forgot to `extend` another module\n2. Configured a module that comes from npm without npm installing it\n3. Simply haven\'t written your `index.js` yet\n\nIf you really want a module with no code, set the `ignoreNoCodeWarning` option\nto `true` for this module.');
      }
    });
    function hasConstruct(name) {
      var d = self.synth.definitions[name];
      if (d.construct) {
        // Module definition at project level has construct
        return true;
      }
      if (self.synth.isMy(d.__meta.name)) {
        // None at project level, but maybe at npm level, look there
        d = d.extend;
      }
      // If we got to the base class of all modules, the module
      // has no construct of its own
      if (d.__meta.name.match(/apostrophe-module$/)) {
        return false;
      }
      return d.beforeConstruct || d.construct || d.afterConstruct;
    }
    function isMoogBundle(name) {
      var d = self.synth.definitions[name];
      return d.moogBundle || (d.extend && d.extend.moogBundle);
    }
    function extending(module) {
      // If the module extends no other module, then it will
      // have up to four entries in its inheritance chain:
      // project level self, npm level self, `apostrophe-modules`
      // project-level and `apostrophe-modules` npm level.
      return module.__meta.chain.length > 4;
    }
    return callback(null);
  }

  function migrate(callback) {
    traceStartup('migrate');
    if (self.argv._[0] === 'apostrophe-migrations:migrate') {
      // Migration task will do this later with custom arguments to
      // the event
      return callback(null);
    }
    // Allow the migrate-at-startup behavior to be complete shut off, including
    // parked page checks, etc. In this case you are obligated to run the
    // apostrophe-migrations:migrate task during deployment before launching
    // with new versions of the code
    if (process.env.APOS_NO_MIGRATE || (self.options.migrate === false)) {
      return callback(null);
    }
    // Carry out all migrations and consistency checks of the database that are
    // still pending before proceeding to listen for connections or run tasks
    // that assume a sane environment. If `apostrophe-migrations:migrate` has
    // already been run then this will typically find no work to do, although
    // the consistency checks can take time on a very large distributed database
    // (see the options above).
    return self.promiseEmit('migrate', {}).then(function() {
      return callback(null);
    }).catch(callback);
  }

  function lint(s) {
    self.utils.warnDev('\n⚠️  It looks like you may have made a mistake in your code:\n\n' + s + '\n');
  }

  function afterInit(callback) {
    traceStartup('afterInit');
    // Give project-level code a chance to run before we
    // listen or run a task
    if (!self.options.afterInit) {
      return setImmediate(callback);
    }
    return self.options.afterInit(callback);
  }

  // Generic helper for call* methods
  function invoke(moduleName, method, extraArgs, callback) {
    var module = self.modules[moduleName];
    var invoke = module[method];
    if (invoke) {
      if (invoke.length === (1 + extraArgs.length)) {
        return invoke.apply(module, extraArgs.concat([callback]));
      } else if (invoke.length === extraArgs.length) {
        return setImmediate(function () {
          try {
            invoke.apply(module, extraArgs);
          } catch (e) {
            return callback(e);
          }
          return callback(null);
        });
      } else {
        return callback(moduleName + ' module: your ' + method + ' method must take ' + extraArgs.length + ' arguments, plus an optional callback.');
      }
    } else {
      return setImmediate(callback);
    }
  }

};

var abstractClasses = [ 'apostrophe-module', 'apostrophe-widgets', 'apostrophe-custom-pages', 'apostrophe-pieces', 'apostrophe-pieces-pages', 'apostrophe-pieces-widgets', 'apostrophe-doc-type-manager' ];

module.exports.moogBundle = {
  modules: abstractClasses.concat(_.keys(defaults.modules)),
  directory: 'lib/modules'
};

function traceStartup(message) {
  if (process.env.APOS_TRACE_STARTUP) {
    /* eslint-disable-next-line no-console */
    console.debug('⌁ startup ' + message);
  }
}
