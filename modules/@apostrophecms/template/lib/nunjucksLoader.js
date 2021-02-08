// This is a nunjucks filesystem loader that allows absolute paths,
// and also allows templates in other modules to be accessed, for
// instance:
//
// @apostrophecms/template:outerLayout.html
//
// Note that if @apostrophecms/template has a project-level override
// of outerLayout.html, that will be loaded instead. This is
// intentional.

const fs = require('fs');
const path = require('path');
const _ = require('lodash');

module.exports = function(moduleName, searchPaths, noWatch, templates, options) {

  const self = this;
  options = options || {};
  const extensions = options.extensions || [ 'njk', 'html' ];
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
            fs.watch(p, {
              persistent: false,
              recursive: true
            }, function(event, filename) {
              // Just blow the whole cache if anything is modified. Much simpler,
              // avoids several false negatives, and works well for a CMS in dev. -Tom
              self.cache = {};
            });
          } catch (e) {
            if (!self.firstWatchFailure) {
              // Don't crash in broken environments like the Linux subsystem for Windows
              self.firstWatchFailure = true;
              self.templates.apos.util.warn('WARNING: fs.watch does not really work on this system. That is OK but you\n' +
                'will have to restart to see any template changes take effect.');
            }
            self.templates.apos.util.error(e);
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
    const matches = parentName.split(/:/);
    if (!matches) {
      return filename;
    }
    const resolvedTo = matches[0] + ':' + filename;
    return resolvedTo;
  };

  self.getSource = function(name) {
    let fullpath = null;

    let matches;
    let i, j;
    let src;

    if (!name.match(/:/)) {
      name = self.moduleName + ':' + name;
    }

    matches = name.split(/:/);
    if (matches.length !== 2) {
      throw new Error('Bad template path: ' + name + ' (format is module-name:filename');
    }
    const moduleName = matches[0];
    const modulePath = matches[1];

    // check if the module asked for exists
    if (!self.templates.apos.modules[moduleName]) {
      throw new Error('Module doesn\'t exist: ' + moduleName);
    }

    const dirs = self.templates.getViewFolders(self.templates.apos.modules[moduleName]);
    for (i = 0; (i < dirs.length); i++) {
      fullpath = dirs[i] + '/' + modulePath;
      matches = fullpath.match(/\.([^/.]+)$/);
      if (matches) {
        if (!_.includes(extensions, matches[1])) {
          // Custom extensions shouldn't fall back to njk/html,
          // that would not be bc. It's do or die for these
          if (fs.existsSync(fullpath)) {
            self.pathsToNames[fullpath] = name;
            src = fs.readFileSync(fullpath, 'utf-8');
            lint(fullpath, src);
            return {
              src: src,
              path: name
            };
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
          lint(fullpath, src);
          return {
            src: src,
            path: name
          };
        }
      }
    }
    return null;
    function lint(fullpath, src) {
      if (process.env.NODE_ENV !== 'production') {
        // If we do this naively with a single regexp we'll inadvertently
        // span two macros to get at an innocent area in between them.
        // Check all the macro definitions individually
        const matcher = /{%\s*macro[\s\S]+{%\s*endmacro\s*%}/g;
        let matches;
        while ((matches = matcher.exec(src)) !== null) {
          const macro = matches[0];
          if (macro.match(/{%\s*area|{%\s*component/)) {
            self.templates.apos.util.warnDevOnce('async-in-macros',
              `The Nunjucks template:\n\n${fullpath}\n\nAttempts to use {% area %} or {% component %} inside {% macro %}.\nThis will not work. Replace {% macro %}...{% endmacro %} with\n{% fragment %}...{% endfragment %}.`
            );
          }
        }
      }
    }
  };

  self.on = function(name, func) {
    self.listeners = self.listeners || {};
    self.listeners[name] = self.listeners[name] || [];
    self.listeners[name].push(func);
  };

  self.emit = function(name /*, arg1, arg2, ... */) {
    const args = Array.prototype.slice.call(arguments, 1);

    if (self.listeners && self.listeners[name]) {
      _.each(self.listeners[name], function(listener) {
        listener.apply(null, args);
      });
    }
  };

  self.init(searchPaths, noWatch);
};
