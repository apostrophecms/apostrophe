// An interesting tactic for finding rogue
// console.error calls
// var superError = console.error;
// console.error = function(s) {
//   if (s && s.chain) {
//     console.error = superError;
//     console.trace();
//     process.exit(1);
//   }
//   superError.call(console, s);
// }

// var superLog = console.log;
// console.log = function(s) {
//   if (s && s.match && s.match(/public\/uploads/)) {
//     console.log = superLog;
//     console.trace();
//     process.exit(1);
//   }
//   return superLog(s);
// };

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
  // of form elements newly loaded into the DOM (jQuery selectize).
  // It is typically used in admin modals.
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
      handlers[i].apply(window, args);
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
      throw err;
    }
    if (self.argv._.length) {
      console.log('run a task (unimplemented)');
      process.exit(1);
      // Run a task
    } else {
      // The apostrophe-express-init module adds this method
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

    var config = options.__testDefaults || defaults;
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
    self.hostName = self.options.hostName;
    if (!self.hostName) {
      throw "Specify the `hostName` option and set it to the preferred hostname of your site, such as mycompany.com";
    }
    self.title = self.options.title;
    self.prefix = self.options.prefix || '';
  }

  function defineModules() {
    // Set moog-require up to create our module manager objects

    var synth = require('moog-require')({
      root: self.root,
      bundles: [ 'apostrophe' ],
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
      return self.synth.create(item, { apos: self }, function(err, obj) {
        if (err) {
          return callback(err);
        }
        self.modules[item] = obj;
        return callback(null);
      });
    }, function(err) {
      return setImmediate(function() {
        return callback(err);
      });
    });
  }

  function modulesReady(callback) {
    return callForAll('modulesReady', callback);
  }

  function modulesAfterInit(callback) {
    return callForAll('afterInit', callback);
  }

  function afterInit(callback) {
    // Give project-level code a chance to run before we
    // listen or run a task
    if (!self.options.afterInit) {
      return setImmediate(callback);
    }
    return self.options.afterInit(callback);
  }

  function afterListen(callback) {
    // Give project-level code a chance to run after we
    // start listening. Not called at all for tasks
    if (!self.options.afterListen) {
      return setImmediate(callback);
    }
    return self.options.afterListen(callback);
  }

  function callForAll(method, callback) {
    return async.eachSeries(_.keys(self.modules), function(name, callback) {
      var module = self.modules[name];
      var invoke = module[method];
      if (invoke) {
        if (invoke.length === 1) {
          return invoke(callback);
        } else if (invoke.length === 0) {
          return setImmediate(function() {
            try {
              invoke();
            } catch (e) {
              return callback(e);
            }
            return callback(null);
          });
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
  }

};

module.exports.moogBundle = {
  modules: [ 'apostrophe-module' ].concat(_.keys(defaults.modules)),
  directory: 'lib/modules'
};

