const fs = require('fs-extra');
const path = require('node:path');
const util = require('node:util');
const { glob } = require('glob');
const { getBuildExtensions, fillExtraBundles } = require('./utils');

// Internal build interface.
module.exports = (self) => {
  return {
    // Compute the configuration provided per module as a `build` property.
    // It has the same shape as the legacy `webpack` property. The difference
    // is that the `build` property now supports different "vendors". An upgrade
    // path would be moving existing `webpack` configurations to `build.webpack`.
    // However, we keep the legacy `webpack` property for compatibility reasons.
    // Only external build modules will consume the `build` property.
    // Uses the public API `getRegisteredModules()` to get the cached list of modules.
    async setBuildExtensions() {
      self.moduleBuildExtensions = await getBuildExtensions({
        getMetadata: self.apos.synth.getMetadata,
        modulesToInstantiate: self.getRegisteredModules(),
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
            // it only processes the configured `sources`
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

    // Get the entrypoints containing manifest data currently initialized. The information
    // is available after the build initialization is done:
    // - after an actual build task (any environment)
    // - after the dev server is started (development)
    // - after a saved build manifest is loaded (production)
    getCurrentBuildEntrypoints() {
      return self.currentBuildManifest.entrypoints ?? [];
    },

    // Get the component name from a file path. The `enumerate` option allows
    // to append a number to the component name.
    getComponentNameByPath(componentPath, { enumerate } = {}) {
      return path
        .basename(componentPath)
        .replace(/-/g, '_')
        .replace(/\s+/g, '')
        .replace(/\.\w+/, '') + (typeof enumerate === 'number' ? `_${enumerate}` : '');
    },

    // Return the reported by the external module during build dev server URL.
    // It is set after the build is performed or a manifest is loaded.
    getDevServerUrl() {
      return self.currentBuildManifest.devServerUrl;
    },

    // Retrieve only existing `/ui` paths for local and npm symlinked modules.
    // Modules is usually the rsult of `self.getRegisteredModules()`.
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

    // Compute the list of watch folders based on the registered modules.
    async computeWatchFolders() {
      return (await self.computeWatchMeta(self.getRegisteredModules()))
        .map(entry => entry.dirname);
    },

    // Saves the build manifest to disk. Also adds `bundles` to the manifest
    // if available as entrypoint information.
    // See the manifest section in `configureBuildModule()` method docs for more information.
    async saveBuildManifest(manifest) {
      const {
        entrypoints, ts, devServerUrl, hmrTypes
      } = manifest;
      const content = [];

      for (const entrypoint of entrypoints) {
        const {
          manifest, name, bundles
        } = entrypoint;
        if (!manifest) {
          continue;
        }

        content.push({
          ...manifest,
          name,
          bundles: Array.from(bundles ?? [])
        });
      }
      const current = await self.loadSavedBuildManifest(true);
      await fs.outputJson(
        path.join(self.getBundleRootDir(), '.manifest.json'),
        {
          ts: ts || current.ts,
          devServerUrl,
          hmrTypes,
          manifest: content
        }
      );
    },

    // Called by the asset build process to compute the bundle data, write `-bundle` files,
    // enhance the entrypoints with a `bundles` property, and return a list of all bundle files.
    //
    // The `bundles` (Set) property added to the entrypoints configuration contans the bundle files
    // used later when injecting the scripts and stylesheets in the browser.
    // The `metadata` is the return value of the external build module build method
    // (see `self.build()` and `configureBuildModule()`).
    async computeBuildScenes(metadata, { write = true } = {}) {
      const bundlePath = self.getBundleRootDir();
      const buildRoot = self.getBuildRootDir();

      const { entrypoints } = metadata;
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

    // Accepts the result of the external build module build method (see `self.build()`
    // and `configureBuildModule()`), creates a list of all files that need to be copied
    // from the build (`apos-build`) to the bundle (`public/apos-frontent`) directory
    // based on the manifest data available, copies them, and returns the list.
    async copyBuildArtefacts(metadata) {
      const buildRoot = self.getBuildRootDir();
      const bundleRoot = self.getBundleRootDir();
      const { entrypoints } = metadata;
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

    // Copies source maps from the build directory to the bundle directory,
    // preserving the directory structure.
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

    // Copy a `folder` (if exists) from any existing module to the `target` directory.
    // The `modules` option is usually the result of `self.getRegisteredModules()`.
    // It's not resolved internally to avoid overhead (it's not cheap). The caller
    // is responsible for resolving and caching the modules list.
    // `target` is the absolute path to the target directory.
    // Usage:
    // const modules = self.getRegisteredModules();
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

    // Generate the browser script/stylesheet import markup for a scene based on the available
    // manifest data and environmnent.
    // The `scene` argument is the scene name (`apos` or `public`), and the `output`
    // argument is the output type - `js` or `css`.
    // The `modulePreload` argument is a Set that might be provided by the caller to collect
    // the unique list of module preload links (this method is called multiple times).
    getBundlePageMarkup({
      scene, output, modulePreload = new Set()
    }) {
      let entrypoints;

      // CSS is special (as always!). In HMR mode, we want to serve ONLY
      // the CSS that is not HMRed (because we run either `apos` or `public` dev server).
      // We filter it no matter the output, because `apos` type doesn't have `css` in its `output
      // property. This is intended, the CSS is combined and delivered via the `index` entrypoint.
      if (self.currentBuildManifest.hmrTypes && output === 'css') {
        entrypoints = self.apos.asset.getCurrentBuildEntrypoints()
          .filter(e => !!e.manifest &&
              e.scenes.includes(scene) &&
              !self.currentBuildManifest.hmrTypes.includes(e.type)
          );
      } else {
        entrypoints = self.apos.asset.getCurrentBuildEntrypoints()
          .filter(e => !!e.manifest && e.scenes.includes(scene) && e.outputs?.includes(output));
      }

      const markup = [];
      const seen = {};

      for (const {
        manifest, condition, bundles: bundleSet
      } of entrypoints) {
        // For CSS, in HMR mode we already filtered the entries, so we can
        // use the bundled files directly. For JS, we need to check if we
        // have a dev server and use the dev server URL if available.
        const hasDevServer = output === 'css'
          ? false
          : manifest.devServer && self.hasDevServer();
        const assetUrl = hasDevServer ? self.getDevServerUrl() : self.getAssetBaseUrl();
        const bundles = [ ...bundleSet ?? [] ]
          .filter(b => b.startsWith(scene) && b.endsWith(`.${output}`));

        const files = hasDevServer
          ? manifest.src?.[output] ?? []
          : bundles;

        const preload = !hasDevServer && output === 'js'
          ? manifest.files?.imports ?? []
          : [];

        preload.forEach(file =>
          modulePreload.add(`<link rel="modulepreload" href="${assetUrl}/${file}">`)
        );

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
        releaseDir = self.getCurrentRelaseDir(true);
      } else {
        // The right choice with Docker if uploadfs is just the local filesystem
        // mapped to a volume (a Docker build step can't access that)
        copyIn = fsCopyIn;
        releaseDir = self.getCurrentRelaseDir();
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
    }
  };
};
