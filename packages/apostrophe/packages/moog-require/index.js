var async = require('async');
var _ = require('lodash');
var fs = require('fs');
var npmResolve = require('resolve');
var path = require('path');
var glob = require('glob');
var importFresh = require('import-fresh');
var resolveFrom = require('resolve-from');

module.exports = function(options) {
  var self = require('moog')(options);

  if (!self.options.root) {
    throw 'The root option is required. Pass the node variable "module" as root. This allows moog to require modules on your behalf.';
  }

  self.root = self.options.root;

  self.bundled = {};
  
  self.improvements = {};

  if (self.options.bundles) {
    _.each(self.options.bundles, function(bundleName) {
      var bundlePath = getNpmPath(self.root.filename, bundleName);
      if (!bundlePath) {
        throw 'The configured bundle ' + bundleName + ' was not found in npm.';
      }
      var bundle = importFresh(bundlePath);
      if (!bundle.moogBundle) {
        throw 'The configured bundle ' + bundleName + ' does not export a moogBundle property.';
      }
      var modules = bundle.moogBundle.modules;
      if (!modules) {
        throw 'The configured bundle ' + bundleName + ' does not have a "modules" property within its "moogBundle" property.';
      }
      _.each(modules, function(name) {
        self.bundled[name] = path.normalize(path.dirname(bundlePath) + '/' + bundle.moogBundle.directory + '/' + name + '/index.js');
      });
    });
  }

  var superDefine = self.define;

  if (options.nestedModuleSubdirs) {
    self._globCache = {};
  }

  self.define = function(type, definition, extending) {

    var result;

    // For the define-many-at-once case let the base class do the work
    if (typeof(type) === 'object') {
      return superDefine(type);
    }

    var projectLevelDefinition;
    var npmDefinition;
    var originalType;
    var projectLevelPath = self.options.localModules + '/' + type + '/index.js';

    if (options.nestedModuleSubdirs) {
      if (!self._indexes) {
        // Fetching a list of index.js files on the first call and then searching it each time for
        // one that refers to the right type name shaves as much as 60 seconds off the startup
        // time in a large project, compared to using the glob cache feature
        self._indexes = glob.sync(self.options.localModules + '/**/index.js');
      }
      var matches = self._indexes.filter(function(index) {
        return index.endsWith('/' + type + '/index.js');
      });
      if (matches.length > 1) {
        throw new Error('The module ' + type + ' appears in multiple locations:\n' + matches.join('\n'));
      }
      projectLevelPath = matches[0] ? path.normalize(matches[0]) : projectLevelPath;
    }
    if (fs.existsSync(projectLevelPath)) {
      projectLevelDefinition = importFresh(resolveFrom(path.dirname(self.root.filename), projectLevelPath));
    }

    var relativeTo;
    if (extending) {
      relativeTo = extending.__meta.filename;
    } else {
      relativeTo = self.root.filename;
    }

    var npmPath = getNpmPath(relativeTo, type);
    if (npmPath) {
      npmDefinition = importFresh(npmPath);
      npmDefinition.__meta = {
        npm: true,
        dirname: path.dirname(npmPath),
        filename: npmPath,
        name: type
      };
      if (npmDefinition.improve) {
        // Remember which types were actually improvements of other types for
        // the benefit of applications that would otherwise instantiate them all
        self.improvements[type] = true;
        // Improve an existing type with an implicit subclass,
        // rather than defining one under a new name
        originalType = type;
        type = npmDefinition.improve;
        // If necessary, start by autoloading the original type
        if (!self.isDefined(type, { autoload: false })) {
          self.define(type);
        }
      } else if (npmDefinition.replace) {
        // Replace an existing type with the one defined by
        // this npm module
        delete self.definitions[npmDefinition.replace];
        type = npmDefinition.replace;
      }
    }

    if (!(definition || projectLevelDefinition || npmDefinition)) {
      // Can't find it nohow. Use the standard undefined type error message
      return superDefine(type);
    }

    if (!definition) {
      definition = {};
    }

    projectLevelDefinition = projectLevelDefinition || {};

    projectLevelDefinition.__meta = {
      dirname: path.dirname(projectLevelPath),
      filename: projectLevelPath
    };

    _.defaults(definition, projectLevelDefinition);

    // Insert the npm definition as a defined type, then let the
    // base class define the local definition normally. This results
    // in an implicit base class, allowing local template overrides
    // even if there is no other local code
    if (npmDefinition) {
      result = superDefine(type, npmDefinition);
      if (npmDefinition.improve) {
        // Restore the name of the improving module as otherwise our asset chains have
        // multiple references to my-foo which is ambiguous
        result.__meta.name = originalType;
      }
    }
    result = superDefine(type, definition);
    if (npmDefinition && npmDefinition.improve) {
      // Restore the name of the improving module as otherwise our asset chains have
      // multiple references to my-foo which is ambiguous
      result.__meta.name = self.originalToMy(originalType);
    }
    return result;
  };

  function getNpmPath(parentPath, type) {
    parentPath = path.resolve(parentPath);
    if (_.has(self.bundled, type)) {
      return self.bundled[type];
    }
    // Even if the package exists in node_modules it might just be a
    // sub-dependency due to npm/yarn flattening, which means we could be
    // confused by an unrelated npm module with the same name as an Apostrophe
    // module unless we verify it is a real project-level dependency. However
    // if no package.json at all exists at project level we do search up the
    // tree until we find one to accommodate patterns like `src/app.js`
    if (!self.validPackages) {
      let info = null;
      const initialFolder = path.dirname(self.root.filename);
      let folder = initialFolder;
      while (true) {
        const file = `${folder}/package.json`;
        if (fs.existsSync(file)) {
          const info = JSON.parse(fs.readFileSync(file, 'utf8'));
          self.validPackages = new Set([ ...Object.keys(info.dependencies || {}), ...Object.keys(info.devDependencies || {}) ]);
          break;
        } else {
          folder = path.dirname(folder);
          if (!folder.length) {
            throw new Error(`package.json was not found in ${initialFolder} or any of its parent folders.`);
          }
        }
      }
    }
    if (!self.validPackages.has(type)) {
      return null;
    }
    try {
      return npmResolve.sync(type, { basedir: path.dirname(parentPath) });
    } catch (e) {
      // Not found via npm. This does not mean it doesn't
      // exist as a project-level thing
      return null;
    }
  }
  
  self.isImprovement = function(name) {
    return _.has(self.improvements, name);
  };

  return self;
};

