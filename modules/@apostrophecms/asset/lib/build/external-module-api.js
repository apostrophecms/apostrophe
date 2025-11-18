const fs = require('fs-extra');
const path = require('node:path');
const { glob } = require('glob');
const { stripIndent } = require('common-tags');

// High and Low level public API for external modules.
module.exports = (self) => {
  const getBuildManager = require('./managers')(self);

  return {
    // Get the absolute path to the project build directory.
    // Can be used with both external build and legacy webpack mode.
    getBuildRootDir() {
      const namespace = self.getNamespace();
      if (self.hasBuildModule()) {
        return path.join(
          self.apos.rootDir,
          'apos-build',
          self.getBuildModuleConfig().name,
          namespace
        );
      }
      return path.join(
        self.apos.rootDir,
        'apos-build',
        namespace
      );
    },

    // Get the absolute path to the project bundle (`public/`) directory.
    // Can be used with both external build and legacy webpack mode.
    getBundleRootDir() {
      return path.join(
        self.apos.rootDir,
        'public/apos-frontend/',
        self.getNamespace()
      );
    },

    // Get the absolute path to the current project release directory.
    // If `isUploadFs` is `true`, the path is relative to the uploadfs root.
    getCurrentRelaseDir(isUploadFs) {
      const releaseId = self.getReleaseId();
      const namespace = self.getNamespace();
      if (isUploadFs) {
        // the relative to the uploadfs root path
        return `/apos-frontend/releases/${releaseId}/${namespace}`;
      }
      // the absolute path to the release local directory
      return `${self.apos.rootDir}/public/apos-frontend/releases/${releaseId}/${namespace}`;
    },

    // This is used only by the external build systems to assemble
    // the URL for a dev server middleware. It's not in effect when
    // `self.options.autoBuild` is `false` because the external module
    // is not asked to build the assets. In this case the dev server URL
    // is detected from the saved build manifest.
    getBaseMiddlewareUrl() {
      return (self.apos.baseUrl || '') + self.apos.prefix;
    },

    // Get entrypoints configuration for the build module.
    // Provide recompute `true` to force the recomputation of the entrypoints.
    // This is useful in HMR mode, where after a "create" file event, the
    // verified bundles can change and the entrypoints configuration should be
    // updated. Usually the the core asset module will take care of this.
    // Optional `types` array can be provided to filter the entrypoints by type.
    //
    // Returns an array of objects with the following properties:
    // - `name`: the entrypoint name. It's usually the relative to `ui` folder
    //   name(`src`, `apos`, `public`) or an extra bundle name.
    // - `label`: the human-readable label for the entrypoint, used to print
    // CLI messages. - `type`: (enum) the entrypoint type. It can be `index`,
    // `apos`, `custom` (e.g. extra bundles) or - `ignoreSources`: an array of
    // sources that shouldn't be processed when creating the entrypoint. -
    // `sources`: an object with `js` and `scss` arrays of extra sources to be
    // included in the entrypoint. These sources are not affected by the
    // `ignoreSources` configuration. - `extensions`: an optional object with
    // the additional configuration for the entrypoint, gathered from the
    // `build.extensions` modules property. - `prologue`: a string with the
    // prologue to be added to the entrypoint. - `condition`: the JS `module` or
    // `nomodule` condition. Undefined for no specific condition. - `outputs`:
    // an array of output extensions for the entrypoint (currently not fully
    // utilized) - `inputs`: an array of input extensions for the entrypoint
    // (currently not fully utilized) - `scenes`: an array of scenes to be in
    // the final post-bundle step. The scenes are instructions for the
    // Apostrophe core to combine the builds and release them. Currently
    // supported scenes are `apos` and `public` and custom scene names equal to
    // extra bundle (only those who should be loaded separately in the browser).
    //
    // Additional properties added after entrypoints are processed by the core
    // and the external build module: - `manifest`: object, see the manifest
    // section of `configureBuildModule()` docs for more information. -
    // `bundles`: a `Set` containing the bundle names that this entrypoint is
    // part of (both css and js).
    getBuildEntrypoints(types, recompute = false) {
      if (!self.hasBuildModule()) {
        return self.builds;
      }
      if (typeof types === 'boolean') {
        recompute = types;
        types = null;
      }
      if (recompute) {
        self.setBuildExtensionsForExternalModule();
      }

      if (types) {
        return self.moduleBuildEntrypoints.filter((entry) => types.includes(entry.type));
      }

      return self.moduleBuildEntrypoints;
    },

    // Get the entrypoint manager for a given `entrypoint` by its type.
    // The entrypoint parameter is an item from the entrypoints configuration.
    // See `getBuildEntrypoints()` for the entrypoint configuration schema.
    // the following methods:
    // - getSourceFiles(meta, { composePath? }): get the source files for the
    // entrypoint. The `composePath` is an optional function to compose the path
    // to the source file. It accepts `file` (a relative to
    // `ui/{folderToSearch}` file path) and `metaEntry` (the module metadata
    // entry, see `computeSourceMeta()`). - async getOutput(sourceFiles, {
    // modules, suppressErrors }): get the output data for the entrypoint. The
    // `sourceFiles` is in format compatible with the output of
    // `manager.getSourceFiles()`. The `modules` option is the list of all
    // modules, usually the cached result of `self.getRegisteredModules()`.
    // `suppressErrors` is an optional boolean to suppress the errors in the
    // output generation (useful in the development environment and HMR). -
    // match(relPath, rootPath): vote on whether a given source file is part of
    // this entrypoint. The `relPath` is a relative to the `ui` folder path
    // (e.g. `src/index.js`). The `rootPath` is the absolute path to the `ui`
    // folder. The method should return boolean `true` if the file is part of
    // the entrypoint.
    getEntrypointManger(entrypoint) {
      return getBuildManager(entrypoint);
    },

    // The cached result of `apos.modulesToBeInstantiated()`.
    getRegisteredModules() {
      return self.modulesToBeInstantiated;
    },

    // A high level public helper for writing entrypoint files based on the
    // generated by an entrypoint manager output. Write the entrypoint file in
    // the build source folder. The possible argument properties: - importFile:
    // The absolute path to the entrypoint file. No file is written if the
    // property is not provided. - prologue: The prologue string to prepend to
    // the file. - icons: The admin UI icon import code. Should be in a format
    // compatible to the `getImportFileOutput()` output. - components: The admin
    // UI component import code. Should be in a format compatible to the
    // `getImportFileOutput()` output. - tiptap: The admin UI tiptap import
    // code. Should be in a format compatible to the `getImportFileOutput()`
    // output. - apps: The admin UI app import code. Should be in a format
    // compatible to the `getImportFileOutput()` output. - js: A generic JS
    // import code. Should be in a format compatible to the
    // `getImportFileOutput()` output. - scss: A generic Sass import code.
    // Should be in a format compatible to the `getImportFileOutput()` output. -
    // raw: string raw content to write to the file.
    //
    // Only the `importFile` property is required. The rest will be used
    // to generate the entrypoint file content only when available.
    async writeEntrypointFile({
      importFile,
      prologue,
      raw,
      icons,
      components,
      tiptap,
      apps,
      js,
      scss
    }) {
      let output = '';
      output += prologue?.trim()
        ? prologue.trim() + '\n'
        : '';
      output += (scss && scss.importCode) || '';
      output += (js && js.importCode) || '';
      output += (icons && icons.importCode) || '';
      output += (components && components.importCode) || '';
      output += (tiptap && tiptap.importCode) || '';
      output += (apps && apps.importCode) || '';
      output += (icons && icons.registerCode) || '';
      output += (components && components.registerCode) || '';
      output += (tiptap && tiptap.registerCode) || '';
      // Do not strip indentation here, keep it nice and formatted
      output += apps
        ? `if (document.readyState !== 'loading') {
  setTimeout(invoke, 0);
} else {
  window.addEventListener('DOMContentLoaded', invoke);
}
function invoke() {
  ${apps.invokeCode.trim()}
}` + '\n'
        : '';

      // Remove the indentation per line.
      // It may look weird, but the result is nice and formatted import file.
      output += (js && js.invokeCode.trim().split('\n').map(l => l.trim()).join('\n') + '\n') || '';

      // Just raw content, no need to format it.
      output += (raw && raw + '\n') || '';

      if (importFile) {
        await fs.writeFile(importFile, output);
      }
      return output;
    },

    // Helper function for external build modules to find the last package
    // change timestamp in milliseconds. Works with Node.js and npm, yarn, and
    // pnpm package managers. Might be extended if a need arises.
    async getSystemLastChangeMs() {
      const packageLock = await findPackageLock();
      if (!packageLock) {
        return false;
      }

      return (await fs.stat(packageLock)).mtimeMs;

      async function findPackageLock() {
        const packageLockPath = path.join(self.apos.npmRootDir, 'package-lock.json');
        const yarnPath = path.join(self.apos.npmRootDir, 'yarn.lock');
        const pnpmPath = path.join(self.apos.npmRootDir, 'pnpm-lock.yaml');
        if (await fs.pathExists(packageLockPath)) {
          return packageLockPath;
        } else if (await fs.pathExists(yarnPath)) {
          return yarnPath;
        } else if (await fs.pathExists(pnpmPath)) {
          return pnpmPath;
        } else {
          return false;
        }
      }
    },

    // Retrieve saved during build core metadata. The metadata is saved in the
    // `.manifest.json` file in the bundle root directory. The manifest format
    // is independent, internal standard (see `saveBuildManifest()` method
    // docs). Additional property `bundles` (Set). See the manifest section in
    // `configureBuildModule()` method docs for more information.
    async loadSavedBuildManifest(silent = false) {
      const manifestPath = path.join(self.getBundleRootDir(), '.manifest.json');
      try {
        return JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      } catch (e) {
        if (!silent && self.apos.options.autoBuild !== false) {
          self.apos.util.error(`Error loading the saved build manifest: ${e.message}`);
        }
        return {};
      }
    },

    // Save the core metadata during the build process. It's async to allow
    // future improvements.
    async forcePageReload() {
      self.restartId = self.apos.util.generateId();
    },

    // A low-level helper to compute the source metadata for the external
    // modules. Compute UI source and public files metadata of all modules.The
    // result array order follows the following rules: - process modules in the
    // order they are passed - process each module chain starting from the base
    // parent instance and ending with the the final extension This complies
    // with a "last wins" strategy for sources overrides - the last module in
    // the chain should win. Handling override scenarios is NOT the
    // responsibility of this method, it only provides the metadata in the right
    // order.
    //
    // If the `asyncHandler` is an optional async function, it will be called
    // for each module entry. This is useful for external build modules to
    // e.g. copy files to the build directory during the traversal.
    //
    // The `modules` option is usually the result of
    // `self.getRegisteredModules()`. It's not resolved internally to avoid
    // overhead (it's not cheap). The caller is responsible for resolving and
    // caching the modules list.
    //
    // Returns an array of objects with the following properties:
    //   - dirname - absolute module path with `/ui` appended.
    //     For example `path/to/project/article/ui`
    //     or `/path/to/project/node_modules/@apostrophecms/admin-bar/ui`.
    //   - `id`: the module name, prefixed with `my-` if it's a project module.
    //     For example `my-article` or `@apostrophecms/my-admin-bar`.
    //   - `name`: the original module name (no `my-` prefix).
    //   - `importAlias`: the alias base that is used for importing the module.
    //     For example `Modules/@apostrophecms/admin-bar/`. This is used to fast
    //     resolve the module in the Vite build.
    //   - `npm`: a boolean indicating if the module is a npm module
    //   - `files`: an array of paths paths relative to the module `ui/` folder,
    //   - `exists`: a boolean indicating if the `dirname` exists.
    // - `symlink`: a boolean indicating if the npm module is a symlink.
    // Non-npm modules are always considered as non-symlinks.
    async computeSourceMeta({
      modules,
      stats = true,
      asyncHandler
    }) {
      const seen = {};
      const npmSeen = {};
      const meta = [];
      for (const name of modules) {
        const metadata = await self.apos.synth.getMetadata(name);
        for (const entry of metadata.__meta.chain) {
          if (seen[entry.dirname]) {
            continue;
          }
          const moduleName = entry.my
            ? entry.name
              .replace('/my-', '/')
              .replace(/^my-/, '')
            : entry.name;
          const dirname = `${entry.dirname}/ui`;
          let exists = null;
          let isSymlink = null;

          const files = await glob('**/*', {
            cwd: dirname,
            ignore: [
              '**/node_modules/**'
              // Keep the public folder for now so that
              // we can easily copy it to the bundle folder later.
              // Remove it if there's a better way to handle it.
              // 'public/**'
            ],
            nodir: true,
            follow: false,
            absolute: false
          });
          files.sort((a, b) => a.localeCompare(b, 'en'));

          if (stats) {
            // optimize fs calls
            exists = files.length > 0 ? true : fs.existsSync(dirname);
            isSymlink = exists ? checkSymlink(entry) : false;
          }

          seen[entry.dirname] = true;
          const metaEntry = {
            id: entry.name,
            name: moduleName,
            dirname,
            importAlias: `Modules/${moduleName}/`,
            npm: entry.npm ?? false,
            symlink: isSymlink,
            exists,
            files
          };
          meta.push(metaEntry);

          if (asyncHandler) {
            await asyncHandler(metaEntry);
          }
        }
      }

      function checkSymlink(entry) {
        if (!entry.npm) {
          return false;
        }
        let dir;
        if (entry.bundled) {
          const baseChunks = entry.dirname.split('/node_modules/');
          const end = baseChunks.pop();
          const base = baseChunks.join('/node_modules/');
          if (end.startsWith('@')) {
            dir = `${base}/node_modules/${end.split('/').slice(0, 2).join('/')}`;
          } else {
            dir = `${base}/node_modules/${end.split('/')[0]}`;
          }
        } else {
          dir = entry.dirname;
        }
        if (typeof npmSeen[dir] === 'boolean') {
          return npmSeen[dir];
        }
        npmSeen[dir] = fs.lstatSync(dir, { throwIfNoEntry: false })
          ?.isSymbolicLink() ?? false;
        return npmSeen[dir];
      }

      return meta;
    },

    // A low level public helper used internally in the entrypoint managers.
    // It allows finding source files from the computed source metadata
    // for a given entrypoint configuration.
    //
    // The `meta` array is the (cached) return value of `computeSourceMeta()`.
    // The `pathComposer` option is used to create the component import path.
    // It should be a function that takes
    // the file relative to a module `ui/` folder and a metadata entry object
    // as arguments and returns the relative path to the file from within the
    // apos-build folder.
    // The default path composer: (file, entry) => `./${entry.name}/${file}`
    // If not provided, the default composer will be used.
    //
    // The `predicates` object is used to filter the files and determines the
    // output.
    // It should contain the output name as the key and a predicate function as
    // the value. The function takes the same arguments as the `pathComposer`
    // (file and entry) and should return a boolean - `true` if the file should
    // be included in the output.
    // Example:
    // {
    //   js: (file, entry) => file.endsWith('.js'),
    //   scss: (file, entry) => file.endsWith('.scss')
    // }
    // will result in return value like:
    // {
    //   js: [
    //     {
    //       component: './module-name/file.js',
    //       path: '/path/to/module-name/file.js'
    //     }
    //   ],
    //   scss: [
    //     {
    //       component: './module-name/file.scss',
    //       path: '/path/to/module-name/file.scss'
    //     }
    //   ]
    // }
    //
    // If the `skipPredicates` option is set to `true`, the function will skip
    // the predicates and only validate and include the extra sources if
    // provided. In this case, the `predicates` object values (the functions)
    // will be ignored and can be set to `null`. Example: const sources =
    // self.apos.asset.findSourceFiles( meta, self.myComposeSourceImportPath, {
    // js: null, scss: null }, { skipPredicates: true, extraSources: { js: [
    // '/path/to/module-name/file.js' ], scss: [
    // '/path/to/module-name/file.scss' ] } } );
    //
    // The `options` object can be used to customize the filtering.
    // The following options are available:
    // - extraSources: An object with the same structure as the `predicates`
    //   object. The object values should be arrays of absolute paths to the
    //   source files. The files will be validated against the metadata and
    // included in the output regardless of the predicates and the
    // `ignoreSources` option. - componentOverrides: If `true`, the function
    // will filter out earlier versions of a component if a later version
    // exists. If an array of predicate names is passed, the function will only
    // filter the components for the given predicates. For example, passing
    // `['js']` will only apply the override algorithm to the result of the `js`
    // predicate. - ignoreSources: An array of source files to ignore. The files
    // should be absolute paths. - skipPredicates: If `true`, the function will
    // skip the predicates and only include the extra sources if provided. This
    // option makes no sense if the `extraSources` option is not provided. -
    // pathComposer: A function to compose the path to the source file. See
    // above for more information.
    //
    // Usage:
    // const sources = self.apos.asset.findSourceFiles(
    //   meta,
    //   {
    //     js: (file, entry) => file.startsWith(`${entry.name}/components/`) &&
    //      file.endsWith('.vue')
    //   },
    //   {
    //     componentOverrides: true
    //   }
    // );
    // Example output:
    // {
    //   js: [
    //     {
    //       component: './module-name/components/MyComponent.vue',
    //       path: '/path/to/module-name/components/MyComponent.vue'
    //     },
    //     // ...
    //   ]
    // }
    findSourceFiles(meta, predicates, options = {}) {
      const composePathDefault = (file, metaEntry) => `./${metaEntry.name}/${file}`;
      const composer = options.pathComposer || composePathDefault;

      const map = Object.entries(predicates)
        .reduce(
          (acc, [ name, predicate ]) => (
            acc.set(
              name,
              {
                predicate,
                results: new Map()
              }
            )
          ),
          new Map()
        );
      for (const entry of meta) {
        if (!entry.files.length) {
          continue;
        }
        for (const [ name, { predicate, results } ] of map) {
          if (options.skipPredicates !== true) {
            entry.files.filter(f => predicate(f, entry))
              .forEach((file) => {
                const fullPath = path.join(entry.dirname, file);
                if (options.ignoreSources?.includes(fullPath)) {
                  return;
                }
                const result = {
                  component: composer(file, entry),
                  path: fullPath
                };
                results.set(result.component, result);
              });
          }

          if (options.extraSources) {
            const files = options.extraSources[name]
              ?.filter(sourcePath => sourcePath.includes(entry.dirname)) ?? [];
            for (const sourcePath of files) {
              const source = self.getSourceByPath(entry, composer, sourcePath);
              if (source) {
                results.set(source.component, source);
              }
            }
          }
        }
      }

      const result = {};
      for (const [ name, { results } ] of map) {
        result[name] = [ ...results.values() ];
      }

      if (options.componentOverrides) {
        for (let [ name, components ] of Object.entries(result)) {
          if (
            Array.isArray(options.componentOverrides) &&
              !options.componentOverrides.includes(name)
          ) {
            continue;
          }

          // Reverse the list so we can easily find the last configured import
          // of a given component, allowing "improve" modules to win over
          // the originals when shipping an override of a Vue component
          // with the same name, and filter out earlier versions
          components.reverse();
          const seen = new Set();
          components = components.filter(item => {
            const name = self.getComponentNameByPath(item.component);
            if (seen.has(name)) {
              return false;
            }
            seen.add(name);
            return true;
          });
          // Put the components back in their original order
          components.reverse();
          result[name] = components;
        }
      }

      return result;
    },

    // A low level public helper used internally in the entrypoint managers.
    // Identify an absolute path to an Apostrophe UI source and return the
    // component relative build path and the path to the source file.
    // The method returns `null` if the source path is not found or
    // an object with `component` and `path` properties.
    getSourceByPath(metaOrEntry, pathComposer, sourcePath) {
      const entry = Array.isArray(metaOrEntry)
        ? metaOrEntry.find((entry) => sourcePath.includes(entry.dirname))
        : metaOrEntry;

      if (!entry) {
        self.logDebug('getSourceByPath', `No meta entry found for "${sourcePath}".`);
        return null;
      }
      const component = sourcePath.replace(entry.dirname + '/', '');
      if (entry.files.includes(component)) {
        return {
          component: pathComposer(component, entry),
          path: sourcePath
        };
      }
      self.logDebug('getSourceByPath', `No match found for "${sourcePath}" in "${entry.id}".`, {
        entry: entry.id,
        component,
        sourcePath
      });
      return null;
    },

    // A low level public helper used internally in the entrypoint managers.
    // Generate the import code for the given components.
    // The components array should contain objects with `component` and `path`
    // properties (usually the output of `findSourceFiles()` method).
    // The `component` property is the relative path to the file
    // from within the apos-build folder, and the `path` property is the
    // absolute path to the original file.
    //
    // The `options` object can be used to customize the output.
    // The following options are available:
    //
    // - requireDefaultExport: If true, the function will throw an error
    //   if a component does not have a default export.
    // - registerComponents: If true, the function will generate code to
    //   register the components in the window.apos.vueComponents object.
    // - registerTiptapExtensions: If true, the function will generate code
    //   to register the components in the window.apos.tiptapExtensions array.
    // - invokeApps: If true, the function will generate code to invoke the
    //   components as functions.
    // - importSuffix: A string that will be appended to the import name.
    // - importName: If false, the function will not generate an import name.
    // - enumerateImports: If true, the function will enumerate the import
    // names. - suppressErrors: If true, the function will not throw an error
    // and will attempt to generate a correct output. Use with caution. This
    // option is meant to be used in the development environment (HMR) where the
    // build should not e.g. empty file (when creating a new file).
    //
    // The function returns an object with `importCode`, `registerCode`, and
    // `invokeCode` string properties.
    getImportFileOutput(components, options = {}) {
      let registerCode = '';
      if (options.registerComponents) {
        registerCode = 'window.apos.vueComponents = window.apos.vueComponents || {};\n';
      } else if (options.registerTiptapExtensions) {
        registerCode = 'window.apos.tiptapExtensions = window.apos.tiptapExtensions || [];\n';
      }
      const output = {
        importCode: '',
        registerCode,
        invokeCode: ''
      };

      components.forEach((entry, i) => {
        const { component, path: realPath } = entry;
        if (options.requireDefaultExport) {
          let content = '';
          try {
            content = fs.readFileSync(realPath, 'utf8');
          } catch (e) {
            throw new Error(`The file ${realPath} does not exist.`);
          }
          if (!content.match(/export[\s\n]+default/)) {
            if (!options.suppressErrors) {
              throw new Error(stripIndent`
                      The file ${component} does not have a default export.

                      Any ui/src/index.js file that does not have a function as
                      its default export will cause the build to fail in production.
                    `);
            } else if (content.trim().length === 0) {
              // Patch it
              fs.writeFileSync(realPath, 'export default () => {\n\n}\n');
            }
          }
        }
        const jsFilename = JSON.stringify(component);
        const name = self.getComponentNameByPath(
          component,
          { enumerate: options.enumerateImports === true ? i : false }
        );
        const jsName = JSON.stringify(name);
        const importName = `${name}${options.importSuffix || ''}`;
        const importCode = options.importName === false
          ? `import ${jsFilename};\n`
          : `import ${importName} from ${jsFilename};\n`;

        output.importCode += `${importCode}`;

        if (options.registerComponents) {
          output.registerCode += `window.apos.vueComponents[${jsName}] = ${importName};\n`;
        }

        if (options.registerTiptapExtensions) {
          output.registerCode += stripIndent`
                  apos.tiptapExtensions.push(${importName});
                ` + '\n';
        }
        if (options.invokeApps) {
          output.invokeCode += `  ${name}${options.importSuffix || ''}();\n`;
        }
      });

      return output;
    },

    // Generate the import code for all registered icons (`icons` module prop).
    // The function returns an object with `importCode`, `registerCode`,
    // and `invokeCode` string properties.
    // Modules is the cached list of modules, usually the result of
    // `self.getRegisteredModules()`. See `getRegisteredModules()` method for
    // more information.
    async getAposIconsOutput(modules) {
      for (const name of modules) {
        const metadata = await self.apos.synth.getMetadata(name);
        // icons is an unparsed section, so getMetadata gives it back
        // to us as an object with a property for each class in the
        // inheritance tree, root first. Just keep merging in
        // icons from that
        for (const [ name, layer ] of Object.entries(metadata.icons)) {
          if ((typeof layer) === 'function') {
            // We should not support invoking a function to define the icons
            // because the developer would expect `(self)` to behave
            // normally, and they won't during an asset build. So we only
            // accept a simple object with the icon mappings
            throw new Error(`Error in ${name} module: the "icons" property may not be a function.`);
          }
          Object.assign(self.iconMap, layer || {});
        }
      }

      // Load global vue icon components.
      const output = {
        importCode: '',
        registerCode: 'window.apos.iconComponents = window.apos.iconComponents || {};\n',
        invokeCode: ''
      };

      const importIndex = [];
      for (const [ registerAs, importFrom ] of Object.entries(self.iconMap)) {
        let importName = importFrom;
        if (!importIndex.includes(importFrom)) {
          if (importFrom.substring(0, 1) === '~') {
            importName = self.apos.util.slugify(importFrom).replaceAll('-', '');
            output.importCode += `import ${importName}Icon from '${importFrom.substring(1)}';\n`;
          } else {
            output.importCode +=
                `import ${importName}Icon from '@apostrophecms/vue-material-design-icons/${importFrom}.vue';\n`;
          }
          importIndex.push(importFrom);
        }
        output.registerCode += `window.apos.iconComponents['${registerAs}'] = ${importName}Icon;\n`;
      }

      return output;
    }

  };
};
