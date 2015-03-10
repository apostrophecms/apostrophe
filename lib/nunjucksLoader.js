// This is a nunjucks filesystem loader that allows absolute paths, and
// also allows templates in other modules to be accessed, for instance:
//
// snippets:snippetMacros.html
//
// Only modules that use the assets mixin can be accessed in this way.
//
// The name under which you access the template is the name the module
// passes to the assets mixin. This is usually shorter than the
// full module name, for instance: "snippets", "blog", "events". For
// official Apostrophe modules it is always the module name with
// "apostrophe-" removed.
//
//
// Note that if you attempt to access myBlog:show.html and that does not
// exist, but blog:show.html does, you will get blog:show.html. So if you
// want project-level overrides to be taken into account, use the my* name.
// It is safe because it will fall back to the official module's version
// if needed.

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

module.exports = function(searchPaths, noWatch, apos) {
  var self = this;
  self._apos = apos;
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
            if (!filename) {
              return;
            }
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

    // Access to templates in other modules
    var matches = name.match(/^([\w\-]{2,})\:(.+)$/);
    if (matches) {
      var moduleName = matches[1];
      var modulePath = matches[2];

      // getAssetChain allows us to find the chain of overrides for
      // any module name, and tries the "my-" prefix first to allow
      // project-level overrides (via apostrophe-site) to win

      var assetChain = self._apos.getAssetChain(moduleName);
      if (!assetChain) {
        console.log('asset module ' + moduleName + ' not found');
        return null;
      }

      // The unfortunately named property "_modules" actually contains an array
      // of objects that contain the web and filesystem paths to the original
      // module and its chain of subclasses. Search the chain for a match in
      // the deepest possible override folder.
      var result;

      var i = 0;
      while (i < assetChain.length) {
        var override = assetChain[i];
        fullpath = override.dir + '/views/' + modulePath;
        if (fs.existsSync(fullpath)) {
          self.pathsToNames[fullpath] = name;
          return { src: fs.readFileSync(fullpath, 'utf-8'), path: fullpath };
        }
        i++;
      }
      return null;
    }

    // Allow absolute paths. Windows drive letter or Unix style rooted path
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

  var path = require('path');

  // Allows us to continue to use ../ with nunjucks 1.2.0.
  // In Apostrophe 0.5, ../ works if the resulting path
  // matches a file in any of the folders in the asset chain.
  // Just return path2 so our getSource method can do
  // that like it always has. Calling resolve(path1, path2)
  // WILL NOT do what A2 0.5 expects. -Tom
  self.resolve = function(path1, path2) {
    return path2;
  };

  self.init(searchPaths, noWatch);
};

