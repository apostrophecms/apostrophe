var path = require('path');
var _ = require('lodash');
var argv = require('yargs').argv;
var fs = require('fs');
var async = require('async');
var i18n = require('i18n');

var defaults = require('./defaults.js');

module.exports = function(options) {
  var self = {};

  // Determine root module and root directory
  self.root = options.root || getRoot();
  self.rootDir = options.rootDir || path.dirname(self.root.filename);

  self.options = mergeConfiguration(options, defaults);
  acceptGlobalOptions();

  self.handlers = {};

  // EVENT HANDLING
  //
  // apos.emit(eventName, /* arg1, arg2, arg3... */)
  //
  // Emit an Apostrophe event. All handlers that have been set
  // with apos.on for the same eventName will be invoked. Any additional
  // arguments are received by the handler functions as arguments.
  //
  // For bc, Apostrophe events are also triggered on the
  // body element via jQuery. The event name "ready" becomes
  // "aposReady" in jQuery. This feature will be removed in 0.6.
  //
  // CURRENT EVENTS
  //
  // 'enhance' is triggered to request progressive enhancement
  // of form elements newly loaded into the DOM.
  // It is most often listened for in admin modals.
  //
  // 'ready' is triggered when the main content area of the page
  // has been refreshed.

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

  // Install an Apostrophe event handler. The handler will be called
  // when apos.emit is invoked with the same eventName. The handler
  // will receive any additional arguments passed to apos.emit.

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

  /**
   * For every module, if the method `method` exists,
   * invoke it. The method may optionally take a callback.
   * The method must take exactly as many additional
   * arguments as are passed here between `method`
   * and the final `callback`.
   */
  self.callAll = function(method, /* argument, ... */ callback) {
    var args = Array.prototype.slice.call(arguments);
    var extraArgs = args.slice(1, args.length - 1);
    callback = args[args.length - 1];
    return async.eachSeries(_.keys(self.modules), function(name, callback) {
      var module = self.modules[name];
      var invoke = module[method];
      if (invoke) {
        if (invoke.length === (1 + extraArgs.length)) {
          return invoke.apply(module, extraArgs.concat([callback]));
        } else if (invoke.length === extraArgs.length) {
          return setImmediate(function() {
            try {
              invoke.apply(module, extraArgs);
            } catch (e) {
              return callback(e);
            }
            return callback(null);
          });
        } else {
          return callback(name + ' module: your ' + method + ' method must take ' + extraArgs.length + ' arguments, plus an optional callback.');
        }
      } else {
        return setImmediate(callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null);
    });
  };

  // Helper function for other modules to determine whether the application
  // is running as a server or a task
  self.isTask = function() {
    return !!self.argv._.length;
  };

  defineModules();

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
        // In the absence of a callback to handle initialization failure,
        // we have to assume there's just one instance of Apostrophe and
        // we can print the error and end the app.
        
        // Currently v8's err.stack property contains both the stack and the error message,
        // but that's weird and could be temporary, so if it ever changes, output both. -Tom
        if ((typeof(err.stack) !== 'string') || (err.stack.indexOf(err.toString()) === -1)) {
          console.error(err);
        }
        console.error(err.stack);
        process.exit(1);
      }
    }
    if (self.argv._.length) {
      self.emit('runTask');
    } else {
      // The apostrophe-express module adds this method
      self.listen();
    }
  });

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

    var config = _.cloneDeep(options.__testDefaults || defaults);

    var coreModules = _.cloneDeep(config.modules);

    _.merge(config, options);

    if (typeof(local) === 'function') {
      if (local.length === 1) {
        _.merge(config, local(self));
      } else if (local.length === 2) {
        local(self, config);
      } else {
        throw 'data/local.js may export an object, a function that takes apos as an argument and returns an object, OR a function that takes apos and config as objects and directly modifies config';
      }
    } else {
       _.merge(config, local || {});
    }

    return config;
  }

  function getRoot() {
    var m = module;
    while (m.parent) {
      m = m.parent;
      module = m;
    }
    return module;
  }

  function acceptGlobalOptions() {
    // Truly global options not specific to a module

    self.argv = argv;

    self.shortName = self.options.shortName;
    if (!self.shortName) {
      throw "Specify the `shortName` option and set it to the name of your project's repository or folder";
    }
    self.title = self.options.title;
    self.baseUrl = self.options.baseUrl;
    self.prefix = self.options.prefix || '';
  }

  function defineModules() {
    // Set moog-require up to create our module manager objects

    var synth = require('moog-require')({
      root: self.root,
      bundles: [ 'apostrophe' ].concat(self.options.bundles || []),
      localModules: self.options.__testLocalModules || (self.rootDir + '/lib/modules'),
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
          console.error('Error while constructing the ' + item + ' module');
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
    return self.callAll('modulesReady', callback);
  }

  function modulesAfterInit(callback) {
    return self.callAll('afterInit', callback);
  }

  function afterInit(callback) {
    // Give project-level code a chance to run before we
    // listen or run a task
    if (!self.options.afterInit) {
      return setImmediate(callback);
    }
    return self.options.afterInit(callback);
  }

};

var abstractClasses = [ 'apostrophe-module', 'apostrophe-widgets', 'apostrophe-custom-pages', 'apostrophe-pieces', 'apostrophe-pieces-pages', 'apostrophe-pieces-widgets', 'apostrophe-doc-type-manager' ];

module.exports.moogBundle = {
  modules: abstractClasses.concat(_.keys(defaults.modules)),
  directory: 'lib/modules'
};
