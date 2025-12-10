const path = require('node:path');
const fs = require('fs-extra');
const postcssrc = require('postcss-load-config');
const postcssViewportToContainerToggle = require('postcss-viewport-to-container-toggle');
const viteBaseConfig = require('./vite-base-config');
const viteAposConfig = require('./vite-apos-config');
const vitePublicConfig = require('./vite-public-config');
const viteServeConfig = require('./vite-serve-config');
const vitePostcssConfig = require('./vite-postcss-config');

module.exports = (self) => {
  return {
    async initWhenReady() {
      self.isDebug = self.apos.asset.isDebugMode();
      self.buildRoot = self.apos.asset.getBuildRootDir();
      self.buildRootSource = path.join(self.buildRoot, self.buildSourceFolderName);
      self.distRoot = path.join(self.buildRoot, self.distFolderName);
      self.cacheDirBase = path.join(
        self.apos.rootDir,
        'data/temp',
        self.apos.asset.getNamespace(),
        'vite'
      );

      const publicRel = '.public/manifest.json';
      const aposRel = '.apos/manifest.json';
      self.buildManifestPath = {
        publicRel,
        aposRel,
        public: path.join(self.distRoot, publicRel),
        apos: path.join(self.distRoot, aposRel)
      };

      self.userConfigFile = path.join(self.apos.rootDir, 'apos.vite.config.mjs');
      if (!fs.existsSync(self.userConfigFile)) {
        self.userConfigFile = path.join(self.apos.rootDir, 'apos.vite.config.js');
      }
      if (!fs.existsSync(self.userConfigFile)) {
        self.userConfigFile = null;
      }

      await fs.mkdir(self.buildRootSource, { recursive: true });
    },

    printDebug(id, ...args) {
      if (self.isDebug) {
        self.logDebug('vite-' + id, ...args);
      }
    },

    async buildBefore(options = {}) {
      if (options.isTask) {
        await self.reset();
      }
      self.currentSourceMeta = await self.computeSourceMeta({
        copyFiles: true
      });
      const entrypoints = self.apos.asset.getBuildEntrypoints(options.types);
      self.ensureInitEntry(entrypoints);
      self.applyModulePreloadPolyfill(entrypoints, options);
      await self.createImports(entrypoints);

      // Copy the public files so that Vite is not complaining about missing files
      // while building the project.
      try {
        await fs.copy(
          path.join(self.apos.asset.getBundleRootDir(), 'modules'),
          path.join(self.buildRoot, 'modules')
        );
      } catch (_) {
        // do nothing
      }
    },

    // Builds the apos UI assets.
    async buildApos(options) {
      const execute = await self.shouldBuild('apos', options);

      if (!execute) {
        return;
      }

      self.printLabels('apos', true);
      const { build, config } = await self.getViteBuild('apos', options);
      self.printDebug('build-apos', { viteConfig: config });
      await build(config);
      self.printLabels('apos', false);

      return Date.now();
    },

    // Builds the public assets.
    async buildPublic(options) {
      if (self.getBuildEntrypointsFor('public').length === 0) {
        return false;
      }
      // It's OK because it will execute once if no manifest and dev server is on.
      if (options.devServer === 'public') {
        const execute = await self.shouldBuild('public', options);
        if (!execute) {
          return;
        }
      }
      self.printLabels('public', true);
      const { build, config } = await self.getViteBuild('public', options);
      self.printDebug('build-public', { viteConfig: config });
      await build(config);
      self.printLabels('public', false);
    },

    // Create an entrypoint configuration for the vite client.
    getViteClientEntrypoint(scenes) {
      return {
        name: 'vite',
        type: 'bundled',
        scenes,
        outputs: [ 'js' ],
        manifest: {
          root: '',
          files: {},
          src: {
            js: [ '@vite/client' ]
          },
          devServer: true
        }
      };
    },

    getCurrentMode(devServer) {
      let currentBuild;
      const currentScenes = [];
      if (devServer === 'apos') {
        currentBuild = 'public';
        currentScenes.push('apos');
      }
      if (devServer === 'public') {
        currentBuild = 'apos';
        currentScenes.push('public', 'apos');
      }

      return {
        build: currentBuild,
        scenes: currentScenes
      };
    },

    // Assesses if the apos build should be triggered.
    async shouldBuild(id, options) {
      // No work for the current build.
      if (self.getBuildEntrypointsFor(id).length === 0) {
        return false;
      }
      // Build tasks always run. Also dev forced build.
      if (options.isTask || process.env.APOS_DEV === '1') {
        return true;
      }
      if (!self.hasViteBuildManifest(id)) {
        return true;
      }

      // Detect last apos build time and compare it with the last system change.
      const aposManifest = await self.apos.asset.loadSavedBuildManifest();
      const lastBuildMs = aposManifest.ts || 0;
      const lastSystemChange = await self.apos.asset.getSystemLastChangeMs();
      if (lastSystemChange !== false && lastBuildMs > lastSystemChange) {
        return false;
      }

      // Forced build by type. Keeping the core current logic.
      // In play when asset option `publicBundle: false` is set - forces apos build
      // if not cached.
      if (options.types?.includes(id)) {
        return true;
      }

      return true;
    },

    // The CLI info labels for the build process.
    printLabels(id, before) {
      const phrase = before ? 'apostrophe:assetTypeBuilding' : 'apostrophe:assetTypeBuildComplete';
      const req = self.apos.task.getReq();
      const labels = [ ...new Set(
        self.getBuildEntrypointsFor(id).map(e => req.t(e.label))
      ) ];

      if (labels.length) {
        self.apos.util.log(
          req.t(phrase, { label: labels.join(', ') })
        );
      }
    },

    // Build the index that we use when watching the original source files for changes.
    buildWatchIndex() {
      self.currentSourceMeta.forEach((entry, index) => {
        self.currentSourceUiIndex[entry.dirname] = index;
        entry.files.forEach((file) => {
          self.currentSourceFsIndex[path.join(entry.dirname, file)] = index;
          self.currentSourceRelIndex.set(
            file,
            (self.currentSourceRelIndex.get(file) ?? new Set())
              .add(index)
          );
        });
      });
    },

    // Build a watcher voter object to detect what entrypoints are
    // concerned with a given source file change.
    setWatchVoters(entrypoints) {
      self.entrypointWatchVoters = {};
      for (const entrypoint of entrypoints) {
        self.entrypointWatchVoters[entrypoint.name] = (relSourcePath, rootPath) => {
          if (
            self.apos.asset.getEntrypointManger(entrypoint)
              .match(relSourcePath, rootPath)
          ) {
            return entrypoint;
          }
          return null;
        };
      }
      self.entrypointsManifest
      // TODO: should be `entrypoint.bundled === true` in the future.
        .filter((entrypoint) => entrypoint.type === 'bundled')
        .forEach((entrypoint) => {
          self.entrypointWatchVoters[entrypoint.name] = (relSourcePath, rootPath) => {
            if (
              self.apos.asset.getEntrypointManger(entrypoint)
                .match(relSourcePath, rootPath)
            ) {
              return entrypoint;
            }
            return null;
          };
        });

    },

    getChangedEntrypointsFor(relSourcePath, metaEntry) {
      return Object.values(self.entrypointWatchVoters)
        .map((voter) => voter(relSourcePath, metaEntry))
        .filter((entrypoint) => entrypoint !== null);
    },

    getChangedBundledEntrypointsFor(relSourcePath, metaEntry) {
      const bundled = self.entrypointsManifest
      // TODO: should be `entrypoint.bundled === true` in the future.
        .filter((entrypoint) => entrypoint.type === 'bundled')
        .map((entrypoint) => self.entrypointWatchVoters[entrypoint.name])
        .filter((voter) => !!voter);

      return bundled
        .map((voter) => voter(relSourcePath, metaEntry))
        .filter((entrypoint) => entrypoint !== null);
    },

    getRootPath(onChangePath) {
      return path.join(self.apos.npmRootDir, onChangePath);
    },
    onSourceAdd(filePath, isDir) {
      if (isDir) {
        return;
      }
      const p = self.getRootPath(filePath);
      const key = Object.keys(self.currentSourceUiIndex)
        .filter((dir) => p.startsWith(dir))
        .reduce((acc, dir) => {
          // Choose the best match - the longest string wins
          if (dir.length > acc.length) {
            return dir;
          }
          return acc;
        }, '');
      const index = self.currentSourceUiIndex[key];
      const entry = self.currentSourceMeta[index];

      if (!entry) {
        return;
      }
      const file = p.replace(entry.dirname + '/', '');
      entry.files.push(file);
      entry.files = Array.from(new Set(entry.files));

      // Add the new file to the absolute and relative index
      self.currentSourceRelIndex.set(
        file,
        (self.currentSourceRelIndex.get(file) ?? new Set())
          .add(index)
      );
      self.currentSourceFsIndex[p] = index;

      // Copy the file to the build source
      self.onSourceChange(filePath, true);

      // Recreate the imports for the changed entrypoints.
      const entrypoints = self.getChangedEntrypointsFor(file, entry);
      // and re-create the imports with suppressed errors
      self.createImports(entrypoints, true);

      // Below is a future implementation of bundled entrypoint restart.
      // Restart the process if we have a bundled entrypoint change.
      // TODO: should be `entrypoint.bundled === true` in the future.
      // if (entrypoints.some(e => e.type === 'bundled')) {
      //   self.apos.asset.forcePageReload();
      // }
    },
    onSourceChange(filePath, silent = false) {
      const p = self.getRootPath(filePath);
      // grab every source file that "looks like" the changed file
      const entry = self.currentSourceMeta[self.currentSourceFsIndex[p]];
      const sources = entry?.files.filter((file) => p.endsWith(file));
      if (!sources?.length) {
        return;
      }
      for (const source of sources) {
        self.currentSourceRelIndex.get(source)?.forEach((index) => {
          try {
            const target = path.join(
              self.buildRootSource,
              self.currentSourceMeta[index].name, source
            );
            fs.mkdirpSync(path.dirname(target));
            fs.copyFileSync(
              path.join(self.currentSourceMeta[index].dirname, source),
              target
            );
          } catch (e) {
            if (silent) {
              return;
            }
            self.apos.util.error(
              `Failed to copy file "${source}" from module ${self.currentSourceMeta[index]?.name}`,
              e.message
            );
          }
        });
      };

      // Below is a future implementation of bundled entrypoint restart.
      // Not supported at the moment because:
      // - we copy properly all bundled assets as a single file to the `apos-build/...
      //   root folder.
      // - we do not have a reliable way to copy that file to the bundle root
      //   with the appropriate bundle name (public/apos-frontend/...).
      // - this can be solved with a separate core handler that does only that
      // (it's tricky).
      // if (silent) {
      //   return;
      // }

      // // After we are done with copying the files, check for process restart.
      // for (const source of sources) {
      //   const entrypoints = self.getChangedBundledEntrypointsFor(source, entry);
      //   const hasBundledChange = entrypoints.some((e) => e.type === 'bundled');
      //   if (hasBundledChange) {
      //     self.apos.asset.forcePageReload();
      //     return;
      //   }
      // }
    },
    onSourceUnlink(filePath, isDir) {
      if (isDir) {
        return;
      }
      const p = self.getRootPath(filePath);
      const source = self.currentSourceMeta[self.currentSourceFsIndex[p]]
        ?.files.find((file) => p.endsWith(file));
      if (!source) {
        return;
      }
      const index = self.currentSourceFsIndex[p];

      // 1. Delete the source file from the build source
      try {
        fs.unlinkSync(
          path.join(
            self.buildRootSource,
            self.currentSourceMeta[index].name,
            source
          )
        );
      } catch (e) {
        self.apos.util.error(
            `[onSourceUnlink] Failed to unlink file "${source}" from module ${self.currentSourceMeta[index]?.name}`,
            e.message
        );
      }

      // 2. Remove the file reference from the indexes
      self.currentSourceRelIndex.get(source)?.delete(index);
      delete self.currentSourceFsIndex[p];

      // 3. Recreate the imports for the changed entrypoints.
      const entrypoints = self.getChangedEntrypointsFor(
        source,
        self.currentSourceMeta[index]
      );
      // and update the meta entry
      self.currentSourceMeta[index].files =
          self.currentSourceMeta[index].files
            .filter((file) => file !== source);
      // and re-create the imports with suppressed errors
      self.createImports(entrypoints, true);

      // Below is a future implementation of bundled entrypoint restart.
      // 4. Restart the process if we have a bundled entrypoint change.
      // TODO: should be `entrypoint.bundled === true` in the future.
      // if (entrypoints.some(e => e.type === 'bundled')) {
      //   self.apos.asset.forcePageReload();
      //   return;
      // }

      // 3. Trigger a silent change, so that if there is an override/parent file
      // it will be copied to the build source.
      self.onSourceChange(filePath, true);
    },

    // Get the base URL for the dev server.
    // If an entrypoint `type` is is provided, a check against the current build options
    // will be performed and appropriate values will be returned.
    getDevServerUrl() {
      return self.apos.asset.getBaseMiddlewareUrl() + '/__vite';
    },

    // We need to know if a dev server should be used for an entrypoint
    // when attaching the apos manifest.
    hasDevServerUrl(type) {
      if (!self.buildOptions.devServer) {
        return false;
      }
      if (type === 'bundled') {
        return false;
      }
      if (type === 'apos' && self.buildOptions.devServer === 'public') {
        return false;
      }
      if (type && type !== 'apos' && self.buildOptions.devServer === 'apos') {
        return false;
      }

      return true;
    },

    // Create a vite instance. This can be called only when we have
    // a running express server. See handlers `afterListen`.
    async createViteInstance(options) {
      const { createServer } = await import('vite');
      const viteConfig = await self.getViteConfig(options.devServer, options, 'serve');

      const instance = await createServer(viteConfig);
      self.viteDevInstance = instance;

      self.apos.util.log(
        `HMR for "${options.devServer}" started`
      );

      self.printDebug('dev-middleware', { viteConfig });
    },

    // Compute metadata for the source files of all modules using
    // the core asset handler. Optionally copy the files to the build
    // source and write the metadata to a JSON file.
    async computeSourceMeta({ copyFiles = false } = {}) {
      const options = {
        modules: self.apos.asset.getRegisteredModules(),
        stats: true
      };
      if (copyFiles) {
        options.asyncHandler = async (entry) => {
          for (const file of entry.files) {
            await fs.copy(
              path.join(entry.dirname, file),
              path.join(self.buildRootSource, entry.name, file)
            );
          }
        };
      }
      // Do not bother with modules that are only "virtual" and do not have
      // any files to process.
      return (await self.apos.asset.computeSourceMeta(options))
        .filter((entry) => entry.exists);
    },

    // Generate the import files for all entrypoints and the pre-build manifest.
    // `suppressErrors` is used to skip errors in the build process.
    async createImports(entrypoints, suppressErrors = false) {
      for (const entrypoint of entrypoints) {
        if (entrypoint.condition === 'nomodule') {
          self.apos.util.warnDev(
              `The entrypoint "${entrypoint.name}" is marked as "nomodule". ` +
              'This is not supported by Vite and will be skipped.'
          );
          continue;
        }
        if (entrypoint.type === 'bundled') {
          await self.copyExternalBundledAsset(entrypoint);
          continue;
        }
        const output = await self.getEntrypointOutput(entrypoint, suppressErrors);
        await self.apos.asset.writeEntrypointFile(output);

        if (!self.entrypointsManifest.some((e) => e.name === entrypoint.name)) {
          self.entrypointsManifest.push({
            ...entrypoint,
            manifest: self.toManifest(entrypoint)
          });
        }
      }
    },

    // Copy and concatenate the externally bundled assets.
    async copyExternalBundledAsset(entrypoint) {
      if (entrypoint.type !== 'bundled') {
        return;
      }
      const filesByOutput = self.apos.asset.getEntrypointManger(entrypoint)
        .getSourceFiles(self.currentSourceMeta);
      const manifestFiles = {};
      for (const [ output, files ] of Object.entries(filesByOutput)) {
        if (!files.length) {
          continue;
        }
        const raw = files
          .map(({ path: filePath }) => fs.readFileSync(filePath, 'utf8'))
          .join('\n');

        await self.apos.asset.writeEntrypointFile({
          importFile: path.join(self.buildRoot, `${entrypoint.name}.${output}`),
          prologue: entrypoint.prologue,
          raw
        });
        manifestFiles[output] = manifestFiles[output] || [];
        manifestFiles[output].push(`${entrypoint.name}.${output}`);
      }
      self.entrypointsManifest.push({
        ...entrypoint,
        manifest: self.toManifest(entrypoint, manifestFiles)
      });
    },

    async getEntrypointOutput(entrypoint, suppressErrors = false) {
      const manager = self.apos.asset.getEntrypointManger(entrypoint);

      // synthetic entrypoints are not processed, they only provide
      // a way to inject additional code (prologue) into the build.
      const files = entrypoint.synthetic
        ? entrypoint.outputs?.reduce((acc, ext) => ({
          ...acc,
          [ext]: []
        }), {})
        : manager.getSourceFiles(
          self.currentSourceMeta,
          { composePath: self.composeSourceImportPath }
        );

      const output = await manager.getOutput(files, {
        modules: self.apos.asset.getRegisteredModules(),
        suppressErrors
      });
      output.importFile = path.join(self.buildRootSource, `${entrypoint.name}.js`);

      return output;
    },

    // Esnure there is always an `index` entrypoint, that holds the
    // prologue and the scenes, required for the polyfill.
    // The created synthetic entrypoint will only include the prologue.
    ensureInitEntry(entrypoints) {
      const exists = entrypoints.some((entry) => entry.type === 'index');
      if (exists) {
        return entrypoints;
      }
      const first = self.apos.asset.getBuildEntrypoints()
        .find((entry) => entry.type === 'index');

      const index = {
        name: 'synth-src',
        type: 'index',
        // Synthetic entrypoints are not built, they only provide
        // a way to inject additional code (prologue) into the build.
        synthetic: true,
        label: first.label,
        scenes: first.scenes,
        inputs: [],
        outputs: [ 'js' ],
        condition: first.condition,
        prologue: first.prologue,
        ignoreSources: [],
        sources: {
          js: [],
          scss: []
        }
      };
      entrypoints.unshift(index);

      return entrypoints;
    },

    // Ensure Vite client is injected as a first entrypoint.
    // This should be called after the `ensureInitEntry` method,
    // basically as a last step. The method will add the Vite client
    // entrypoint only if needed.
    ensureViteClientEntry(entrypoints, scenes, buildOptions) {
      if (buildOptions.devServer && !entrypoints.some((entry) => entry.name === 'vite')) {
        entrypoints.unshift(self.getViteClientEntrypoint(scenes));
      }
    },

    // Add vite module preload polyfill to the first `index` entrypoint.
    // We can probably remove it soon as the browser support looks good:
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload#browser_compatibility
    //
    // The polyfill will be skipped for external frontends. External frontends
    // are responsible for including the polyfill themselves if needed.
    applyModulePreloadPolyfill(entrypoints, buildOptions) {
      if (!buildOptions.modulePreloadPolyfill) {
        return;
      }
      const first = entrypoints.find((entry) => entry.type === 'index');
      first.prologue = (first.prologue || '') +
          '\nimport \'vite/modulepreload-polyfill\';';
    },

    // Adds `manifest` property (object) to the entrypoint after a build.
    // See apos.asset.configureBuildModule() for more information.
    // This method needs a Vite manifest in order to transform it to the
    // format that is required by the asset module.
    async applyManifest(entrypoints, viteManifest) {
      const result = [];
      for (const entrypoint of entrypoints) {
        const manifest = Object.values(viteManifest)
          .find((entry) => entry.isEntry && entry.name === entrypoint.name);

        // The entrypoint type `bundled` is not processed by Vite.
        if (!manifest) {
          result.push(entrypoint);
          continue;
        }

        const convertFn = (ref) => viteManifest[ref].file;
        const css = [
          ...manifest.css || [],
          ...getFiles({
            manifest: viteManifest,
            entry: manifest,
            sources: [ 'imports', 'dynamicImports' ],
            target: 'css'
          })
        ];
        const assets = [
          ...manifest.assets || [],
          ...getFiles({
            manifest: viteManifest,
            entry: manifest,
            sources: [ 'imports', 'dynamicImports' ],
            target: 'assets'
          })
        ];
        const imports = [
          ...manifest.imports?.map(convertFn) ?? [],
          ...getFiles({
            manifest: viteManifest,
            entry: manifest,
            convertFn,
            sources: [ 'imports' ],
            target: 'imports'
          })
        ];
        const dynamicImports = [
          ...manifest.dynamicImports?.map(convertFn) ?? [],
          ...getFiles({
            manifest: viteManifest,
            entry: manifest,
            convertFn,
            sources: [ 'dynamicImports' ],
            target: 'dynamicImports'
          })
        ];
        entrypoint.manifest = {
          root: self.distFolderName,
          files: {
            js: [ manifest.file ],
            css,
            assets,
            imports,
            dynamicImports
          },
          src: {
            js: [ manifest.src ]
          },
          devServer: self.hasDevServerUrl(entrypoint.type)
        };
        result.push(entrypoint);
      }

      function defaultConvertFn(ref) {
        return ref;
      }
      function getFiles({
        manifest, entry, data, sources, target, convertFn = defaultConvertFn
      }, acc = [], seen = {}) {
        if (Array.isArray(data)) {
          acc.push(...data.map(convertFn));
        }
        for (const source of sources) {
          if (!Array.isArray(entry?.[source])) {
            continue;
          }
          entry[source].forEach(ref => {
            if (seen[`${source}-${ref}`]) {
              return;
            }
            seen[`${source}-${ref}`] = true;
            manifest[ref] && getFiles({
              manifest,
              entry: manifest[ref],
              data: manifest[ref][target],
              sources,
              target,
              convertFn
            }, acc, seen);
          });
        }
        return acc;
      }

      return result;
    },

    // Accepts an entrypoint and optional files object and returns a manifest-like object.
    // This handler is used in the initializing phase of the build process.
    // In scenarios where the module build is not tirggered at all
    // (e.g. boot in production),
    // the core system will use its own saved manifest to identify the files that has to
    // be injected in the browser. This manifest is mostly used in development (especially
    // the `devServer` property) when a build for given entrypoint is not triggered
    // (because this entrypoint is served by the dev server).
    toManifest(entrypoint, files) {
      if (entrypoint.type === 'bundled') {
        const result = {
          root: '',
          files: {
            js: files?.js || [],
            css: files?.css || [],
            assets: [],
            imports: [],
            dynamicImports: []
          },
          // Bundled entrypoints are not served by the dev server.
          src: null,
          devServer: false
        };
        if (result.files.js.length || result.files.css.length) {
          return result;
        }
        return null;
      }
      return {
        root: self.distFolderName,
        files: {
          js: [],
          css: [],
          assets: [],
          imports: [],
          dynamicImports: []
        },
        // This can be extended, for now we only support JS entries.
        // It's used to inject the entrypoint into the HTML.
        src: {
          js: [ path.join(self.buildSourceFolderName, `${entrypoint.name}.js`) ]
        },
        devServer: self.hasDevServerUrl(entrypoint.type)
      };
    },

    // Get the build manifest produced by Vite build for the current run.
    // If `id` is provided, it will return the manifest for the given ID.
    // Possible values are `public` and `apos`.
    async getViteBuildManifest(id) {
      let apos = {};
      let pub = {};
      if (!id || id === 'apos') {
        try {
          apos = await fs.readJson(self.buildManifestPath.apos);
        } catch (e) {
          apos = {};
        }
      }
      if (!id || id === 'public') {
        try {
          pub = await fs.readJson(self.buildManifestPath.public);
        } catch (e) {
          pub = {};
        }
      }

      return {
        ...apos,
        ...pub
      };
    },

    // `id` is `public` or `apos`
    hasViteBuildManifest(id) {
      return fs.existsSync(self.buildManifestPath[id]);
    },

    // Filter the entrypoints for different devServer scenarios in development.
    // The build option `devServer` can be `public` or `apos`. We want to filter
    // the entrypoints based on that.
    // `id` is `public` or `apos`
    // TODO: filtering `bundled` by type does not scale well. We need to introduce
    // a `bundled: Boolean` property to the entrypoint configuration in the future.
    // Also we might need a specific `buildTag` (or better name) that corresponds
    // to `devServer` and `types` (can be string 'public' or 'apos'). This will allow us
    // to introduce new entrypoint types and features without breaking the current logic.
    getBuildEntrypointsFor(id) {
      if (id === 'apos') {
        return self.entrypointsManifest
          .filter((entrypoint) => entrypoint.type === 'apos');
      }
      if (id === 'public') {
        return self.entrypointsManifest
          .filter((entrypoint) => ![ 'bundled', 'apos' ].includes(entrypoint.type));
      }
      throw new Error(`Invalid build ID "${id}"`);
    },

    // Return the configuration and the vite build function for a given build scenario.
    // `id` is `public` or `apos`
    async getViteBuild(id, options) {
      const { build } = await import('vite');
      const config = await self.getViteConfig(id, options);
      return {
        build,
        config
      };
    },

    // Get the Inline Vite configuration for a given build scenario.
    // https://vite.dev/guide/api-javascript.html#inlineconfig
    // This is the high level method that should be used to get the Vite configuration.
    // `id` is `public` or `apos`.
    // `options` is build options.
    // `command` is `build` or `serve`.
    async getViteConfig(id, options, command = 'build') {
      const env = {
        command,
        mode: self.apos.asset.isProductionMode() ? 'production' : 'development'
      };
      const baseConfig = await self.getBaseViteConfig(id, options, env);

      /** @type {import('vite').UserConfig} */
      let resolved;
      if (id === 'public') {
        resolved = await (await self.getPublicViteConfig(baseConfig))(env);
      }
      if (id === 'apos') {
        resolved = await (await self.getAposViteConfig(baseConfig))(env);
      }

      if (!resolved) {
        throw new Error(`Invalid Vite config ID "${id}"`);
      }

      return self.getFinalViteConfig(id, options, resolved, env);
    },

    // Return the input configuration for the Vite build for a given build scenario.
    // `id` is `public` or `apos`.
    getBuildInputs(id) {
      return Object.fromEntries(
        self.getBuildEntrypointsFor(id)
          .map((entrypoint) => ([
            entrypoint.name,
            path.join(self.buildRootSource, `${entrypoint.name}.js`)
          ]))
      );
    },

    /**
     * Get the base Vite (user) configuration, used in all other configurations.
     *
     * @param {string} id `public` or `apos`
     * @param {object} options build options
     * @param {import('vite').ConfigEnv} env vite config environment
     * @returns {Promise<import('vite').UserConfig>}
     */
    async getBaseViteConfig(id, options, env) {
      return viteBaseConfig({
        mode: env.mode,
        base: self.apos.asset.getAssetBaseUrl(),
        root: self.buildRoot,
        cacheDir: path.join(self.cacheDirBase, id),
        manifestRelPath: self.buildManifestPath[`${id}Rel`],
        sourceMaps: options.sourcemaps,
        assetOptions: self.apos.asset.options
      });
    },

    /**
     * Get the vite (user) configuration for the `apos` build.
     * Return a function that accepts Vite Environment object and
     * returns the merged Vite config.
     *
     * @param {import('vite').UserConfig} baseConfig
     * @returns {Promise<
     * (configEnv: import('vite').ConfigEnv) => Promise<import('vite').UserConfig>
     * >}
     */
    async getAposViteConfig(baseConfig) {
      const vite = await import('vite');
      const config = await viteAposConfig({
        sourceRoot: self.buildRootSource,
        input: self.getBuildInputs('apos')
      });
      const postcssConfig = await self.getPostcssConfig(self.buildOptions, 'apos');
      const aposConfig = vite.mergeConfig(config, postcssConfig);

      const mergeConfigs = vite.defineConfig((configEnv) => {
        return vite.mergeConfig(baseConfig, aposConfig, true);
      });

      return mergeConfigs;
    },

    /**
     * Get the vite (user) configuration for the `public` build.
     * Return a function that accepts Vite Environment object and returns
     * the merged Vite config.
     * The project level configuration provided by modules and a root level
     * `apos.vite.config.js` will be merged with the base and public configurations.
     *
     *
     * @param {import('vite').UserConfig} baseConfig
     * @return {Promise<
     * (configEnv: import('vite').ConfigEnv) => Promise<import('vite').UserConfig>
     * >}
     */
    async getPublicViteConfig(baseConfig) {
      const vite = await import('vite');
      // The base public config
      const config = await vitePublicConfig({
        sourceRoot: self.buildRootSource,
        input: self.getBuildInputs('public')
      });
      const postcssConfig = await self.getPostcssConfig(self.buildOptions, 'public');
      const publicConfig = vite.mergeConfig(config, postcssConfig);
      const mergeConfigs = vite.defineConfig(async (configEnv) => {
        // Module configurations
        let merged = vite.mergeConfig(baseConfig, publicConfig);
        for (const { extensions, name } of self.getBuildEntrypointsFor('public')) {
          if (!extensions) {
            continue;
          }
          for (const [ key, value ] of Object.entries(extensions)) {
            self.apos.asset.printDebug('public-config-merge', `[${name}] merging "${key}"`, {
              entrypoint: name,
              [key]: value
            });
            merged = vite.mergeConfig(merged, value);
          }
        }

        // The `apos.vite.config.js` at the project root can be used to extend
        // the public config.
        const userConfig = self.userConfigFile
          ? (await vite.loadConfigFromFile(
            configEnv,
            self.userConfigFile,
            self.apos.rootDir,
            'silent'
          ))?.config || {}
          : {};

        merged = vite.mergeConfig(merged, userConfig);

        return merged;
      });

      return mergeConfigs;
    },

    /**
     * Gets postcss config for the current environment *
     *
     * @param {object} buildOptions: build options
     * @param {string} id: apos / public
     *
     * @returns {Promise<import('vite').UserConfig>}
     */
    async getPostcssConfig(buildOptions, id) {
      const {
        enable: enablePostcssViewport, ...postcssViewportOptions
      } = buildOptions?.postcssViewportToContainerToggle || {};

      const postcssPlugins = [];
      if (id === 'public') {
        try {
          const {
            plugins
          } = await postcssrc({}, self.apos.rootDir);
          postcssPlugins.push(...plugins);
        } catch (err) { /* Project has no postcss config file */ }

        if (enablePostcssViewport) {
          postcssPlugins.push(postcssViewportToContainerToggle(postcssViewportOptions));
        }
      }

      if (id === 'apos') {
        postcssPlugins.push(
          require('autoprefixer')()
        );
      }

      return vitePostcssConfig({ plugins: postcssPlugins });
    },

    /**
     * Accepts merged vite User configuration and produces
     * the final Vite Inline configuration.
     *
     * @param {string} id `public` or `apos`
     * @param {object} buildOptions build options
     * @param {import('vite').InlineConfig} baseConfig
     * @param {import('vite').ConfigEnv} env vite config environment
     * @returns {Promise<import('vite').InlineConfig>}
     */
    async getFinalViteConfig(id, buildOptions, baseConfig, env) {
      baseConfig.configFile = false;
      baseConfig.envFile = false;

      if (env.command === 'build') {
        return baseConfig;
      }

      const { mergeConfig } = await import('vite');
      const serveConfig = await viteServeConfig({
        app: self.apos.app,
        httpServer: self.apos.modules['@apostrophecms/express'].server,
        hasHMR: buildOptions.hmr,
        hmrPort: buildOptions.hmrPort
      });

      return mergeConfig(baseConfig, serveConfig);
    }
  };
};
