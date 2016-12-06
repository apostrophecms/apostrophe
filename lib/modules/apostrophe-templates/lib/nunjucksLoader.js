// This is a nunjucks filesystem loader that allows absolute paths,
// and also allows templates in other modules to be accessed, for
// instance:
//
// apostrophe-templates:outerLayout.html
//
// Note that if apostrophe-templates has a project-level override
// of outerLayout.html, that will be loaded instead. This is
// intentional.
//
// The third argument is a reference to the apostrophe-templates
// module, which constructs this loader once for each module
// that loads templates.

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

module.exports = function(moduleName, searchPaths, noWatch, templates) {

  var self = this;
  self.moduleName = moduleName;
  self.templates = templates;

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
              console.error('WARNING: fs.watch does not really work on this system. That is OK but you\n' +
                'will have to restart to see any template changes take effect.');
            }
            console.error(e);
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

    if (!name.match(/:/)) {
      name = self.moduleName + ':' + name;
    }

    var matches = name.split(/:/);
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

    var result;

    var i = 0;
    while (i < dirs.length) {
      var fullpath = dirs[i] + '/' + modulePath;
      if (fs.existsSync(fullpath)) {
        self.pathsToNames[fullpath] = name;
        var src = fs.readFileSync(fullpath, 'utf-8');

        return { src: src, path: name };
      }
      i++;
    }
    return null;
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
