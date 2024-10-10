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
  findNodeModulesSymlinks,
  transformRebundledFor
} = require('./lib/webpack/utils');

const { getBuildExtensions } = require('./lib/build-utils');

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
          icon: 'monitor-icon'
        },
        tablet: {
          label: 'apostrophe:breakpointPreviewTablet',
          width: '1024px',
          height: '768px',
          icon: 'tablet-icon'
        },
        mobile: {
          label: 'apostrophe:breakpointPreviewMobile',
          width: '414px',
          height: '896px',
          icon: 'cellphone-icon'
        }
      },
      // Transform method used on media feature
      // Can be either:
      // - (mediaFeature) => { return mediaFeature.replaceAll('xx', 'yy'); }
      // - null
      transform: null
    }
  },

  async init(self) {
    // Set the environment variable APOS_ASSET_DEBUG=1 to enable
    // debug mode, which logs extensive build and configuration
    // information.
    self.isDebugMode = process.env.APOS_ASSET_DEBUG === '1';
    // External build module configuration.
    // See method `configureBuildModule` for more information.
    self.externalBuildModule = {};

    self.restartId = self.apos.util.generateId();
    self.iconMap = {
      ...globalIcons
    };

    // The namespace filled by `configureBuilds()`
    self.builds = {};
    self.configureBuilds();

    // The namespace filled by `initUploadfs()`
    self.uploadfs = null;
    self.initUploadfs();

    self.enableBrowserData();

    // The namespace filled by `setWebpackExtensions()`
    self.extraBundles = {};
    self.webpackExtensions = {};
    self.webpackExtensionOptions = {};
    self.verifiedBundles = {};
    self.rebundleModules = [];
    await self.setWebpackExtensions();

    // The namespace filled by `setBuildExtensions()`
    self.moduleBuildExtensions = {};
    await self.setBuildExtensions();

    // Additional props (beside the non-webpack props above by `setWebpackExtensions()`)
    // filled by `setBuildExtensionsForExternalModule()` if a build module is registered.
    self.extraExtensions = {};
    self.extraExtensionOptions = {};

    self.buildWatcherEnable = process.env.APOS_ASSET_WATCH !== '0' && self.options.watch !== false;
    self.buildWatcherDebounceMs = parseInt(self.options.watchDebounceMs || 1000, 10);
    self.buildWatcher = null;
  },
  handlers (self) {
    return {
      'apostrophe:modulesRegistered': {
        async runUiBuildTask() {
          // A signal that the build data has been initialized and all modules
          // have been registered.
          await self.emit('afterInit');

          // TODO: refactor autorunUiBuildTask to get rid of the webpack related
          // code and make it a generic method playing well with external builds.
          const ran = await self.autorunUiBuildTask();
          // Temporary disable watchers
          if (ran && !self.hasBuildModule()) {
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
            return self.buildProxy(argv);
          }
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
    return {
      // START external build modules feature

      // Extending this method allows to override the external build module configuration.
      getBuildModuleConfig() {
        return self.externalBuildModule;
      },
      // External build modules can register themselves here.
      // options:
      // - alias (required): the alias string to use in the webpack configuration.
      //   This usually matches the bundler name, e.g. 'vite', 'webpack', etc.
      // - hasDevServer (optional): whether the build module supports a dev server.
      // - hasHMR (optional): whether the build module supports a hot module replacement.
      //
      // The external build module should initialize before the asset module:
      // module.exports = {
      //   before: '@apostrophecms/asset',
      //   ...
      // };
      //
      // The external build module must implement various methods to be used by Apostrophe:
      // - async build(options): the build method to be called by Apostrophe.
      // TODO: document it, add the rest of the required methods.
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

        self.externalBuildModule = {
          name,
          alias: options.alias,
          hasDevServer: options.hasDevServer,
          hasHMR: options.hasHMR
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
      // Get all build configurations available.
      getBuilds() {
        // TODO - work in progress, in the next phase this should return a unified
        // build configuration for every entrypoint:
        // - apos
        // - src
        // - verifiedBundles: the tricky part is to keep the standard configuration
        //   signature for the external build modules.
        //   Add `ignore` array in the source build containing all verifiedBundle
        //   entries that should not be included in the main `src` build. They should
        //   become separate entrypoints configuration, similar to the core configs, but preserving
        //   the extra build parameters.
        if (self.hasBuildModule()) {
          return {
            ...self.moduleBuildExtensions[self.getBuildModuleAlias()] ?? {},
            ...self.builds
          };
        }
        return self.builds;
      },
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
      // Build the assets using the external build module.
      // The `argv` object is the `argv` object passed to the task.
      // TODO: modify and send the argv, document it.
      buildProxy(argv) {
        return self.getBuildModule().build();
      },
      // Compute the configuration provided per module as a `build` property.
      // It has the same shape as the legacy `webpack` property. The difference
      // is that the `build` property no supports different "vendors". An upgrade
      // path would be moving existing `webpack` configurations to `build.webpack`.
      // However, for now we keep the legacy `webpack` property only for compatibility.
      // Only external build modules will consume the `build` property.
      async setBuildExtensions() {
        self.moduleBuildExtensions = await getBuildExtensions({
          getMetadata: self.apos.synth.getMetadata,
          modulesToInstantiate: self.apos.modulesToBeInstantiated(),
          rebundleModulesConfig: self.options.rebundleModules
        });
      },
      // Ensure the namespaced by alias `moduleBuildExtensions` data is available.
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

        self.printDebug('setBuildExtensions', self.moduleBuildExtensions);
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
      //   - `name`: the original module name (no prefix).
      //   - `importAlias`: the alias base that is used for importing the module.
      //     For example `Modules/@apostrophecms/admin-bar/`. This is used to fast
      //     resolve the module in the Vite build.
      //   - `project`: a boolean indicating if the module is a project module or inside
      //     `node_modules`.
      //   - `files`: an array of paths paths relative to the module `ui/` folder
      async computeSourceMeta({
        modules,
        asyncHandler
      }) {
        const seen = {};
        const meta = [];
        for (const name of modules) {
          const metadata = self.apos.synth.getMetadata(name);
          for (const entry of metadata.__meta.chain) {
            if (seen[entry.dirname]) {
              continue;
            }
            const moduleName = entry.name.replace('/my-', '/');
            const dirname = `${entry.dirname}/ui`;
            const files = await glob('**/*', {
              cwd: dirname,
              ignore: '**/node_modules/**',
              nodir: true,
              follow: false,
              absolute: false
            });

            seen[entry.dirname] = true;
            const metaEntry = {
              id: entry.name,
              name: moduleName,
              dirname,
              importAlias: `Modules/${moduleName}/`,
              project: !entry.npm,
              files
            };
            meta.push(metaEntry);

            if (asyncHandler) {
              await asyncHandler(metaEntry);
            }
          }
        }

        return meta;
      },
      // Get the component name from a file path. The `enumerate` option allows
      // to append a number to the component name.
      getComponentNameForUI(componentPath, { enumerate } = {}) {
        return path
          .basename(componentPath)
          .replace(/-/g, '_')
          .replace(/\.\w+/, '') + (typeof enumerate === 'number' ? `_${enumerate}` : '');
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

        // Debugging but only if we don't have an external build module.
        // If we do, the debug output is handled by the respective setter.
        if (!self.hasBuildModule()) {
          self.printDebug('setWebpackExtensions', {
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
        const namespace = self.getNamespace();
        if (process.env.NODE_ENV === 'production') {
          const releaseId = self.getReleaseId();
          const releaseDir = `/apos-frontend/releases/${releaseId}/${namespace}`;
          if (process.env.APOS_UPLOADFS_ASSETS) {
            return `${self.uploadfs.getUrl()}${releaseDir}`;
          } else {
            return releaseDir;
          }
        } else {
          return `/apos-frontend/${namespace}`;
        }
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
          checkModulesWebpackConfig(self.apos.modules, self.apos.task.getReq().t);
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
            prologue: self.srcPrologue
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
            condition: 'module'
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
            webpack: false
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
