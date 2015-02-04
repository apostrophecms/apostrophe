var path = require('path');
var _ = require('lodash');
var argv = require('yargs').argv;
var fs = require('fs');
var async = require('async');

var defaults = require('./defaults.js');

module.exports = function(options) {
  var self = {};
  // Determine root module and root directory
  self.root = options.root || getRoot();
  self.rootDir = options.rootDir || path.dirname(root.filename);
  var local = {};
  if (fs.existsSync(self.rootDir + '/data/local.js')) {
    local = require(self.rootDir + '/data/local.js');
  }
  var config = defaults;
  var coreModules = _.cloneDeep(config.modules);
  if (typeof(local) === 'function') {
    if (local.length === 1) {
      _.merge(config, local(self));
    } else if (local.length === 2) {
      local(self, config);
    } else {
      throw 'data/local.js may export an object, a function that takes apos as an argument and returns an object, OR a function that takes apos and config as objects and directly modifies config';
    }
  }
  _.merge(config, local || {});
  _.merge(config, options);

  // Make arguments available
  self.argv = argv;

  self.synth = require('moog-require')({
    root: self.root,
    bundles: [ 'apostrophe' ],
    localModules: self.rootDir + '/lib/modules',
    defaultBaseClass: 'apostrophe-module'
  });

  _.each(config.modules, function(options, name) {
    self.synth.define(name, options);
  });

  self.modules = {};

  async.series({
    modules: function(callback) {
      return async.eachSeries(_.keys(config.modules), function(item, callback) {
        return self.synth.create(item, { apos: self }, function(err, obj) {
          if (err) {
            return callback(err);
          }
          self.modules[item] = obj;
          return callback(null);
        });
      }, callback);
    },
    afterInit: function(callback) {
      if (!config.afterInit) {
        return setImmediate(callback);
      }
      return config.afterInit(callback);
    }
  }, function(err) {
    if (err) {
      throw err;
    }
    console.log('task or listen');
  });

  return self;

  function getRoot() {
    var m = module;
    while (m.parent) {
      m = m.parent;
      module = m;
    }
    return module;
  }

};

module.exports.moogBundle = {
  modules: [ 'apostrophe-module' ].concat(_.keys(defaults.modules)),
  directory: 'lib/modules'
};

