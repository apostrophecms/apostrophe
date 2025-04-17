const path = require('path');
const fs = require('fs-extra');
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
  transformRebundledFor
} = require('./lib/webpack/utils');

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
    // The configuration to control the development server and HMR when
    // supported. The value can be: - boolean `false`: disable the dev server and
    // HMR. - boolean `true`: same as `public` (default). - string `public`:
    // serve only the source files from the `ui/src` folder. - string `apos`:
    // serve only the admin UI files from the `ui/apos` folder.
    hmr: 'public',
    // Force the HMR WS port when it operates on the same process as Apostrophe.
    // Most of the time you won't need to change this.
    hmrPort: null,
    // Let the external build module inject a pollyfill for the module preload,
    // adding the `modulepreload` support for the browsers that don't support
    // it. Can be disabled in e.g. external front-ends.
    modulePreloadPolyfill: true,
    // Completely disable the asset runtime auto-build system.
    // When an external build module is registered, only manifest data
    // will be loaded and no build will be executed.
    autoBuild: true
  },

  async init(self) {
    // Cache the environment variables, because Node.js doesn't makes
    // system calls to get them every time. We don't expect them to change
    // during the runtime.
    self.isDebugModeCached = process.env.APOS_ASSET_DEBUG === '1';
    self.isDevModeCached = process.env.NODE_ENV !== 'production';
    self.isProductionModeCached = process.env.NODE_ENV === 'production';
    // External build module configuration (when registered).
    // See method `configureBuildModule` for more information.
    self.externalBuildModuleConfig = {};

    self.restartId = self.apos.util.generateId();
    self.iconMap = {
      ...globalIcons
    };

    // Used throughout the build process, cached forever here.
    self.modulesToBeInstantiated = await self.apos.modulesToBeInstantiated();
    // The namespace filled by `configureBuilds()`
    self.builds = {};
    self.configureBuilds();

    // The namespace filled by `initUploadfs()`
    self.uploadfs = null;
    await self.initUploadfs();

    self.enableBrowserData();

    // The namespace filled by `setWebpackExtensions()` (`webpack` property
    // processing).
    self.extraBundles = {};
    self.webpackExtensions = {};
    self.webpackExtensionOptions = {};
    self.verifiedBundles = {};
    self.rebundleModules = [];
    await self.setWebpackExtensions();

    // The namespace filled by `setBuildExtensions()` (`build` property).
    // The properties above set by `setWebpackExtensions()` will be also
    // overridden.
    self.moduleBuildExtensions = {};
    await self.setBuildExtensions();
    // Set only if the external build module is registered. Contains
    // the entrypoints configuration for the current build module.
    self.moduleBuildEntrypoints = [];
    // Set after a successful build. It contains only the processed entrypoints
    // with attached `bundles` property containing the bundle files. This can be
    // later called by the systems that are injecting the scripts and
    // stylesheets in the browser. We also need this as a separate property for
    // possible server side hot module replacement scenarios.
    self.currentBuildManifest = {
      sourceMapsRoot: null,
      devServerUrl: null,
      entrypoints: []
    };
    // Adapt the options to not contradict each other.
    if (self.options.hmr === true) {
      self.options.hmr = 'public';
    }
    // do not allow the dev server value contradicting the `publicBundle` option
    if (!self.options.publicBundle && self.options.hmr === 'public') {
      self.options.hmr = false;
    }
    // Initial build options, will be updated during the build process.
    self.currentBuildOptions = {
      isTask: null,
      hmr: self.options.hmr,
      devServer: self.options.hmr
    };

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

          // When the build is not executed, make the minimum required
          // computations to ensure we can inject the assets in the browser.
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
    const webpackBuild = require('./lib/build/task')(self);

    return {
      build: {
        usage: 'Build Apostrophe frontend CSS and JS bundles',
        afterModuleInit: true,
        async task(argv = {}) {
          self.inBuildTask = true;
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
        async task(argv) {
          if (self.hasBuildModule()) {
            await self.getBuildModule().clearCache();
          }
          await fs.emptyDir(self.getCacheBasePath());

          self.apos.util.log(
            self.apos.task.getReq().t('apostrophe:assetBuildCacheCleared')
          );
        }
      },
      reset: {
        usage: 'Clear all build artifacts, public folders (without release) and cache',
        afterModuleReady: true,
        async task(argv) {
          if (self.hasBuildModule()) {
            await self.getBuildModule().clearCache();
            await self.getBuildModule().reset();
          }
          await fs.emptyDir(self.getCacheBasePath());
          await fs.emptyDir(self.getBundleRootDir());

          self.apos.util.log(
            self.apos.task.getReq().t('apostrophe:assetBuildCacheCleared')
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
    return {
      // Public API for external build modules.
      ...require('./lib/build/external-module-api')(self),
      // Internals
      ...require('./lib/build/internals')(self),
      // A helper to detect re-bundled and moved to the main build bundles
      // by module name. Open the implementation for more details.
      transformRebundledFor,

      isDevMode() {
        return self.isDevModeCached;
      },
      isDebugMode() {
        return self.isDebugModeCached;
      },
      isProductionMode() {
        return self.isProductionModeCached;
      },

      // External build modules can register themselves here. This should
      // happen on the special asset module event `afterInit` (see `handlers`).
      // This module will also detect if a system watcher should be disabled
      // depending on the asset module configuration and the external build
      // module capabilities.
      //
      // options:
      // - alias (required): the alias string to use in the webpack
      // configuration. This usually matches the bundler name, e.g. 'vite',
      // 'webpack', etc. - devServer (optional): whether the build module
      // supports a dev server. - hmr (optional): whether the build module
      // supports a hot module replacement.
      //
      // The external build module should initialize before the asset module:
      // module.exports = {
      //   before: '@apostrophecms/asset',
      //   ...
      // };
      //
      // The external build module must implement various methods to be used by
      // the Apostrophe core
      //
      // ** `async build(options)`: the build method to be called by
      // Apostrophe.
      //
      // Accepts build `options`, see `getBuildOptions()` for more information.
      // Returns an object with properties:
      // * `entrypoints`(required, array of objects), containing all
      // entrypoints that are processed by the build module. If a build is
      // performed, `bundles` (`Set`) property will be added by the core asset
      // module to each processed entrypoint. It contains the bundle files that
      // are created by the post-build system. Beside the standard entrypoint
      // shape (see `getBuildEntrypoints()`), each entrypoint should also
      // contain a `manifest` object.
      //
      //    `manifest` properties:
      // - `root` - the relative to `apos.asset.getBuildRootDir()` path to the
      // folder containing all files described in the manifest. - `files` -
      // object which properties are: - `js` - an array of paths to the JS
      // files. The only JS files that are getting bundled by scene. It's
      // usually the main entrypoint file. It's an array to allow additional
      // files for bundling. - `css` - an array of paths to the CSS files.
      // Available only when the build manifest is available. They are bundled
      // by scene. - `imports` - an array of paths to the statically imported
      // (shared) JS files. These are copied to the bundle folder and released.
      // They will be inserted into the HTML with `rel="modulepreload"`
      // attribute. - `dynamicImports` - an array of paths to the dynamically
      // imported JS files. These are copied to the bundle folder and released,
      // but not inserted into the HTML. - `assets` - an array of paths to the
      // assets (images, fonts, etc.) used by the entrypoint. These should be
      // copied to the bundle folder and released and are not inserted into the
      // HTML. - `src` - an object with keys corresponding to the input
      // extension and values array of relative URL path to the entry source
      // file that should be served by the dev server. Currently only `js` key
      // is supported. Can be null (e.g. for `ui/public`). Usually contains the
      // main entrypoint file. - `devServer` - boolean if the entrypoint should
      // be served by the dev server. * `sourceMapsRoot` (optional, string or
      // null) the absolute path to the location when source maps are stored.
      // They will be copied to the bundle folder with the folder same
      // structure.
      //
      // ** `async startDevServer(options)`: the method to start the dev
      // server.
      //
      // It's called only if the module supports dev server and HMR, `hmr` is
      // enabled and if it's appropriate to start the dev server (development
      // mode, not a task, etc.). Accepts the same options as the `build`
      // method. Returns the same object as the `build` method with additional
      // development related properties: * `devServerUrl` (optional, string or
      // null) the base server URL for the dev server when available. *
      // `hmrTypes` (optional, array of strings) the entrypoint types that are
      // currently served with HMR. * `ts` (optional, number) the timestamp ms
      // of the last `apos` build. This number will be written to the
      // `.manifest.json` file to allow the external build module to optimize
      // the build time based on the last build change. The module can retrieve
      // both `getSystemLastChangeMs()` and `loadSavedBuildManifest()` methods
      // to perform a cache check.
      //
      // ** `async watch(watcher, options)`: the method to attach the watcher
      // to the external build module.
      //
      // It's called only if the module supports hmr, `hmr` is enabled and
      // if it's appropriate to start the watcher (development mode, not a
      // task, watch enabled etc.). The watcher is a chokidar instance that
      // watches the original module source files. The method should attach the
      // necessary listeners to the watcher. Returns void.
      //
      // ** `async entrypoints(options)`: the method to retrieve the
      // entrypoints configuration.
      //
      // It's called only if no build is executed and the external build module
      // is registered. The method should return the enhanced entrypoints in the
      // same format as the `build` method returns. The module is allowed
      //
      // ** `async clearCache()`: clear the internal bundler cache.
      //
      // This method is called when the `@apostrophecms/asset:clear-cache` task
      // is executed. IMPORTANT: The directory that the module uses for bundler
      // caching (usually in `data/temp`) should include the current namespace
      // (`apos.asset.getNamespace()`) and build module alias to avoid conflicts
      // with other modules and multisite environments.
      //
      // ** `async reset()`: Clear all build artifacts (including manifest).
      //
      // Called when the `@apostrophecms/asset:reset` task is executed.
      //
      configureBuildModule(moduleSelf, options = {}) {
        const name = moduleSelf.__meta.name;
        if (self.hasBuildModule()) {
          throw new Error(
            `Module ${name} is attempting to register as a build module, ` +
            `but ${self.getBuildModuleConfig().name} is already registered.`
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
        // We can now query if the build module is going to perform HRM
        // and thus if it's safe to explicitly disable the watcher. It's early
        // enough to do that here.
        if (!self.hasHMR()) {
          self.buildWatcherEnable = false;
        }
      },
      // Available after external build module is registered.
      // The internal module property should never be used directly nor
      // modified after the initialization.
      getBuildModuleConfig() {
        return self.externalBuildModuleConfig;
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
      hasDevServer() {
        return self.hasBuildModule() &&
          self.isDevMode() &&
          self.options.hmr !== false &&
          self.buildWatcherEnable &&
          !!self.getBuildModuleConfig().devServer;
      },
      hasHMR() {
        return self.hasDevServer() &&
          !!self.getBuildModuleConfig().hmr;
      },
      // `argv` is the arguments passed to the original build task
      // - `check-apos-build` is a boolean flag (or undefined) that indicates
      // if build checks should be performed. `false` means that the build
      // should be executed as a task (no checks are performed). `true` means
      // that the build should be executed with a cached mechanisms for `apos`.
      // - `changes` is an array of changed files. This is reserved for the
      // legacy build system and should never appear in the external build
      // module.
      //
      // Returns an object:
      // - `isTask`: if `true`, the build is executed as a task. If false
      // optimization can be applied (e.g. build apostrophe admin UI only
      // once). - `hmr`: if `true`, the hot module replacement is enabled. -
      // `hmrPort`: the port for the HMR WS server. If not set, the default port
      // is used. - `devServer`: if `false`, the dev server is disabled.
      // Otherwise, it's a string (enum) `public` or `apos`. Note that if `hmr`
      // is disabled, the dev server will be always `false`. -
      // `modulePreloadPolyfill`: if `true`, a module preload polyfill is
      // injected. - `types`: optional array, if present it represents the only
      // entrypoint types (entrypoint.type) that should be built. -
      // `sourcemaps`: if `true`, the source maps are generated in production. -
      // `postcssViewportToContainerToggle`: the configuration for the
      // breakpoint preview plugin.
      //
      // Note that this getter depends on the current build task arguments. You
      // shouldn't use that directly.
      getBuildOptions(argv) {
        if (!argv) {
          // assuming not a task, legacy stuff
          argv = {
            'check-apos-build': true
          };
        }
        const options = {
          isTask: !argv['check-apos-build'],
          hmr: self.hasHMR(),
          hmrPort: self.options.hmrPort,
          modulePreloadPolyfill: self.options.modulePreloadPolyfill,
          sourcemaps: self.options.productionSourceMaps,
          postcssViewportToContainerToggle: {
            enable: self.options.breakpointPreviewMode?.enable === true,
            debug: self.options.breakpointPreviewMode?.debug === true,
            modifierAttr: 'data-breakpoint-preview-mode',
            transform: self.options.breakpointPreviewMode?.transform
          }
        };
        options.devServer = !options.isTask && self.hasDevServer()
          ? self.options.hmr
          : false;

        // Skip prebundled UI and keep only the apos scenes.
        if (!self.options.publicBundle) {
          options.types = [ 'apos', 'index' ];
        }

        return options;
      },
      // Build the assets using the external build module.
      // The `argv` object is the `argv` object passed to the original build
      // task. See getBuildOptions() for more information.
      async build(argv) {
        const buildOptions = self.getBuildOptions(argv);
        self.currentBuildOptions = buildOptions;

        // Copy all `/public` folders from the modules to the bundle root.
        await self.copyModulesFolder({
          target: path.join(self.getBundleRootDir(), 'modules'),
          folder: 'public',
          modules: self.getRegisteredModules()
        });

        // Switch to dev server mode if the dev server is enabled.
        if (buildOptions.devServer) {
          await self.startDevServer(buildOptions);
        } else {
          self.currentBuildManifest = await self.getBuildModule()
            .build(buildOptions);
        }

        // Create and copy bundles (`-bundle.xxx` files) per scene into the
        // bundle root.
        const bundles = await self.computeBuildScenes(self.currentBuildManifest);
        // Retrieve `/modules` public assets from the bundle root for
        // deployment.
        const publicAssets = await glob('modules/**/*', {
          cwd: self.getBundleRootDir(),
          nodir: true,
          follow: false,
          absolute: false
        });
        // Copy the static & dynamic imports and file assets to the bundle root.
        const deployableArtefacts = await self.copyBuildArtefacts(
          self.currentBuildManifest
        );
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
          deployFiles.push(...sourceMaps || []);
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
      },
      // A before hook for the new `watch` and the legacy `watchUiAndRebuild`
      // methods. Extend to apply custom logic before the watch system is
      // started. It is called after a custom watcher is (optionally) registered
      // and before an internal watcher is instantiated (when appropriate).
      async beforeWatch() {
        // Do nothing by default.
      },
      // The new watch system, works only when an external build module is
      // registered. This method is invoked only when appropriate. The watcher
      // will trigger changes with paths relative to the `apos.npmRootDir`.
      async watch() {
        await self.beforeWatch();

        if (!self.buildWatcher) {
          const watchDirs = await self.computeWatchFolders();
          self.buildWatcher = chokidar.watch(watchDirs, {
            cwd: self.apos.npmRootDir,
            ignoreInitial: true,
            ignored: self.ignoreWatchLocation
          });
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
        self.buildWatcher
          .on('error', e => self.apos.util.error(`Watcher error: ${e}`))
          .on('ready', () => logOnce(
            self.apos.task.getReq().t('apostrophe:assetBuildWatchStarted')
          ));

        await self.getBuildModule().watch(self.buildWatcher, self.getBuildOptions());
      },
      // https://github.com/paulmillr/chokidar?tab=readme-ov-file#path-filtering
      // Override to ignore files/folders from the watch. The method is called
      // twice: - once with only the `file` parameter - once with both `file`
      // and `fsStats` parameters The `file` is the relative to the
      // `apos.rootDir` path to the file or folder. The `fsStats` is the
      // `fs.Stats` object. Return `true` to ignore the file/folder.
      ignoreWatchLocation(file, fsStats) {
        return false;
      },
      // Run the minimal required computations to ensure manifest data is
      // available.
      async runWithoutBuild() {
        if (!self.hasBuildModule()) {
          return;
        }

        // Hydrate the entrypoints with the saved manifest data and
        // set the current build manifest data.
        const buildOptions = self.getBuildOptions();
        const entrypoints = await self.getBuildModule().entrypoints(buildOptions);

        // Command line tasks other than the asset build task do not display a
        // warning if there is no manifest from a previous build attempt as they
        // do not depend on the manifest to succeed
        const silent = self.apos.isTask() && !self.inBuildTask;
        const {
          manifest = [], devServerUrl, hmrTypes
        } = await self.loadSavedBuildManifest(silent);

        self.currentBuildManifest.devServerUrl = devServerUrl;
        self.currentBuildManifest.hmrTypes = hmrTypes ?? [];

        for (const entry of manifest) {
          const entrypoint = entrypoints.find((e) => e.name === entry.name);
          // It is possible that we run without build in development mode
          // when we are in a "shared" mode (e.g. use external vite instance).
          if (!entrypoint) {
            continue;
          }
          entrypoint.manifest = entry;
          if (!entrypoint.bundles) {
            entrypoint.bundles = new Set(entry.bundles ?? []);
          }
          self.currentBuildManifest.entrypoints.push({
            ...entrypoint,
            manifest: entry
          });
        }
      },
      // Print a debug structured log only when asset debug mode is enabled
      // by environment variable (because it's too chatty!).
      printDebug(id, ...rest) {
        if (self.isDebugMode()) {
          self.logDebug(id, ...rest);
        }
      },

      // The method is called only if no external build module is registered.
      // Compute and set the `webpack` data provided by the modules.
      async setWebpackExtensions(result) {
        const {
          extensions = {},
          extensionOptions = {},
          verifiedBundles = {},
          rebundleModules = {}
        } = await getWebpackExtensions({
          getMetadata: self.apos.synth.getMetadata,
          modulesToInstantiate: self.getRegisteredModules(),
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
      // HEROKU_RELEASE_VERSION (for Heroku), PLATFORM_TREE_ID (for
      // platform.sh), APOS_RELEASE_ID (for custom cases), a directory component
      // containing at least YYYY-MM-DD (for stagecoach), and finally the git
      // hash, if the project root is a git checkout (useful when debugging
      // production builds locally, and some people do deploy this way).
      //
      // If none of these are found, throws an error demanding that
      // APOS_RELEASE_ID or release-id be set up.
      //
      // TODO: auto-detect more cases, such as Azure app service. In the
      // meantime you can set APOS_RELEASE_ID from whatever you have before
      // running Apostrophe.
      //
      // The identifier should be reasonably short and must be URL-friendly. It
      // must be available both when running the asset build task and when
      // running the site.
      getReleaseId() {
        const viaEnv = process.env.APOS_RELEASE_ID ||
          process.env.HEROKU_RELEASE_VERSION ||
          process.env.PLATFORM_TREE_ID;
        if (viaEnv) {
          return viaEnv;
        }
        try {
          return fs.readFileSync(`${self.apos.rootDir}/release-id`, 'utf8').trim();
        } catch (e) {
          // OK, consider fallbacks instead
        }
        const realPath = fs.realpathSync(self.apos.rootDir);
        // Stagecoach and similar: find a release timestamp in the path and use
        // that
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
        const namespace = self.getNamespace();
        if (self.isProductionMode()) {
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
      // The build watcher initialization (event triggered) depends on a
      // Boolean value, and the rebuild handler (triggered by the build watcher
      // on detected change) depends on an Array value. Returns boolean if
      // `changes` is not provided, otherwise an array of builds that were
      // triggered by the changes.
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

        if (self.hasBuildModule()) {
          return self.watch(rebuildCallback);
        }

        // A before hook, after the watcher is registered.
        await self.beforeWatch();

        if (!self.buildWatcher) {
          // Whach the entire `module-name/ui` folder now, but only
          // for the registered modules that have one.
          // Also add support for ignoring the watch location - same
          // as the external build module system.
          const watchDirs = await self.computeWatchFolders();
          const rootDir = self.apos.rootDir;
          self.buildWatcher = chokidar.watch(watchDirs, {
            cwd: rootDir,
            ignoreInitial: true,
            ignored: self.ignoreWatchLocation
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
            // The new optional configuration option for the allowed input file
            // extensions
            inputs: [ 'js', 'scss' ]
          },
          apos: {
            scenes: [ 'apos' ],
            outputs: [ 'js' ],
            webpack: true,
            label: 'apostrophe:apostropheAdminUi',
            // Only rebuilt on npm updates unless APOS_DEV is set in the
            // environment to indicate that the dev writes project level or npm
            // linked admin UI code of their own which might be newer than
            // package-lock.json
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
          // We could add an apos-ie11 bundle that just pushes a "sorry
          // charlie" prologue, if we chose
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
      },
      devServerUrl(path) {
        return `${self.getDevServerUrl()}${path}`;
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
        return self.apos.template.safe(
          `<script data-apos-refresh-on-restart="${self.action}/restart-id" ` +
          `src="${self.action}/refresh-on-restart"></script>`
        );
      },
      // Return the URL of the release asset with the given path, taking into
      // account the release id, uploadfs, etc.
      url(path) {
        return self.url(path);
      },
      devServerUrl(path) {
        return self.devServerUrl(path);
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
