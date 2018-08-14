var path = require('path');
var _ = require('@sailshq/lodash');
var argv = require('yargs').argv;
var fs = require('fs');
var async = require('async');
var npmResolve = require('resolve');
var defaults = require('./defaults.js');

module.exports = function(options) {

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
    var moduleDir = testDir.replace(/\/tests?$/, '');
    if (testDir === moduleDir) {
      throw new Error('Test file must be in test/ or tests/ subdirectory of module');
    }
    if (!fs.existsSync(testDir + '/node_modules')) {
      fs.mkdirSync(testDir + '/node_modules');
      fs.symlinkSync(moduleDir, testDir + '/node_modules/' + require('path').basename(moduleDir), 'dir');
    }

    // Not quite superfluous: it'll return self.root, but
    // it also makes sure we encounter mocha along the way
    // and throws an exception if we don't
    function findTestModule() {
      var m = module;
      while (m) {
        if (m.parent && m.parent.filename.match(/node_modules\/mocha/)) {
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

    var synth = require('moog-require')({
      root: self.root,
      bundles: [ 'apostrophe' ].concat(self.options.bundles || []),
      localModules: self.options.modulesSubdir || self.options.__testLocalModules || (self.rootDir + '/lib/modules'),
      defaultBaseClass: 'apostrophe-module'
    });

    self.synth = synth;

    // Just like on the browser side, we can
    // call apos.define rather than apos.synth.define
    self.define = self.synth.define;
    self.redefine = self.synth.redefine;
    self.create = self.synth.create;

    _.each(self.options.modules, function(options, name) {
      synth.define(name, options);
    });

    return synth;
  }

  function instantiateModules(callback) {
    self.modules = {};
    return async.eachSeries(_.keys(self.options.modules), function(item, callback) {
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
    return self.callAllAndEmit('modulesReady', 'modulesReady', callback);
  }

  function modulesAfterInit(callback) {
    return self.callAllAndEmit('afterInit', 'afterInit', callback);
  }

  function afterInit(callback) {
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
