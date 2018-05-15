// This is a nunjucks filesystem loader that allows absolute paths,
// and also allows templates in other modules to be accessed, for
// instance:
//
// apostrophe-templates:outerLayout.html
//
// Note that if apostrophe-templates has a project-level override
// of outerLayout.html, that will be loaded instead. This is
// intentional.

var fs = require('fs');
var path = require('path');
var _ = require('@sailshq/lodash');

module.exports = function(moduleName, searchPaths, noWatch, templates, options) {

  var self = this;
  options = options || {};
  var extensions = options.extensions || [ 'njk', 'html' ];
  self.moduleName = moduleName;
  self.templates = templates;

  self.init = function(searchPaths, noWatch) {
    self.pathsToNames = {};
    if (searchPaths) {
      searchPaths = Array.isArray(searchPaths) ? searchPaths : [ searchPaths ];
      // For windows, convert to forward slashes
      self.searchPaths = _.map(searchPaths, path.normalize);
    } else {
      self.searchPaths = [];
    }
    if (!noWatch) {
      _.each(self.searchPaths, function(p) {
        if (fs.existsSync(p)) {
          try {
            fs.watch(p, { persistent: false, recursive: true }, function(event, filename) {
              // Just blow the whole cache if anything is modified. Much simpler,
              // avoids several false negatives, and works well for a CMS in dev. -Tom
              self.cache = {};
            });
          } catch (e) {
            if (!self.firstWatchFailure) {
              // Don't crash in broken environments like the Linux subsystem for Windows
              self.firstWatchFailure = true;
              self.templates.apos.utils.warn('WARNING: fs.watch does not really work on this system. That is OK but you\n' +
                'will have to restart to see any template changes take effect.');
            }
            self.templates.apos.utils.error(e);
          }
        }
      });
    }
  };

  self.isRelative = function(filename) {
    return true;
  };

  self.resolve = function(parentName, filename) {
    if (filename.match(/:/)) {
      // module-absolute
      return filename;
    }
    // relative to another module?
    var matches = parentName.split(/:/);
    if (!matches) {
      return filename;
    }
    var resolvedTo = matches[0] + ':' + filename;
    return resolvedTo;
  };

  self.getSource = function(name) {

    var fullpath = null;

    var moduleName;
    var modulePath;

    var matches;
    var i, j;
    var src;

    if (!name.match(/:/)) {
      name = self.moduleName + ':' + name;
    }

    matches = name.split(/:/);
    if (matches.length !== 2) {
      throw new Error('Bad template path: ' + name + ' (format is module-name:filename');
    }
    moduleName = matches[0];
    modulePath = matches[1];

    // check if the module asked for exists
    if (!self.templates.apos.modules[moduleName]) {
      throw new Error("Module doesn't exist: " + moduleName);
    }

    var dirs = self.templates.getViewFolders(self.templates.apos.modules[moduleName]);

    for (i = 0; (i < dirs.length); i++) {
      fullpath = dirs[i] + '/' + modulePath;
      matches = fullpath.match(/\.([^/.]+)$/);
      if (matches) {
        if (!_.contains(extensions, matches[1])) {
          // Custom extensions shouldn't fall back to njk/html,
          // that would not be bc. It's do or die for these
          if (fs.existsSync(fullpath)) {
            self.pathsToNames[fullpath] = name;
            src = fs.readFileSync(fullpath, 'utf-8');
            return { src: src, path: name };
          }
          continue;
        }
      }
      // Try all the configured extensions, regardless
      // of which of them was actually requested,
      // so that developers have a choice
      for (j = 0; (j < extensions.length); j++) {
        fullpath = fullpath.replace(/\.[^/.]+$/, '.' + extensions[j]);
        if (fs.existsSync(fullpath)) {
          self.pathsToNames[fullpath] = name;
          src = fs.readFileSync(fullpath, 'utf-8');
          return { src: src, path: name };
        }
      }
    }
    return null;
  };

  self.on = function(name, func) {
    self.listeners = self.listeners || {};
    self.listeners[name] = self.listeners[name] || [];
    self.listeners[name].push(func);
  };

  self.emit = function(name /*, arg1, arg2, ... */) {
    var args = Array.prototype.slice.call(arguments, 1);

    if (self.listeners && self.listeners[name]) {
      _.each(self.listeners[name], function(listener) {
        listener.apply(null, args);
      });
    }
  };

  self.init(searchPaths, noWatch);
};
