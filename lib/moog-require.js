const _ = require('lodash');
const fs = require('fs');
const npmResolve = require('resolve');
const path = require('path');
const glob = require('./glob.js');
const resolveFrom = require('resolve-from');
const regExpQuote = require('regexp-quote');

const importFresh = moduleName => import(`${moduleName}?${Date.now()}`);

module.exports = async function(options) {
  const self = require('./moog')(options);

  if (!self.options.root) {
    throw 'The root option is required. Pass the node variable "module" as root. This allows moog to require modules on your behalf.';
  }

  self.root = self.options.root;

  self.bundled = {};

  self.improvements = {};

  if (self.options.bundles) {
    for (const bundleName of self.options.bundles) {
      const bundlePath = getNpmPath(self.root.filename, bundleName);
      if (!bundlePath) {
        throw 'The configured bundle ' + bundleName + ' was not found in npm.';
      }
      const { default: imported } = await importFresh(bundlePath);
      if (!imported.bundle) {
        throw 'The configured bundle ' + bundleName + ' does not export a bundle property.';
      }
      const modules = imported.bundle.modules;
      if (!modules) {
        throw 'The configured bundle ' + bundleName + ' does not have a "modules" property within its "bundle" property.';
      }
      Object.values(modules)
        .forEach(name => {
          self.bundled[name] = path.normalize(path.dirname(bundlePath) + '/' + imported.bundle.directory + '/' + name + '/index.js');
        });
    }
  }

  const superDefine = self.define;
  self.define = async function(type, definition, extending) {

    let result;

    // For the define-many-at-once case let the base class do the work
    if ((typeof type) === 'object') {
      return superDefine(type);
    }

    let projectLevelDefinition;
    let npmDefinition;
    let originalType;
    let projectLevelPath = self.options.localModules + '/' + type + '/index.js';

    if (options.nestedModuleSubdirs) {
      if (!self._indexes) {
        // Fetching a list of index.js files on the first call and then
        // searching it each time for one that refers to the right type name
        // shaves as much as 60 seconds off the startup time in a large project,
        // compared to using the glob cache feature
        self._indexes = glob(self.options.localModules + '/**/index.js', { follow: true });
      }
      const matches = self._indexes.filter(function(index) {
        // Double-check that we're not confusing "@apostrophecms/asset" with
        // "asset" by making sure "type" is not preceded by an npm namespace
        // folder. If type is itself namespaced this never comes up (because npm
        // namespaces don't nest). The risk is that a legitimate project level
        // module that happens to end with the same name as a namespaced module
        // will be rejected as a duplicate when nestedModuleSubdirs is present
        return index.endsWith('/' + type + '/index.js') && !index.match(new RegExp(`/@[^/]+/${regExpQuote(type)}/index\\.js$`));
      });
      if (matches.length > 1) {
        throw new Error('The module ' + type + ' appears in multiple locations:\n' + matches.join('\n'));
      }
      projectLevelPath = matches[0] ? path.normalize(matches[0]) : projectLevelPath;
    }
    if (fs.existsSync(projectLevelPath)) {
      const {
        default: defaultProjectLevelDefinition
      } = await importFresh(
        resolveFrom(path.dirname(self.root.filename), projectLevelPath)
      );
      projectLevelDefinition = defaultProjectLevelDefinition;
      if (Object.keys(projectLevelDefinition).length === 0) {
        /* eslint-disable-next-line no-console */
        console.warn(`⚠️ The file ${projectLevelPath}\ndoes not export anything, did you misspell or forget module.exports?\n`);
      }
    }

    let relativeTo;
    if (extending) {
      relativeTo = extending.__meta.filename;
    } else {
      relativeTo = self.root.filename;
    }

    const npmPath = getNpmPath(relativeTo, type);
    if (npmPath) {
      const { default: defaultNpmDefinition } = await importFresh(npmPath);
      npmDefinition = defaultNpmDefinition;
      npmDefinition.__meta = {
        npm: true,
        bundled: _.has(self.bundled, type),
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
        if (!(await self.isDefined(type, { autoload: false }))) {
          await self.define(type);
        }
      } else if (npmDefinition.replace) {
        // Replace an existing type with the one defined by
        // this npm module
        delete self.definitions[npmDefinition.replace];
        type = npmDefinition.replace;
      }
    }

    if (!(definition || projectLevelDefinition || npmDefinition)) {
      if (extending) {
        throw new Error(`The module ${type} is not defined. Referenced in ${extending.__meta.name}.`);
      } else {
        throw new Error(`The module ${type} is not defined.`);
      }
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
    // app.js wins if a section is declared twice. For most sections
    // there is no further merge algorithm between app.js and index.js.
    // However if an option exists in index.js and not in app.js, that
    // should be honored.
    if (definition.options && projectLevelDefinition.options) {
      _.defaults(definition.options, projectLevelDefinition.options);
    }

    // Insert the npm definition as a defined type, then let the
    // base class define the local definition normally. This results
    // in an implicit base class, allowing local template overrides
    // even if there is no other local code
    if (npmDefinition) {
      result = await superDefine(type, npmDefinition);
      if (npmDefinition.improve) {
        // Restore the name of the improving module as otherwise our asset
        // chains have multiple references to my-foo which is ambiguous
        result.__meta.name = originalType;
      }
    }
    result = await superDefine(type, definition);
    if (npmDefinition && npmDefinition.improve) {
      // Restore the name of the improving module as otherwise our asset chains
      // have multiple references to my-foo which is ambiguous
      result.__meta.name = self.originalToMy(originalType);
    }
    // Mark "my" modules as such
    result.__meta.my = self.isMy(result.__meta.name);
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
      const initialFolder = path.dirname(self.root.filename);
      let folder = initialFolder;
      while (true) {
        const file = path.resolve(folder, 'package.json');
        if (fs.existsSync(file)) {
          const info = JSON.parse(fs.readFileSync(file, 'utf8'));
          self.validPackages = new Set([
            ...getDependencies(info),
            ...getWorkspacesDependencies(folder)(info)
          ]);
          break;
        } else {
          folder = path.dirname(folder);
          if (!folder.length) {
            throw new Error(`package.json was not found in ${initialFolder} or any of its parent folders.`);
          }
        }
      }
      self.npmRoot = folder;
    }
    if (!self.validPackages.has(type) && !symlinked(type)) {
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

  function symlinked(type) {
    self.symlinksCache ||= new Map();
    if (self.symlinksCache.has(type)) {
      return self.symlinksCache.get(type);
    }
    const symlink = `${self.npmRoot}/node_modules/${type}`;
    let link;
    try {
      link = fs.lstatSync(symlink).isSymbolicLink();
    } catch (e) {
      if (e.code === 'ENOENT') {
        // Just doesn't exist
        link = false;
      } else {
        throw e;
      }
    }
    self.symlinksCache.set(type, link);
    return link;
  }

  function getDependencies({
    dependencies = {},
    devDependencies = {}
  } = {}) {
    return [
      ...Object.keys(dependencies || {}),
      ...Object.keys(devDependencies || {})
    ];
  }

  function getWorkspacesDependencies(folder) {
    return ({ workspaces = [] } = {}) => {
      if (workspaces.length === 0) {
        return [];
      }

      // Ternary is required because glob expects at least 2 entries
      // when using curly braces
      const pattern = workspaces.length === 1 ? workspaces[0] : `{${workspaces.join(',')}}`;
      const packagePath = path.resolve(folder, pattern, 'package.json');
      const workspacePackages = glob(packagePath, { follow: true });

      return workspacePackages.flatMap(packagePath => {
        const info = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

        return getDependencies(info);
      });
    };
  }

  self.isImprovement = function(name) {
    return _.has(self.improvements, name);
  };

  self.applyImprovementsBeforeProjectLevel = () => {
    for (const [ name, definition ] of Object.entries(self.definitions)) {
      // At this stage the complete definition of a type is a linked list of
      // `extend` properties starting from what should be project level, unless
      // there are improvements. Shuffle project level to be the first in the
      // linked list
      if (definition.__meta.name !== self.originalToMy(name)) {
        let candidate = definition;
        let predecessor = null;
        while (candidate.extend && ((typeof candidate.extend) === 'object')) {
          predecessor = candidate;
          candidate = candidate.extend;
          if (candidate.__meta.name === self.originalToMy(name)) {
            predecessor.extend = candidate.extend;
            candidate.extend = definition;
            self.definitions[name] = candidate;
            break;
          }
        }
      }
    }
  };

  return self;
};
