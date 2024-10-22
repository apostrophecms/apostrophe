const path = require('path');
const fs = require('fs-extra');
const util = require('util');
const express = require('express');
const Promise = require('bluebird');
const { stripIndent } = require('common-tags');
const { createId } = require('@paralleldrive/cuid2');
const chokidar = require('chokidar');
const _ = require('lodash');
const { glob } = require('glob');
const globalIcons = require('./lib/globalIcons');
const {
  checkModulesWebpackConfig,
  getWebpackExtensions,
  fillExtraBundles,
  findNodeModulesSymlinks,
  transformRebundledFor
} = require('./lib/webpack/utils');

const { getBuildExtensions } = require('./lib/build-utils');
const buildManagerFactory = require('./lib/build/managers');

const webpackBuldFactory = require('./lib/build');

module.exports = {

  options: {
    alias: 'asset',
    // If true, create both modern JavaScript and ES5 (IE11) compatibility
    // builds of the ui/src browser code in each module, and serve them
    // to the appropriate browsers without overhead for modern browsers.
    // This does not attempt to compile the admin UI (ui/apos) for ES5.
    es5: false,
    // If this option is true and process.env.NODE_ENV is not `production`,
    // the browser will refresh when the Apostrophe application
    // restarts. A useful companion to `nodemon`.
    refreshOnRestart: false,
    // If false no UI assets sources will be watched in development.
    // This option has no effect in production (watch disabled).
    watch: true,
    // Miliseconds to wait between asset sources changes before
    // performing a build.
    watchDebounceMs: 1000,
    // Object containing instructions for remapping existing bundles.
    // See the modulre reference documentation for more information.
    rebundleModules: undefined,
    // In case of external front end like Astro, this option allows to
    // disable the build of the public UI assets.
    publicBundle: true,
    // Breakpoint preview in the admin UI.
    // NOTE: the whole breakpointPreviewMode option must be carried over
    // to the project for overrides to work properly.
    // Nested object options are not deep merged in Apostrophe.
    breakpointPreviewMode: {
      // Enable breakpoint preview mode
      enable: true,
      // Warn during build about unsupported media queries.
      debug: false,
      // If we can resize the preview container?
      resizable: false,
      // Screens with icons
      // For adding icons, please refer to the icons documentation
      // https://docs.apostrophecms.org/reference/module-api/module-overview.html#icons
      screens: {
        desktop: {
          label: 'apostrophe:breakpointPreviewDesktop',
          width: '1440px',
          height: '900px',
          icon: 'monitor-icon',
          shortcut: true
        },
        tablet: {
          label: 'apostrophe:breakpointPreviewTablet',
          width: '1024px',
          height: '768px',
          icon: 'tablet-icon',
          shortcut: true
        },
        mobile: {
          label: 'apostrophe:breakpointPreviewMobile',
          width: '414px',
          height: '896px',
          icon: 'cellphone-icon',
          shortcut: true
        }
      },
      // Transform method used on media feature
      // Can be either:
      // - (mediaFeature) => { return mediaFeature.replaceAll('xx', 'yy'); }
      // - null
      transform: null
    },
    // If true, the source maps will be generated in production.
    // This option is useful for debugging in production and is only
    // available when an external build module is registered (it doesn't
    // with the internal webpack build).
    productionSourceMaps: false,
    // The configuration to disable development server when supported.
    devServer: true
  },

  async init(self) {
    // Cache the environment variables, because Node.js doesn't makes
    // system calls to get them every time. We don't expect them to change during
    // the runtime.
    self.isDebugMode = process.env.APOS_ASSET_DEBUG === '1';
    self.isDevMode = process.env.NODE_ENV !== 'production';
    self.isProductionMode = process.env.NODE_ENV === 'production';
    // External build module configuration (when registered).
    // See method `configureBuildModule` for more information.
    self.externalBuildModuleConfig = {};

    self.restartId = self.apos.util.generateId();
    self.iconMap = {
      ...globalIcons
    };

    // Used throughout the build init process.
    self.modulesToBeInstantiated = self.apos.modulesToBeInstantiated();
    // The namespace filled by `configureBuilds()`
    self.builds = {};
    self.configureBuilds();

    // The namespace filled by `initUploadfs()`
    self.uploadfs = null;
    await self.initUploadfs();

    self.enableBrowserData();

    // The namespace filled by `setWebpackExtensions()` (`webpack` property processing).
    self.extraBundles = {};
    self.webpackExtensions = {};
    self.webpackExtensionOptions = {};
    self.verifiedBundles = {};
    self.rebundleModules = [];
    await self.setWebpackExtensions();

    // The namespace filled by `setBuildExtensions()` (`build` property).
    // The properties above set by `setWebpackExtensions()` will be also overridden.
    self.moduleBuildExtensions = {};
    await self.setBuildExtensions();
    // Set only if the external build module is registered. Contains
    // the entrypoints configuration for the current build module.
    self.moduleBuildEntrypoints = [];
    // Set after a successful build. It contains only the processed entrypoints
    // with attached `bundles` property containing the bundle files. This can be
    // later called by the systems that are injecting the scripts and stylesheets
    // in the browser. We also need this as a separate property for possible
    // server side hot module replacement scenarios.
    self.currentBuildManifest = {
      sourceMapsRoot: null,
      devServerUrl: null,
      entrypoints: []
    };
    // Set after a successful build. Contains objects with properties `name`, `source`,
    // and `target` for each copied public asset location. We need this as a separate
    // property for possible server side hot module replacement scenarios.
    self.currentPublicAssetLocations = [];

    self.buildWatcherEnable = process.env.APOS_ASSET_WATCH !== '0' && self.options.watch !== false;
    self.buildWatcherDebounceMs = parseInt(self.options.watchDebounceMs || 1000, 10);
    self.buildWatcher = null;
    // A signal that the build data has been initialized and all modules
    // have been registered.
    await self.emit('afterInit');
  },
  handlers (self) {
    return {
      'apostrophe:modulesRegistered': {
        async runUiBuildTask() {
          const ran = await self.autorunUiBuildTask();

          // When the build is not executed, make the minimum required computations
          // to ensure we can inject the assets in the browser.
          if (!ran) {
            await self.runWithoutBuild();
          }
          if (ran) {
            await self.watchUiAndRebuild();
          }
        },
        injectAssetsPlaceholders() {
          self.apos.template.prepend('head', '@apostrophecms/asset:stylesheets');
          self.apos.template.append('body', '@apostrophecms/asset:scripts');
        }
      },
      'apostrophe:destroy': {
        async destroyUploadfs() {
          if (self.uploadfs && (self.uploadfs !== self.apos.uploadfs)) {
            await Promise.promisify(self.uploadfs.destroy)();
          }
        },
        async destroyBuildWatcher() {
          if (self.buildWatcher) {
            await self.buildWatcher.close();
            self.buildWatcher = null;
          }
        }
      }
    };
  },
  components(self) {
    return {
      scripts(req, data) {
        const placeholder = `[scripts-placeholder:${createId()}]`;

        req.scriptsPlaceholder = placeholder;

        return {
          placeholder
        };
      },
      stylesheets(req, data) {
        const placeholder = `[stylesheets-placeholder:${createId()}]`;

        req.stylesheetsPlaceholder = placeholder;

        return {
          placeholder
        };
      }
    };
  },
  tasks(self) {
    const webpackBuild = webpackBuldFactory(self);

    return {
      build: {
        usage: 'Build Apostrophe frontend CSS and JS bundles',
        afterModuleInit: true,
        async task(argv = {}) {
          if (self.hasBuildModule()) {
            return self.build(argv);
          }
          // Debugging but only if we don't have an external build module.
          // If we do, the debug output is handled by the respective setter.
          self.printDebug('setWebpackExtensions', {
            builds: self.builds,
            extraBundles: self.extraBundles,
            webpackExtensions: self.webpackExtensions,
            webpackExtensionOptions: self.webpackExtensionOptions,
            verifiedBundles: self.verifiedBundles,
            rebundleModules: self.rebundleModules
          });
          return webpackBuild.task(argv);
        }
      },

      'clear-cache': {
        usage: 'Clear build cache',
        afterModuleReady: true,
        // TODO: add and call `proxyClearCache` method for external build modules.
        async task(argv) {
          const cacheBaseDir = self.getCacheBasePath();

          await fs.emptyDir(cacheBaseDir);
          self.apos.util.log(
            self.apos.task.getReq().t('apostrophe:assetWebpackCacheCleared')
          );
        }
      }
    };
  },
  middleware(self) {
    return {
      serveStaticAssets: {
        before: '@apostrophecms/express',
        middleware: express.static(self.apos.rootDir + '/public', self.options.static || {})
      }
    };
  },
  methods(self) {
    const getBuildManager = buildManagerFactory(self);
    return {
      // START external build modules feature

      // Extending this method allows a direct override the external build module configuration.
      // The internal module property should never be used directly used nor modified after the initialization.
      getBuildModuleConfig() {
        return self.externalBuildModuleConfig;
      },
      // External build modules can register themselves here. This should happen on the
      // special asset module event `afterInit` (see `handlers`).
      // options:
      // - alias (required): the alias string to use in the webpack configuration.
      //   This usually matches the bundler name, e.g. 'vite', 'webpack', etc.
      // - devServer (optional): whether the build module supports a dev server.
      // - hmr (optional): whether the build module supports a hot module replacement.
      //
      // The external build module should initialize before the asset module:
      // module.exports = {
      //   before: '@apostrophecms/asset',
      //   ...
      // };
      //
      // The external build module must implement various methods to be used by the Apostrophe core:
      //
      // `async build(options)` - the build method to be called by Apostrophe.
      // TODO: document the options object.
      // Returns an object with properties:
      // * `entrypoints`(array of objects), containing all entrypoints that are processed by the build module.
      //    Beside the standard entrypoint shape (see `getBuildEntrypoints()`),
      //    each entrypoint should also contain a `manifest` object with the following properties:
      //    - `root` - the relative to `apos.asset.getBuildRootDir()` path to the folder containing
      //    all files described in the manifest.
      //    - `files` - object which properties are:
      //      - `js` - an array of paths to the JS files. The only JS files that are getting bundled by scene.
      //        It's usually the main entrypoint file. It's an array to allow additional files for bundling.
      //      - `css` - an array of paths to the CSS files. Available only when the build manifest is available.
      //        They are bundled by scene.
      //      - `imports` - an array of paths to the statically imported (shared) JS files.
      //        These are copied to the bundle folder and released.
      //        They will be inserted into the HTML with `rel="modulepreload"` attribute.
      //      - `dynamicImports` - an array of paths to the dynamically imported JS files.
      //        These are copied to the bundle folder and released, but not inserted into the HTML.
      //      - `assets` - an array of paths to the assets (images, fonts, etc.) used by the entrypoint.
      //        These should be copied to the bundle folder and released and are not inserted into the HTML.
      //    - `src` - array of relative URL path to the entry source file that should be served
      //      by the dev server. Can be null (e.g. `ui/public`). Usually the main entrypoint file.
      //      It's an array to allow additional files for serving.
      //    - `devServerUrl` - the base server URL for the dev server if available.
      // * `sourceMapsRoot` (string) the absolute path to the location when source maps are stored. They will be
      //    copied to the bundle folder with the folder same structure.
      configureBuildModule(moduleSelf, options = {}) {
        const name = moduleSelf.__meta.name;
        if (self.hasBuildModule()) {
          throw new Error(
            `Module ${name} is attempting to register as a build module, but ${self.getBuildModuleConfig().name} is already registered.`
          );
        }

        if (!options.alias) {
          throw new Error(
            `Module ${name} is attempting to register as a build module, but no alias is provided.`
          );
        }

        self.externalBuildModuleConfig = {
          name,
          alias: options.alias,
          devServer: options.devServer,
          hmr: options.hmr
        };
        self.setBuildExtensionsForExternalModule();
      },
      hasBuildModule() {
        return !!self.getBuildModuleConfig().name;
      },
      getBuildModule() {
        return self.apos.modules[self.getBuildModuleConfig().name];
      },
      getBuildModuleAlias() {
        return self.getBuildModuleConfig().alias;
      },
      // Get entrypoints configuration for the build module.
      // Provide recompute `true` to force the recomputation of the entrypoints.
      // This is useful in HMR mode, where after a "create" file event, the verified bundles
      // can change and the entrypoints configuration should be updated. Usually the
      // the core asset module will take care of this.
      //
      // Returns an array of objects with the following properties:
      // - `name`: the entrypoint name. It's usually the relative to `ui` folder
      //   name(`src`, `apos`, `public`) or an extra bundle name.
      // - `type`: (enum) the entrypoint type. It can be `index`, `apos`, `custom` (e.g. extra bundles) or
      //   `bundled` (e.g. `ui/public`). Every type has associated manager that provides handling for the entrypoint.
      // - `useMeta`: if `true`, the entrypoint will be created based on the source metadata (see
      //   `computeSourceMeta()` method).
      // - `bundle`: if `true`, the entrypoint should be bundled by the build module.
      // - `index`: if `true`, the entrypoint processes only `{name}/index.{js,scss}` module files.
      // - `apos`: if `true`, the entrypoint processes components, icons and apps.
      // - `ignoreSources`: an array of sources that shouldn't be processed when creating the entrypoint.
      // - `sources`: an object with `js` and `scss` arrays of extra sources to be included in the entrypoint.
      //    These sources are not affected by the `ignoreSources` configuration.
      // - `extensions`: an optional object with the additional configuration for the entrypoint, gathered from the
      //    `build.extensions` modules property.
      // - `prologue`: a string with the prologue to be added to the entrypoint.
      // - `condition`: the JS `module` or `nomodule` condition. Undefined for no specific condition.
      // - `outputs`: an array of output extensions for the entrypoint (currently not fully utilized)
      // - `scenes`: an array of scenes to be in the final post-bundle step. The scenes are instructions
      //   for the Apostrophe core to combine the builds and release them. Currently supported scenes are
      //   `apos` and `public` and custom scene names equal to extra bundle (only those who should be
      //   loaded separately in the browser).
      getBuildEntrypoints(recompute = false) {
        if (!self.hasBuildModule()) {
          return self.builds;
        }
        if (recompute) {
          self.setBuildExtensionsForExternalModule();
        }

        return self.moduleBuildEntrypoints;
      },
      // Get the entrypoint manager for a given `entrypoint` by its type.
      // The entrypoint parameter is an item from the entrypoints configuration.
      // See `getBuildEntrypoints()` for the entrypoint configuration schema.
      // the following methods:
      // - getSourceFiles(meta, { composePath? }): get the source files for the entrypoint.
      //   The `composePath` is an optional function to compose the path to the source file.
      //   It accepts `file` (a relative to `ui/{folderToSearch}` file path) and `metaEntry`
      //   (the module metadata entry, see `computeSourceMeta()`).
      // - async getOutput(sourceFiles, { modules }): get the output data for the entrypoint.
      //   The `sourceFiles` is in format compatible with the output of `manager.getSourceFiles()`.
      //   The `modules` option is the list of all modules, usually the cached result
      //   of `self.apos.modulesToBeInstantiated()`.
      getEntrypointManger(entrypoint) {
        return getBuildManager(entrypoint);
      },
      hasDevServer() {
        return self.isDevMode &&
          self.options.devServer !== false &&
          self.buildWatcherEnable &&
          !!self.getBuildModuleConfig().devServer;
      },
      hasHMR() {
        return self.hasDevServer() &&
          !!self.getBuildModuleConfig().hmr;
      },
      getBuildOptions(argv) {
        const options = {
          isTask: !argv['check-apos-build'],
          hmr: self.hasHMR()
        };
        options.devServer = !options.isTask && self.hasDevServer();

        return options;
      },
      // Build the assets using the external build module.
      // The `argv` object is the `argv` object passed to the task.
      // TODO: All other cases should be handled here (external frontend, see the legacy `build` task).
      async build(argv) {
        const buildOptions = self.getBuildOptions(argv);

        self.currentPublicAssetLocations = await self.copyModulesFolder({
          target: path.join(self.getBundleRootDir(), 'modules'),
          folder: 'public',
          modules: self.modulesToBeInstantiated
        });

        // Switch to dev server mode if the dev server is enabled.
        if (buildOptions.devServer) {
          return self.startDevServer(buildOptions);
        }

        self.currentBuildManifest = await self.getBuildModule()
          .build(buildOptions);

        // Create and copy bundles per scene into the bundle root.
        const bundles = await self.computeBuildScenes(self.currentBuildManifest);
        // Retrieve the public assets from the bundle root for deployment.
        const publicAssets = await glob('modules/**/*', {
          cwd: self.getBundleRootDir(),
          nodir: true,
          follow: false,
          absolute: false
        });
        // Copy the static & dynamic imports and file assets to the bundle root.
        const deployableArtefacts = await self.copyBuildArtefacts(self.currentBuildManifest);
        // Copy the source maps to the bundle root.
        const sourceMaps = await self.copyBuildSourceMaps(self.currentBuildManifest);
        // Save the build manifest in the bundle root.
        await self.saveBuildManifest(self.currentBuildManifest);

        // Deploy everything to the release location.
        // All paths are relative to the bundle root.
        const deployFiles = [
          ...new Set(
            [
              ...publicAssets,
              ...bundles,
              ...deployableArtefacts
            ]
          )
        ];
        if (self.options.productionSourceMaps) {
          deployFiles.push(...sourceMaps);
        }
        await self.deploy(deployFiles);

        self.printDebug('build-end', {
          currentBuildManifest: self.currentBuildManifest,
          deployFiles
        });
      },
      async startDevServer(buildOptions) {
        self.currentBuildManifest = await self.getBuildModule()
          .startDevServer(buildOptions);

        await self.computeBuildScenes(self.currentBuildManifest, { write: true });
      },
      // The new watch system, works only when an external build module is registered.
      // This method is invoked only when appropriate.
      async watch() {
        if (!self.buildWatcher) {
          const watchDirs = (await self.computeWatchMeta(self.getRegisteredModules()))
            .map(entry => entry.dirname);

          const instance = chokidar.watch(watchDirs, {
            cwd: self.apos.rootDir,
            ignoreInitial: true
            // ignored: self.ignoreWatchLocation
          });
          self.buildWatcher = instance;
        }

        // Log the initial watch message
        let loggedOnce = false;
        const logOnce = (...msg) => {
          if (!loggedOnce) {
            self.apos.util.log(...msg);
            loggedOnce = true;
          }
        };

        // Allow the module to add more paths, attach listeners, etc.
        await self.getBuildModule().watch(self.buildWatcher);

        self.buildWatcher
          .on('error', e => self.apos.util.error(`Watcher error: ${e}`))
          .on('ready', () => logOnce(
            self.apos.task.getReq().t('apostrophe:assetBuildWatchStarted')
          ));

        self.getBuildModule().watch(self.buildWatcher);
      },
      // Override to ignore files/folders from the watch. The method is called twice:
      // - once with only the `file` parameter
      // - once with both `file` and `fsStats` parameters
      // https://github.com/paulmillr/chokidar?tab=readme-ov-file#path-filtering
      // The `file` is the relative to the `apos.rootDir` path to the file or folder.
      // The `fsStats` is the `fs.Stats` object.
      // Return `true` to ignore the file/folder.
      ignoreWatchLocation(file, fsStats) {
        return false;
      },
      // Retrieve only existing `/ui` paths for local and npm symlinked modules.
      // Modules is usually the `modulesToBeInstantiated` array.
      async computeWatchMeta(modules) {
        const meta = (await self.computeSourceMeta({
          modules,
          stats: true
        }))
          .filter(entry => {
            return (!entry.npm && entry.exists) || (entry.npm && entry.symlink);
          });

        return meta;
      },
      // Run the minimal required computations to ensure manifest data is available.
      async runWithoutBuild() {
        if (!self.hasBuildModule()) {
          return;
        }

        // Hidrate the entrypoints with the saved manifest data and
        // set the current build manifest data.
        const entrypoints = self.getBuildEntrypoints();
        const { manifest = [] } = await self.loadSavedBuildManifest();
        for (const entry of manifest) {
          const entrypoint = entrypoints.find((e) => e.name === entry.name);
          if (!entrypoint || entrypoint.manifest) {
            continue;
          }
          entrypoint.manifest = entry;
          if (!manifest.bundles) {
            entrypoint.bundles = new Set(entry.bundles);
          }
          self.currentBuildManifest.entrypoints.push({
            ...entrypoint,
            manifest: entry
          });
        }
      },
      async saveBuildManifest(manifest) {
        const { entrypoints } = manifest;
        const content = [];

        for (const entrypoint of entrypoints) {
          const {
            manifest, name, bundles
          } = entrypoint;
          if (!manifest) {
            continue;
          }

          const {
            files, devServerUrl, root
          } = manifest;
          content.push({
            name,
            root,
            files,
            bundles: Array.from(bundles ?? []),
            devServerUrl
          });
        }
        await fs.outputJson(
          path.join(self.getBundleRootDir(), '.manifest.json'),
          {
            ts: Date.now(),
            manifest: content
          }
        );
      },
      async loadSavedBuildManifest() {
        const manifestPath = path.join(self.getBundleRootDir(), '.manifest.json');
        try {
          return JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        } catch (e) {
          if (self.apos.options.autoBuild !== false) {
            self.apos.util.error(`Error loading the saved build manifest: ${e.message}`);
          }
          return {};
        }
      },
      getRegisteredModules() {
        return self.modulesToBeInstantiated;
      },
      // Get the entrypoints containing manifest data currently initialized. The information
      // is available after the build initialization is done:
      // - after an actual build task (any environment)
      // - after the dev server is started (development)
      // - after a saved build manifest is loaded (production)
      getCurrentBuildEntrypoints() {
        return self.currentBuildManifest.entrypoints ?? [];
      },
      // This should be used by build systems to assemble the URL for a dev server middleware.
      // This method can be overridden for e.g. multisite setups.
      getBaseDevSiteUrl() {
        return (self.apos.baseUrl || '') + self.apos.prefix;
      },
      // Deploy all public assets for release. Executes only in production.
      // `files` is a flat array of relative to the bundleRoot (getBundleRoot) paths
      // to the files to be deployed.
      async deploy(files) {
        if (process.env.NODE_ENV !== 'production') {
          return;
        }
        let copyIn;
        let releaseDir;
        const bundleDir = self.getBundleRootDir();
        if (process.env.APOS_UPLOADFS_ASSETS) {
        // The right choice if uploadfs is mapped to S3, Azure, etc.,
        // not the local filesystem
          copyIn = util.promisify(self.uploadfs.copyIn);
          releaseDir = self.getRelaseRootDir(true);
        } else {
        // The right choice with Docker if uploadfs is just the local filesystem
        // mapped to a volume (a Docker build step can't access that)
          copyIn = fsCopyIn;
          releaseDir = self.getRelaseRootDir();
          await fs.mkdirp(releaseDir);
        }
        for (const file of files) {
          const src = path.join(bundleDir, file);
          await copyIn(
            src,
            path.join(releaseDir, file)
          );
          // await fs.remove(src);
        }

        async function fsCopyIn(from, to) {
          const base = path.dirname(to);
          await fs.mkdirp(base);
          return fs.copyFile(from, to);
        }
      },
      // Write the bundle files for the scenes, using the external build module manifest.
      // Add `bundles` property to the entrypoiny configuration contaning the bundle files
      // used later when injecting the scripts and stylesheets in the browser.
      // The manifest is the return value of the external build module build method
      // (see `self.build()` method).
      async computeBuildScenes(manifest, { write = true } = {}) {
        const bundlePath = self.getBundleRootDir();
        const buildRoot = self.getBuildRootDir();

        const { entrypoints } = manifest;
        const configs = entrypoints.filter((entry) => !!entry.manifest);

        const scenes = [
          ...new Set(configs.reduce((acc, { scenes }) => [ ...acc, ...scenes ], []))
        ];

        const bundles = scenes.reduce((acc, scene) => {
          const sceneConfigs = configs.filter((config) => config.scenes.includes(scene));
          acc.push(
            ...writeScene({
              configs: sceneConfigs,
              scene,
              bundlePath
            })
          );
          return acc;
        }, []);

        return bundles;

        function writeScene({
          scene, configs, bundlePath
        }) {
          const bundles = configs.reduce((acc, config) => {
            const { root, files } = config.manifest;

            // const jsTargetName = `${scene}-${config.condition ?? 'module'}-bundle.js`;
            // Combining script type modules is a bad idea. We need to load them per
            // entrypoint and not a scene.
            const prefix = config.name === scene ? scene : `${scene}-${config.name}`;
            const jsTargetName = `${prefix}-${config.condition ?? 'module'}-bundle.js`;
            // CSS bundles are always scene based.
            const cssTargetName = `${scene}-bundle.css`;
            const jsFilePaths = files.js?.map(f => path.join(buildRoot, root, f)) ?? [];
            const cssFilePaths = files.css?.map(f => path.join(buildRoot, root, f)) ?? [];

            if (jsFilePaths.length) {
              config.bundles = config.bundles || new Set();
              config.bundles.add(jsTargetName);
              acc[jsTargetName] = acc[jsTargetName] || [];
              acc[jsTargetName].push(...jsFilePaths);
            }

            if (cssFilePaths.length) {
              config.bundles = config.bundles || new Set();
              config.bundles.add(cssTargetName);
              acc[cssTargetName] = acc[cssTargetName] || [];
              acc[cssTargetName].push(...cssFilePaths);
            }
            return acc;
          }, {});

          if (!write) {
            return Object.keys(bundles);
          }
          for (const [ target, files ] of Object.entries(bundles)) {
            if (!files.length) {
              delete bundles[target];
              continue;
            }
            const content = files.map(f =>
              fs.existsSync(f)
                ? `\n\n/** ${path.basename(f)} **/\n\n` + fs.readFileSync(f, 'utf-8')
                : ''
            )
              .join('\n')
              .trim();
            if (!content.trim().length) {
              delete bundles[target];
              continue;
            }
            fs.outputFileSync(
              path.join(bundlePath, target),
              content
            );
          }

          return Object.keys(bundles);
        }
      },
      async copyBuildArtefacts(manifest) {
        const buildRoot = self.getBuildRootDir();
        const bundleRoot = self.getBundleRootDir();
        const { entrypoints } = manifest;
        const result = [];
        const seen = {};
        for (const entrypoint of entrypoints) {
          const { manifest } = entrypoint;
          if (!manifest) {
            continue;
          }

          const { root, files } = manifest;
          const {
            imports = [], assets = [], dynamicImports = []
          } = files;
          if (!imports.length) {
            continue;
          }

          for (const file of [ ...imports, ...dynamicImports, ...assets ]) {
            if (seen[file]) {
              continue;
            }
            copy(file, root);
            seen[file] = true;
          }
        }

        async function copy(file, root) {
          const from = path.join(buildRoot, root, file);
          const to = path.join(bundleRoot, file);
          const base = path.dirname(to);

          await fs.mkdirp(base);
          await fs.copyFile(from, to);
          result.push(file);
        }

        return result;
      },
      async copyBuildSourceMaps(manifest) {
        if (!manifest.sourceMapsRoot) {
          return [];
        }
        const bundleRoot = self.getBundleRootDir();
        const result = [];
        const sourceMaps = await glob('**/*.map', {
          cwd: manifest.sourceMapsRoot,
          nodir: true,
          follow: false,
          absolute: false
        });
        for (const file of sourceMaps) {
          const from = path.join(manifest.sourceMapsRoot, file);
          const to = path.join(bundleRoot, file);
          const base = path.dirname(to);

          await fs.mkdirp(base);
          await fs.copyFile(from, to);

          result.push(file);
        }

        return result;
      },
      // Shouldn't be needed, here for reference for now.
      // async copyBundledAssetsForDev(manifest) {
      //   const bundleRoot = self.getBundleRootDir();
      //   const buildRoot = self.getBuildRootDir();
      //   const { entrypoints } = manifest;
      //   await fs.mkdirp(bundleRoot);

      //   for (const entrypoint of entrypoints) {
      //     if (entrypoint.type !== 'bundled' || !entrypoint.manifest) {
      //       continue;
      //     }
      //     for (const files of Object.values(entrypoint.manifest.files)) {
      //       for (const file of files) {
      //         try {
      //           await fs.copyFile(
      //             path.join(buildRoot, entrypoint.manifest.root, file),
      //             path.join(bundleRoot, file)
      //           );
      //         } catch (e) {
      //           self.apos.util.error(`Error copying ${file} to the bundle root: ${e.message}`);
      //         }
      //       }
      //     }
      //   }
      // },
      // Compute the configuration provided per module as a `build` property.
      // It has the same shape as the legacy `webpack` property. The difference
      // is that the `build` property now supports different "vendors". An upgrade
      // path would be moving existing `webpack` configurations to `build.webpack`.
      // However, we keep the legacy `webpack` property for compatibility reasons.
      // Only external build modules will consume the `build` property.
      async setBuildExtensions() {
        self.moduleBuildExtensions = await getBuildExtensions({
          getMetadata: self.apos.synth.getMetadata,
          modulesToInstantiate: self.apos.modulesToBeInstantiated(),
          rebundleModulesConfig: self.options.rebundleModules
        });
      },
      // Ensure the namespaced by alias `moduleBuildExtensions` data is available
      // for the existing systems (BC).
      // Generate the entrypoints configuration - the new format for the build module,
      // describing the entrypoint configuration, including the extra bundles.
      // Pass evnironment variable `APOS_ASSET_DEBUG=1` to see the debug output in both
      // external build and the legacy webpack mode.
      // See the `getBuildEntrypoints()` method for the entrypoint configuration schema.
      setBuildExtensionsForExternalModule() {
        if (!self.hasBuildModule()) {
          return;
        }

        const {
          extensions = {},
          extensionOptions = {},
          verifiedBundles = {},
          rebundleModules = []
        } = self.moduleBuildExtensions[self.getBuildModuleAlias()] ?? {};

        self.extraBundles = fillExtraBundles(verifiedBundles);
        self.verifiedBundles = verifiedBundles;
        self.rebundleModules = rebundleModules;
        self.extraExtensions = extensions;
        self.extraExtensionOptions = extensionOptions;

        // FIXME: simplify the props, convert apos, index, useMeta, bundle props
        // to one `type` prop. Refactor everything to use the `type` prop. Move
        // the data extractions (for copy and create import files) to the core.
        // Generate files, write bundles based on those options, make it much more
        // abstract and extendable.
        // Generate the entrypoints configuration.
        const entrypoints = [];
        for (const [ name, config ] of Object.entries(self.builds)) {
          // 1. Transform the core configuration, more abstract, standard format.
          const enhancedConfig = {
            name,
            type: config.type,
            label: config.label,
            scenes: config.scenes,
            inputs: config.inputs,
            outputs: config.outputs,
            condition: config.condition,
            prologue: config.prologue,
            ignoreSources: [],
            sources: {
              js: [],
              scss: []
            }
          };
          entrypoints.push(enhancedConfig);

          // 2. Add the extra bundles as separate "virtual" configuration entries,
          // similar to the core ones, positioned after the `index` entry.
          // Manage the extraFiles and ignoredModules arrays of the `index` entry.
          // Add the extensions configuration to the `index` entry.
          if (enhancedConfig.type === 'index') {
            enhancedConfig.extensions = extensions;
            for (const [ bundleName, bundleConfig ] of Object.entries(verifiedBundles)) {
              // 2.1. Add extra files to the index bundle.
              if (bundleConfig.main) {
                enhancedConfig.sources.js.push(...bundleConfig.js);
                enhancedConfig.sources.scss.push(...bundleConfig.scss);
              }
              // 2.2. Exclude sources from the index bundle.
              if (!bundleConfig.main && bundleConfig.withIndex) {
                enhancedConfig.ignoreSources.push(...bundleConfig.js);
                enhancedConfig.ignoreSources.push(...bundleConfig.scss);
              }
              // 2.3. Add the extra bundle configuration so that
              // it only processes the configured `sources` (`useMeta: false`).
              if (!bundleConfig.main) {
                entrypoints.push({
                  name: bundleName,
                  type: 'custom',
                  label: `Extra bundle: ${bundleName}`,
                  scenes: [ bundleName ],
                  inputs: enhancedConfig.inputs,
                  outputs: enhancedConfig.outputs,
                  condition: enhancedConfig.condition,
                  prologue: '',
                  ignoreSources: [],
                  sources: {
                    js: bundleConfig.js,
                    scss: bundleConfig.scss
                  }
                });
              }
            }
          }
        }
        self.moduleBuildEntrypoints = entrypoints;
        self.printDebug('setBuildExtensionsForExternalModule', {
          moduleBuildEntrypoints: self.moduleBuildEntrypoints
        });
      },
      // Compute UI source and public files metadata of all modules. The result array
      // order follows the following rules:
      // - process modules in the order they are passed
      // - process each module chain starting from the base parent instance and ending with the
      //   the final extension
      // This complies with a "last wins" strategy for sources overrides - the last module in the chain should
      // win. Handling override scenarios is NOT the responsibility of this method, it only provides the
      // metadata in the right order.
      //
      // If the `asyncHandler` is an optional async function, it will be called
      // for each module entry. This is useful for external build modules to
      // e.g. copy files to the build directory during the traversal.
      //
      // The `modules` option is usually the result of `self.apos.modulesToBeInstantiated()`.
      // It's not resolved internally to avoid overhead (it's not cheap). The caller
      // is responsible for resolving and caching the modules list.
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
      //   - `symlink`: a boolean indicating if the npm module is a symlink. Non-npm
      //     modules are always considered as non-symlinks.
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
      // Copy a `folder` (if exists) from any existing module to the `target` directory.
      // The `modules` option is usually the result of `self.apos.modulesToBeInstantiated()`.
      // It's not resolved internally to avoid overhead (it's not cheap). The caller
      // is responsible for resolving and caching the modules list.
      // `target` is the absolute path to the target directory.
      // Usage:
      // const modules = self.apos.modulesToBeInstantiated();
      // const copied = await self.copyModulesFolder({
      //   target: '/path/to/build',
      //   folder: 'public',
      //   modules
      // });
      // Returns an array of objects with the following properties:
      //   - `name`: the module name.
      //   - `source`: the absolute path to the source directory.
      //   - `target`: the absolute path to the target directory.
      async copyModulesFolder({
        target, folder, modules
      }) {
        await fs.remove(target);
        await fs.mkdirp(target);
        let names = {};
        const directories = {};
        const result = [];
        // Most other modules are not actually instantiated yet, but
        // we can access their metadata, which is sufficient
        for (const name of modules) {
          const ancestorDirectories = [];
          const metadata = await self.apos.synth.getMetadata(name);
          for (const entry of metadata.__meta.chain) {
            const effectiveName = entry.my
              ? entry.name
                .replace('/my-', '/')
                .replace(/^my-/, '')
              : entry.name;
            names[effectiveName] = true;
            ancestorDirectories.push(entry.dirname);
            directories[effectiveName] = directories[effectiveName] || [];
            for (const dir of ancestorDirectories) {
              if (!directories[effectiveName].includes(dir)) {
                directories[effectiveName].push(dir);
              }
            }
          }
        }
        names = Object.keys(names);
        for (const name of names) {
          const moduleDir = `${target}/${name}`;
          for (const dir of directories[name]) {
            const srcDir = `${dir}/${folder}`;
            if (fs.existsSync(srcDir)) {
              await fs.copy(srcDir, moduleDir);
              result.push({
                name,
                source: srcDir,
                target: moduleDir
              });
            }
          }
        }

        return result;
      },
      // Get the component name from a file path. The `enumerate` option allows
      // to append a number to the component name.
      getComponentNameByPath(componentPath, { enumerate } = {}) {
        return path
          .basename(componentPath)
          .replace(/-/g, '_')
          .replace(/\.\w+/, '') + (typeof enumerate === 'number' ? `_${enumerate}` : '');
      },
      // Generate the import code for all registered icons (`icons` module prop).
      // The function returns an object with `importCode`, `registerCode`,
      // and `invokeCode` string properties.
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
          if (!importIndex.includes(importFrom)) {
            if (importFrom.substring(0, 1) === '~') {
              output.importCode += `import ${importFrom}Icon from '${importFrom.substring(1)}';\n`;
            } else {
              output.importCode += `import ${importFrom}Icon from '@apostrophecms/vue-material-design-icons/${importFrom}.vue';\n`;
            }
            importIndex.push(importFrom);
          }
          output.registerCode += `window.apos.iconComponents['${registerAs}'] = ${importFrom}Icon;\n`;
        }

        return output;
      },
      // This is a low level public helper for the external build modules.
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
      // the predicates and only validate and include the extra sources if provided.
      // In this case, the `predicates` object values (the functions) will be ignored and can be
      // set to `null`.
      // Example:
      // const sources = self.apos.asset.findSourceFiles(
      //   meta,
      //   self.myComposeSourceImportPath,
      //   {
      //     js: null,
      //     scss: null
      //   },
      //   {
      //     skipPredicates: true,
      //     extraSources: {
      //       js: [
      //         '/path/to/module-name/file.js'
      //       ],
      //       scss: [
      //         '/path/to/module-name/file.scss'
      //       ]
      //     }
      //   }
      // );
      //
      // The `options` object can be used to customize the filtering.
      // The following options are available:
      // - extraSources: An object with the same structure as the `predicates`
      //   object. The object values should be arrays of absolute paths to the
      //   source files. The files will be validated against the metadata and
      //   included in the output regardless of the predicates and the `ignoreSources`
      //   option.
      // - componentOverrides: If `true`, the function will filter out earlier
      //   versions of a component if a later version exists. If an array of
      //   predicate names is passed, the function will only filter the components
      //   for the given predicates. For example, passing `['js']` will only
      //   apply the override algorithm to the result of the `js` predicate.
      // - ignoreSources: An array of source files to ignore. The files should
      //   be absolute paths.
      // - skipPredicates: If `true`, the function will skip the predicates and
      //   only include the extra sources if provided. This option makes no sense
      //   if the `extraSources` option is not provided.
      // - pathComposer: A function to compose the path to the source file. See
      //   above for more information.
      //
      // Usage:
      // const sources = self.apos.asset.findSourceFiles(
      //   meta,
      //   {
      //     js: (file, entry) => file.startsWith(`${entry.name}/components/`) && file.endsWith('.vue')
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
      // Generate the import code for the given components.
      // The components array should contain objects with `component` and `path`
      // properties. The `component` property is the relative path to the file
      // from within the apos-build folder, and the `path` property is the absolute
      // path to the original file.
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
      // - enumerateImports: If true, the function will enumerate the import names.
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
            try {
              if (!fs.readFileSync(realPath, 'utf8').match(/export[\s\n]+default/)) {
                throw new Error(stripIndent`
                      The file ${component} does not have a default export.
  
                      Any ui/src/index.js file that does not have a function as
                      its default export will cause the build to fail in production.
                    `);
              }
            } catch (e) {
              throw new Error(`The file ${realPath} does not exist.`);
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
      // Write the entrypoint file in the build source folder. The possible
      // argument properties:
      // - importFile: The absolute path to the entrypoint file. No file is written
      //   if the property is not provided.
      // - prologue: The prologue string to prepend to the file.
      // - icons: The admin UI icon import code. Should be in a format compatible to
      //   the `getImportFileOutput()` output.
      // - components: The admin UI component import code. Should be in a format compatible to
      //   the `getImportFileOutput()` output.
      // - tiptap: The admin UI tiptap import code. Should be in a format compatible to
      //   the `getImportFileOutput()` output.
      // - apps: The admin UI app import code. Should be in a format compatible to
      //   the `getImportFileOutput()` output.
      // - js: A generic JS import code. Should be in a format compatible to
      //   the `getImportFileOutput()` output.
      // - scss: A generic Sass import code. Should be in a format compatible to
      //   the `getImportFileOutput()` output.
      // - raw: string raw content to write to the file.
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

        // Remove the identation per line.
        // It may look weird, but the result is nice and formatted import file.
        output += (js && js.invokeCode.trim().split('\n').map(l => l.trim()).join('\n') + '\n') || '';

        // Just raw content, no need to format it.
        output += (raw && raw + '\n') || '';

        if (importFile) {
          await fs.writeFile(importFile, output);
        }
        return output;
      },
      // Generate the browser script/stylesheet import code for a scene based on the available
      // manifest data and environmnent.
      // The `scene` argument is the scene name, and the `output` argument is the output type
      // - `js` or `css`.
      getBundlePageMarkup({
        scene, output
      }) {
        const entrypoints = self.apos.asset.getCurrentBuildEntrypoints()
          .filter(e => !!e.manifest && e.scenes.includes(scene) && e.outputs?.includes(output));

        const markup = [];
        const seen = {};

        for (const {
          manifest, condition, bundles: bundleSet
        } of entrypoints) {
          const hasDevServer = manifest.devServerUrl && self.hasDevServer();
          const assetUrl = hasDevServer ? manifest.devServerUrl : self.getAssetBaseSystemUrl();
          const bundles = [ ...bundleSet ?? [] ]
            .filter(b => b.startsWith(scene) && b.endsWith(`.${output}`));

          const files = hasDevServer
            ? manifest.src?.[output] ?? []
            : bundles;

          markup.push(...getMarkup(
            {
              files,
              output,
              condition,
              assetUrl
            }
          ));
        }

        return markup;

        function getMarkup({
          files, output, condition, assetUrl
        }) {
          if (output === 'css') {
            return files
              .filter(file => !seen[`${assetUrl}/${file}`])
              .map(file => {
                seen[`${assetUrl}/${file}`] = true;
                return `<link rel="stylesheet" href="${assetUrl}/${file}">`;
              });
          }
          // What is it?
          if (output !== 'js') {
            return [];
          }
          const attr = condition !== 'nomodule' ? 'type="module"' : 'nomodule';
          return files.map(file => `<script ${attr} src="${assetUrl}/${file}"></script>`);
        }
      },
      printDebug(id, data) {
        if (self.isDebugMode) {
          self.logDebug(id, data);
        }
      },
      // END external build modules feature

      // START refactoring
      async setWebpackExtensions(result) {
        const {
          extensions = {},
          extensionOptions = {},
          verifiedBundles = {},
          rebundleModules = {}
        } = await getWebpackExtensions({
          getMetadata: self.apos.synth.getMetadata,
          modulesToInstantiate: self.apos.modulesToBeInstantiated(),
          rebundleModulesConfig: self.options.rebundleModules
        });

        // For testing purposes, we can pass a result object
        if (result) {
          Object.assign(result, {
            extensions,
            extensionOptions,
            verifiedBundles,
            rebundleModules
          });
        }

        self.extraBundles = fillExtraBundles(verifiedBundles);
        self.webpackExtensions = extensions;
        self.webpackExtensionOptions = extensionOptions;
        self.verifiedBundles = verifiedBundles;
        self.rebundleModules = rebundleModules;
      },
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
      getBundleRootDir() {
        return path.join(
          self.apos.rootDir,
          'public/apos-frontend/',
          self.getNamespace()
        );
      },
      getRelaseRootDir(isUploadFs) {
        const releaseId = self.getReleaseId();
        const namespace = self.getNamespace();
        if (isUploadFs) {
          // the relative to the uploadfs root path
          return `/apos-frontend/releases/${releaseId}/${namespace}`;
        }
        // the absolute path to the release local directory
        return `${self.apos.rootDir}/public/apos-frontend/releases/${releaseId}/${namespace}`;
      },

      // END refactoring

      // Register the library function as method to be used by core modules.
      // Open the implementation for more dev comments.
      transformRebundledFor,

      // Optional functions passed to webpack's mergeWithCustomize, allowing
      // fine control over merging of the webpack configuration for the
      // src build. Extend or override to alter the default behavior.
      // See https://github.com/survivejs/webpack-merge#mergewithcustomize-customizearray-customizeobject-configuration--configuration
      srcCustomizeArray(a, b, key) {
        // Keep arrays unique when merging
        if (
          [
            'resolveLoader.extensions',
            'resolveLoader.modules',
            'resolve.extensions',
            'resolve.modules'
          ].includes(key)
        ) {
          return _.uniq([ ...a, ...b ]);
        }
      },

      srcCustomizeObject(a, b, key) {
        // override to alter the default webpack merge behavior
      },

      async initUploadfs() {
        if (self.options.uploadfs) {
          self.uploadfs = await self.apos.modules['@apostrophecms/uploadfs'].getInstance(self.options.uploadfs);
        } else {
          self.uploadfs = self.apos.uploadfs;
        }
      },
      stylesheetsHelper(when) {
        return '';
      },
      scriptsHelper(when) {
        return '';
      },
      shouldRefreshOnRestart() {
        return self.options.refreshOnRestart && (process.env.NODE_ENV !== 'production');
      },
      // Returns a unique identifier for the current version of the
      // codebase (the current release). Checks for a release-id file
      // (ideal for webpack which can create such a file in a build step),
      // HEROKU_RELEASE_VERSION (for Heroku), PLATFORM_TREE_ID (for platform.sh),
      // APOS_RELEASE_ID (for custom cases), a directory component containing at
      // least YYYY-MM-DD (for stagecoach), and finally the git hash, if the project
      // root is a git checkout (useful when debugging production builds locally,
      // and some people do deploy this way).
      //
      // If none of these are found, throws an error demanding that APOS_RELEASE_ID
      // or release-id be set up.
      //
      // TODO: auto-detect more cases, such as Azure app service. In the meantime
      // you can set APOS_RELEASE_ID from whatever you have before running Apostrophe.
      //
      // The identifier should be reasonably short and must be URL-friendly. It must
      // be available both when running the asset build task and when running the site.
      getReleaseId() {
        const viaEnv = process.env.APOS_RELEASE_ID || process.env.HEROKU_RELEASE_VERSION || process.env.PLATFORM_TREE_ID;
        if (viaEnv) {
          return viaEnv;
        }
        try {
          return fs.readFileSync(`${self.apos.rootDir}/release-id`, 'utf8').trim();
        } catch (e) {
          // OK, consider fallbacks instead
        }
        const realPath = fs.realpathSync(self.apos.rootDir);
        // Stagecoach and similar: find a release timestamp in the path and use that
        const matches = realPath.match(/\/(\d\d\d\d-\d\d-\d\d[^/]+)/);
        if (matches) {
          return matches[1];
        }
        try {
          const fromGit = require('child_process').execSync('git rev-parse --short HEAD', {
            encoding: 'utf8'
          }).trim();
          return fromGit;
        } catch (e) {
          throw new Error(stripIndent`
            When running in production you must set the APOS_RELEASE_ID
            environment variable to a short, unique string identifying this
            particular release of the application, or write it to the file
            release-id. Apostrophe will also autodetect HEROKU_RELEASE_VERSION,
            PLATFORM_TREE_ID or the current git commit if your deployment is a
            git checkout.
          `);
        }
      },
      // Can be overridden to namespace several asset bundles
      // in a single codebase.
      //
      // Env var option is for unit testing only
      getNamespace() {
        return process.env.APOS_DEBUG_NAMESPACE || 'default';
      },
      getAssetBaseUrl() {
        // if (self.hasDevServer() && self.currentBuildManifest.devServerUrl) {
        //   return self.currentBuildManifest.devServerUrl;
        // }
        return self.getAssetBaseSystemUrl();
      },
      // For internal use only
      getAssetBaseSystemUrl() {
        const namespace = self.getNamespace();
        if (self.isProductionMode) {
          const releaseId = self.getReleaseId();
          const releaseDir = `/apos-frontend/releases/${releaseId}/${namespace}`;
          if (process.env.APOS_UPLOADFS_ASSETS) {
            return `${self.uploadfs.getUrl()}${releaseDir}`;
          } else {
            return releaseDir;
          }
        }
        return `/apos-frontend/${namespace}`;
      },
      getCacheBasePath() {
        return process.env.APOS_ASSET_CACHE ||
              path.join(self.apos.rootDir, 'data/temp/webpack-cache');
      },

      // Override to set externally a build watcher (a `chokidar` instance).
      // This method will be invoked only if/when needed.
      // Example:
      // ```js
      // registerBuildWatcher() {
      //   self.buildWatcher = chokidar.watch(pathsToWatch, {
      //     cwd: self.apos.rootDir,
      //     ignoreInitial: true
      //   });
      // }
      // ```
      registerBuildWatcher() {
        self.buildWatcher = null;
      },

      // Run build task automatically when appropriate.
      // If `changes` is provided (array of modified files/folders, relative
      // to the application root), this method will return the result of the
      // build task (array of builds that have been triggered by the changes).
      // If `changes` is not provided (falsy value), a boolean will be returned,
      // indicating if the build task has been invoked or not.
      // IMPORTANT: Be cautious when changing the return type behavior.
      // The build watcher initialization (event triggered) depends on a Boolean value,
      // and the rebuild handler (triggered by the build watcher on
      // detected change) depends on an Array value.
      // Returns boolean if `changes` is not provided, otherwise an array of builds
      // that were triggered by the changes.
      async autorunUiBuildTask(changes) {
        let result = changes ? [] : false;
        let _changes;
        if (
        // Do not automatically build the UI if we're starting from a task
          !self.apos.isTask() &&
            // Or if we're in production
            process.env.NODE_ENV !== 'production' &&
            // Or if we've set an app option to skip the auto build
            self.apos.options.autoBuild !== false
        ) {
          // Only when a legacy build is in play.
          if (!self.hasBuildModule()) {
            checkModulesWebpackConfig(self.apos.modules, self.apos.task.getReq().t);
          }
          // If starting up normally, run the build task, checking if we
          // really need to update the apos build
          if (changes) {
            // Important: don't pass empty string, it will cause the task
            // to enter selective build mode and do nothing. Undefined is OK.
            _changes = changes.join(',');
          }
          const buildsTriggered = await self.apos.task.invoke('@apostrophecms/asset:build', {
            'check-apos-build': true,
            changes: _changes
          });
          result = _changes ? buildsTriggered : true;
        }
        return result;
      },

      // The rebuild handler triggered (debounced) by the build watcher.
      // The `changes` argument is a reference to a central pool of changes.
      // It contains relative to the application root file paths.
      // The pool is being exhausted before triggering the build task.
      // Array manipulations are sync only, so no race condition is possible.
      // `rebuildCallback` is used for testing and debug purposes. It allows
      // access to the changes processed by the build task,
      // the new restartId and the build names that the changes have triggered.
      // This handler has no watcher dependencies and it's safe to be invoked
      // by any code base.
      async rebuild(changes, rebuildCallback) {
        rebuildCallback = typeof rebuildCallback === 'function'
          ? rebuildCallback
          : () => {};
        const result = {
          changes: [],
          restartId: self.restartId,
          builds: []
        };

        const pulledChanges = [];
        let change = changes.pop();
        while (change) {
          pulledChanges.push(change);
          change = changes.pop();
        }
        // No changes - should never happen.
        if (pulledChanges.length === 0) {
          return rebuildCallback(result);
        }
        try {
          const buildsTriggered = await self.autorunUiBuildTask(pulledChanges);
          if (buildsTriggered.length > 0) {
            self.restartId = self.apos.util.generateId();
          }
          return rebuildCallback({
            changes: pulledChanges,
            restartId: self.restartId,
            builds: buildsTriggered
          });
        } catch (e) {
          // The build error is detailed enough, no message
          // on our end.
          self.apos.util.error(e);
        }

        rebuildCallback(result);
      },

      // Start watching assets from `modules/` and
      // every symlinked package found in `node_modules/`.
      // `rebuildCallback` is invoked with queue length argument
      //  on actual build attempt only.
      // It's there mainly for testing and debugging purposes.
      async watchUiAndRebuild(rebuildCallback) {
        if (!self.buildWatcherEnable) {
          return;
        }
        // Allow custom watcher registration
        self.registerBuildWatcher();
        const rootDir = self.apos.rootDir;
        if (self.hasBuildModule()) {
          return self.watch(rebuildCallback);
        }
        if (!self.buildWatcher) {
          const symLinkModules = await findNodeModulesSymlinks(rootDir);
          const watchDirs = [
            './modules/**/ui/apos/**',
            './modules/**/ui/src/**',
            './modules/**/ui/public/**',
            ...symLinkModules.reduce(
              (prev, m) => [
                ...prev,
              `./node_modules/${m}/ui/apos/**`,
              `./node_modules/${m}/ui/src/**`,
              `./node_modules/${m}/ui/public/**`,
              `./node_modules/${m}/modules/**/ui/apos/**`,
              `./node_modules/${m}/modules/**/ui/src/**`,
              `./node_modules/${m}/modules/**/ui/public/**`
              ],
              []
            )
          ];
          self.buildWatcher = chokidar.watch(watchDirs, {
            cwd: rootDir,
            ignoreInitial: true
          });
        }
        // chokidar may invoke ready event multiple times,
        // we want one "watch enabled" message.
        let loggedOnce = false;
        const logOnce = (...msg) => {
          if (!loggedOnce) {
            self.apos.util.log(...msg);
            loggedOnce = true;
          }
        };
        const error = self.apos.util.error;
        const queue = [];
        let queueLength = 0;
        let queueRunning = false;
        // The pool of changes - it HAS to be exhausted by the rebuild handler
        // or we'll end up with a memory leak in development.
        const changesPool = [];

        const debounceRebuild = _.debounce(chain, self.buildWatcherDebounceMs, {
          leading: false,
          trailing: true
        });
        const addChangeAndDebounceRebuild = (fileOrDir) => {
          changesPool.push(fileOrDir);
          return debounceRebuild();
        };

        self.buildWatcher
          .on('add', addChangeAndDebounceRebuild)
          .on('change', addChangeAndDebounceRebuild)
          .on('unlink', addChangeAndDebounceRebuild)
          .on('addDir', addChangeAndDebounceRebuild)
          .on('unlinkDir', addChangeAndDebounceRebuild)
          .on('error', e => error(`Watcher error: ${e}`))
          .on('ready', () => logOnce(
            self.apos.task.getReq().t('apostrophe:assetBuildWatchStarted')
          ));

        // Simple, capped, self-exhausting queue implementation.
        function enqueue(fn) {
          if (queueLength === 2) {
            return;
          }
          queue.push(fn);
          queueLength++;
        };
        async function dequeue() {
          if (!queueLength) {
            queueRunning = false;
            return;
          }
          queueRunning = true;
          await queue.pop()(changesPool, rebuildCallback);
          queueLength--;
          await dequeue();
        }
        async function chain() {
          enqueue(self.rebuild);
          if (!queueRunning) {
            await dequeue();
          }
        }
      },

      // An implementation method that you should not need to call.
      // Sets a predetermined configuration for the frontend builds.
      // If you are trying to enable IE11 support for ui/src, use the
      // `es5: true` option (es5 builds are disabled by default).
      configureBuilds() {
        self.srcPrologue = stripIndent`
          (function() {
            window.apos = window.apos || {};
            var data = document.body && document.body.getAttribute('data-apos');
            Object.assign(window.apos, JSON.parse(data || '{}'));
            if (data) {
              document.body.removeAttribute('data-apos');
            }
            if (window.apos.modules) {
              for (const module of Object.values(window.apos.modules)) {
                if (module.alias) {
                  window.apos[module.alias] = module;
                }
              }
            }
        })();
        `;
        self.builds = {
          src: {
            scenes: [ 'apos' ],
            webpack: true,
            outputs: [ 'css', 'js' ],
            label: 'apostrophe:modernBuild',
            // Load index.js and index.scss from each module
            index: true,
            // Load only in browsers that support ES6 modules
            condition: 'module',
            prologue: self.srcPrologue,
            // The new `type` option used in the entrypoint configuration
            type: 'index',
            // The new optional configuration option for the allowed input file extensions
            inputs: [ 'js', 'scss' ]
          },
          apos: {
            scenes: [ 'apos' ],
            outputs: [ 'js' ],
            webpack: true,
            label: 'apostrophe:apostropheAdminUi',
            // Only rebuilt on npm updates unless APOS_DEV is set in the environment
            // to indicate that the dev writes project level or npm linked admin UI
            // code of their own which might be newer than package-lock.json
            apos: true,
            prologue: stripIndent`
              import 'Modules/@apostrophecms/ui/scss/global/import-all.scss';
              import emitter from 'tiny-emitter/instance';
              window.apos.bus = {
                $on: (...args) => emitter.on(...args),
                $once: (...args) => emitter.once(...args),
                $off: (...args) => emitter.off(...args),
                $emit: (...args) => emitter.emit(...args)
              };`,
            // Load only in browsers that support ES6 modules
            condition: 'module',
            type: 'apos'
          }
          // We could add an apos-ie11 bundle that just pushes a "sorry charlie" prologue,
          // if we chose
        };
        if (self.options.publicBundle) {
          self.builds.public = {
            scenes: [ 'public', 'apos' ],
            outputs: [ 'css', 'js' ],
            label: 'apostrophe:rawCssAndJs',
            // Just concatenates
            webpack: false,
            type: 'bundled'
          };
          self.builds.src.scenes.push('public');
        }
      },
      // Filter the given css performing any necessary transformations,
      // such as support for the /modules path regardless of where
      // static assets are actually deployed
      filterCss(css, { modulesPrefix }) {
        return self.filterCssUrls(css, url => {
          if (url.startsWith('/modules')) {
            return url.replace('/modules', modulesPrefix);
          }
          return url;
        });
      },
      // Run all URLs in CSS through a filter function
      filterCssUrls(css, filter) {
        css = css.replace(/url\(([^'"].*?)\)/g, function(s, url) {
          return 'url(' + filter(url) + ')';
        });
        css = css.replace(/url\("([^"]+?)"\)/g, function(s, url) {
          return 'url("' + filter(url) + '")';
        });
        css = css.replace(/url\('([^']+?)'\)/g, function(s, url) {
          return 'url(\'' + filter(url) + '\')';
        });
        return css;
      },
      // Return the URL of the asset with the given path, taking into account
      // the release id, uploadfs, etc.
      url(path) {
        return `${self.getAssetBaseUrl()}${path}`;
      }
    };
  },
  helpers(self) {
    return {
      stylesheets: function (when) {
        return self.stylesheetsHelper(when);
      },
      scripts: function (when) {
        return self.scriptsHelper(when);
      },
      refreshOnRestart() {
        if (!self.shouldRefreshOnRestart()) {
          return '';
        }
        return self.apos.template.safe(`<script data-apos-refresh-on-restart="${self.action}/restart-id" src="${self.action}/refresh-on-restart"></script>`);
      },
      // Return the URL of the release asset with the given path, taking into account
      // the release id, uploadfs, etc.
      url(path) {
        return self.url(path);
      }
    };
  },
  apiRoutes(self) {
    if (!self.shouldRefreshOnRestart()) {
      return;
    }
    return {
      get: {
        refreshOnRestart(req) {
          req.res.setHeader('content-type', 'text/javascript');
          return fs.readFileSync(path.join(__dirname, '/lib/refresh-on-restart.js'), 'utf8');
        }
      },
      // Use a POST route so IE11 doesn't cache it
      post: {
        async restartId(req) {
          // Long polling: keep the logs quiet by responding slowly, except the
          // first time. If we restart, the request will fail immediately,
          // and the client will know to try again with `fast`. The client also
          // uses `fast` the first time.
          if (req.query.fast) {
            return self.restartId;
          }
          // Long polling will be interrupted if restartId changes.
          let delay = 30000;
          const step = 300;
          const oldRestartId = self.restartId;
          while (delay > 0 && oldRestartId === self.restartId) {
            delay -= step;
            await Promise.delay(step);
          }
          return self.restartId;
        }
      }
    };
  }
};
