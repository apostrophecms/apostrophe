// This is a nunjucks filesystem loader that allows absolute paths.
// Pre-1.0 nunjucks allowed that by default but the 1.0 FileSystemLoader
// does not. This code was adapted from the nunjucks code.
//
// Frontend devs are trusted in A2 development, and a lack of support for
// absolute paths defeats a pattern already in use in A2, which is extending
// a template of the same name in another folder that is part of the
// template include paths list. Without absolute paths on the initial render call,
// it is impossible to avoid adding the folder of the original template
// to the require paths list, which results in an infinite loop.
//
// TODO: consider changing this pattern and accepting the bc break required
// to do so, so we can use FileSystemLoader.

var fs = require('fs');
var path = require('path');
var _ = require('underscore');

module.exports = function(searchPaths, noWatch) {
  var self = this;

  self.init = function(searchPaths, noWatch) {
    self.pathsToNames = {};
    if (searchPaths) {
      searchPaths = Array.isArray(searchPaths) ? searchPaths : [ searchPaths ];
      // For windows, convert to forward slashes
      self.searchPaths = _.map(searchPaths, path.normalize);
    }
    else {
      self.searchPaths = [];
    }
    if (!noWatch) {
      // Watch all the templates in the paths and fire an event when
      // they change
      _.each(self.searchPaths, function(p) {
        if (fs.existsSync(p)) {
          fs.watch(p, { persistent: false }, function(event, filename) {
            var fullname = path.join(p, filename);
            if (event === 'change' && fullname in self.pathsToNames) {
              self.emit('update', self.pathsToNames[fullname]);
            }
          });
        }
      });
    }
  };

  self.getSource = function(name) {
    var fullpath = null;
    // Allow absolute paths
    if (name.match(/^([a-zA-Z]\:|\/|\\)/)) {
      if (!fs.existsSync(name)) {
        return null;
      }
      self.pathsToNames[name] = name;
      return { src: fs.readFileSync(name, 'utf-8'), path: name };
    }
    _.find(self.searchPaths, function(searchPath) {
      var p = path.join(searchPath, name);
      if (fs.existsSync(p)) {
        fullpath = p;
        return true;
      }
    });
    if (!fullpath) {
      return null;
    }

    self.pathsToNames[fullpath] = name;

    return { src: fs.readFileSync(fullpath, 'utf-8'), path: fullpath };
  };

  self.on = function(name, func) {
    self.listeners = self.listeners || {};
    self.listeners[name] = self.listeners[name] || [];
    self.listeners[name].push(func);
  };

  self.emit = function(name /*, arg1, arg2, ...*/) {
    var args = Array.prototype.slice.call(arguments, 1);

    if (self.listeners && self.listeners[name]) {
      _.each(self.listeners[name], function(listener) {
        listener.apply(null, args);
      });
    }
  };

  self.init(searchPaths, noWatch);
};

