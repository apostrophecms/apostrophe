const path = require('node:path');
const util = require('node:util');
const Promise = require('bluebird');
const fs = require('fs-extra');
const { stripIndent } = require('common-tags');
const webpackModule = require('webpack');
const { mergeWithCustomize: webpackMerge } = require('webpack-merge');
const {
  getBundlesNames,
  writeBundlesImportFiles,
  findNodeModulesSymlinks
} = require('../webpack/utils');

// The internal Webpack build task.
module.exports = (self) => ({
  async task(argv = {}) {
    if (self.hasBuildModule()) {
      return self.build(argv);
    }
    if (self.options.es5 && !self.es5TaskFn) {
      self.apos.util.warnDev(stripIndent`
              es5: true is set. IE11 compatibility builds now require that you
              install the optional @apostrophecms/asset-es5 module. Until then,
              for backwards compatibility, your build will succeed but
              will not be IE11 compatible.
            `);
      self.options.es5 = false;
    }
    // The lock could become huge, cache it, see computeCacheMeta()
    let packageLockContentCached;
    const req = self.apos.task.getReq();
    const namespace = self.getNamespace();
    const buildDir = `${self.apos.rootDir}/apos-build/${namespace}`;
    const bundleDir = `${self.apos.rootDir}/public/apos-frontend/${namespace}`;
    const modulesToInstantiate = self.apos.modulesToBeInstantiated();
    const symLinkModules = await findNodeModulesSymlinks(self.apos.npmRootDir);
    // Make it clear if builds should detect changes
    const detectChanges = typeof argv.changes === 'string';
    // Remove invalid changes. `argv.changes` is a comma separated list of
    // relative to `apos.rootDir` files or folders
    const sourceChanges = detectChanges
      ? filterValidChanges(
        argv.changes.split(',').map(p => p.trim()),
        Object.keys(self.apos.modules)
      )
      : [];
    // Keep track of the executed builds
    const buildsExecuted = [];

    // Don't clutter up with previous builds.
    await fs.remove(buildDir);
    await fs.mkdirp(buildDir);

    // Static asset files in `public` subdirs of each module are copied
    // to the same relative path
    // `/public/apos-frontend/namespace/modules/modulename`. Inherited files are
    // also copied, with the deepest subclass overriding in the event of a
    // conflict
    if (self.options.publicBundle) {
      await moduleOverrides(`${bundleDir}/modules`, 'public');
    }

    for (const [ name, options ] of Object.entries(self.builds)) {
      // If the option is not present always rebuild everything...
      let rebuild = argv && !argv['check-apos-build'];
      // ...but only when not in a watcher mode
      if (detectChanges) {
        rebuild = shouldRebuildFor(name, options, sourceChanges);
      } else if (!rebuild) {
        let checkTimestamp = false;

        // If options.publicBundle, only builds contributing
        // to the apos admin UI (currently just "apos")
        // are candidates to skip the build simply because package-lock.json is
        // older than the bundle. All other builds frequently contain
        // project level code
        // Else we can skip also for the src bundle
        if (options.apos || !self.options.publicBundle) {
          const bundleExists = await fs.pathExists(bundleDir);

          if (!bundleExists) {
            rebuild = true;
          }

          if (!process.env.APOS_DEV) {
            checkTimestamp = await fs.pathExists(`${bundleDir}/${name}-build-timestamp.txt`);
          }

          if (checkTimestamp) {
            // If we have a UI build timestamp file compare against the app's
            // package.json modified time.
            if (await lockFileIsNewer(name)) {
              rebuild = true;
            }
          } else {
            rebuild = true;
          }
        } else {
          // Always redo the other builds,
          // which are quick and typically contain
          // project level code not detectable by
          // comparing package-lock timestamps
          rebuild = true;
        }
      }

      if (rebuild) {
        await fs.mkdirp(bundleDir);
        await build({
          name,
          options
        });
        buildsExecuted.push(name);
      }
    }

    // No need of deploy if in a watcher mode.
    // Also we return an array of build names that
    // have been triggered - this is required by the watcher
    // so that page refresh is issued only when needed.
    if (detectChanges) {
      // merge the scenes that have been built
      const scenes = [
        ...new Set(buildsExecuted.map(name => self.builds[name].scenes).flat())
      ];
      merge(scenes);
      return buildsExecuted;
    }

    // Discover the set of unique asset scenes that exist (currently
    // just `public` and `apos`) by examining those specified as
    // targets for the various builds
    const scenes = [
      ...new Set(Object.values(self.builds).map(options => options.scenes).flat())
    ];

    // enumerate public assets and include them in deployment if appropriate
    const publicAssets = self.apos.util.glob('modules/**/*', {
      cwd: bundleDir,
      mark: true
    }).filter(match => !match.endsWith('/'));

    const deployFiles = [
      ...publicAssets,
      ...merge(scenes),
      ...getBundlesNames(self.extraBundles, self.options.es5)
    ];

    await deploy(deployFiles);

    async function moduleOverrides(modulesDir, source, pnpmPaths) {
      await fs.remove(modulesDir);
      await fs.mkdirp(modulesDir);
      let names = {};
      const directories = {};
      const pnpmOnly = {};
      // Most other modules are not actually instantiated yet, but
      // we can access their metadata, which is sufficient
      for (const name of modulesToInstantiate) {
        const ancestorDirectories = [];
        const metadata = await self.apos.synth.getMetadata(name);
        for (const entry of metadata.__meta.chain) {
          const effectiveName = entry.name.replace(/^my-/, '');
          names[effectiveName] = true;
          if (entry.npm && !entry.bundled && !entry.my) {
            pnpmOnly[entry.dirname] = true;
          }
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
        const moduleDir = `${modulesDir}/${name}`;
        for (const dir of directories[name]) {
          const srcDir = `${dir}/${source}`;
          if (fs.existsSync(srcDir)) {
            if (
            // pnpmPaths is provided
              pnpmPaths &&
                    // is pnpm installation
                    self.apos.isPnpm &&
                    // is npm module and not bundled
                    pnpmOnly[dir] &&
                    // isn't apos core module
                    !dir.startsWith(path.join(self.apos.npmRootDir, 'node_modules/apostrophe/'))
            ) {
              // Ignore further attempts to register this path (performance)
              pnpmOnly[dir] = false;
              // resolve symlinked pnpm path
              const resolved = fs.realpathSync(dir);
              // go up to the pnpm node_modules directory
              pnpmPaths.add(resolved.split(name)[0]);
            }
            await fs.copy(srcDir, moduleDir);
          }
        }
      }
    }

    async function build({
      name, options
    }) {
      self.apos.util.log(req.t('apostrophe:assetTypeBuilding', {
        label: req.t(options.label)
      }));
      const modulesDir = `${buildDir}/${name}/modules`;
      const source = options.source || name;
      // Gather pnpm modules that are used in the build to be added as resolve
      // paths
      const pnpmModules = new Set();
      await moduleOverrides(modulesDir, `ui/${source}`, pnpmModules);

      let iconImports,
        componentImports,
        tiptapExtensionImports,
        appImports,
        indexJsImports,
        indexSassImports;
      if (options.apos) {
        iconImports = await getIcons();
        componentImports = await getImports(`${source}/components`, '*.vue', {
          registerComponents: true,
          importLastVersion: true
        });
        /* componentImports = getGlobalVueComponents(self); */
        tiptapExtensionImports = await getImports(
          `${source}/tiptap-extensions`,
          '*.js',
          { registerTiptapExtensions: true }
        );
        appImports = await getImports(`${source}/apps`, '*.js', {
          invokeApps: true,
          enumerateImports: true,
          importSuffix: 'App'
        });
      }

      if (options.index) {
        // Gather modules with non-main, catch-all bundles
        const ignoreModules = self.rebundleModules
          .filter(entry => !entry.main && !entry.source)
          .reduce((acc, entry) => ({
            ...acc,
            [entry.name]: true
          }), {});

        indexJsImports = await getImports(source, 'index.js', {
          invokeApps: true,
          enumerateImports: true,
          importSuffix: 'App',
          requireDefaultExport: true,
          mainModuleBundles: getMainModuleBundleFiles('js'),
          ignoreModules
        });
        indexSassImports = await getImports(source, 'index.scss', {
          importSuffix: 'Stylesheet',
          enumerateImports: true,
          mainModuleBundles: getMainModuleBundleFiles('scss'),
          ignoreModules
        });
      }

      if (options.webpack) {
        const importFile = `${buildDir}/${name}-import.js`;

        writeImportFile({
          importFile,
          prologue: options.prologue,
          icon: iconImports,
          components: componentImports,
          tiptap: tiptapExtensionImports,
          app: appImports,
          indexJs: indexJsImports,
          indexSass: indexSassImports
        });

        const outputFilename = `${name}-build.js`;
        // Remove previous build artifacts, as some pipelines won't build all
        // artifacts if there is no input, and we don't want stale output in the
        // bundle
        fs.removeSync(`${bundleDir}/${outputFilename}`);
        const cssPath = `${bundleDir}/${outputFilename}`.replace(/\.js$/, '.css');
        fs.removeSync(cssPath);
        const webpack = Promise.promisify(webpackModule);
        const webpackBaseConfig = require(`../webpack/${name}/webpack.config`);

        const webpackExtraBundles = writeBundlesImportFiles({
          name,
          buildDir,
          mainBundleName: outputFilename.replace('.js', ''),
          verifiedBundles: getVerifiedBundlesInEffect(),
          getImportFileOutput,
          writeImportFile
        });

        const webpackInstanceConfig = webpackBaseConfig({
          importFile,
          modulesDir,
          outputPath: bundleDir,
          outputFilename,
          bundles: webpackExtraBundles,
          pnpmModulesResolvePaths: pnpmModules,
          // Added on the fly by the
          // @apostrophecms/asset-es5 module,
          // if it is present
          es5TaskFn: self.es5TaskFn
        }, self.apos);

        const webpackInstanceConfigMerged = !options.apos && self.webpackExtensions
          ? webpackMerge({
            customizeArray: self.srcCustomizeArray,
            customizeObject: self.srcCustomizeObject
          })(webpackInstanceConfig, ...Object.values(self.webpackExtensions))
          : webpackInstanceConfig;

        // Inject the cache location at the end - we need the merged config
        const cacheMeta = await computeCacheMeta(
          name,
          webpackInstanceConfigMerged,
          symLinkModules
        );
        webpackInstanceConfigMerged.cache.cacheLocation = cacheMeta.location;
        // Exclude symlinked modules from the cache managedPaths, no other way
        // for now https://github.com/webpack/webpack/issues/12112
        if (cacheMeta.managedPathsRegex) {
          webpackInstanceConfigMerged.snapshot = {
            managedPaths: [ cacheMeta.managedPathsRegex ]
          };
        }

        const result = await webpack(webpackInstanceConfigMerged);
        await writeCacheMeta(name, cacheMeta);

        if (result.compilation.errors.length) {
          // Throwing a string is appropriate in a command line task
          throw cleanErrors(result.toString('errors'));
        } else if (result.compilation.warnings.length) {
          self.apos.util.warn(result.toString('errors-warnings'));
        } else if (process.env.APOS_WEBPACK_VERBOSE) {
          self.apos.util.info(result.toString('verbose'));
        }
        if (fs.existsSync(cssPath)) {
          fs.writeFileSync(cssPath, self.filterCss(fs.readFileSync(cssPath, 'utf8'), {
            modulesPrefix: `${self.getAssetBaseUrl()}/modules`
          }));
        }
        if (options.apos || !self.options.publicBundle) {
          const now = Date.now().toString();
          fs.writeFileSync(`${bundleDir}/${name}-build-timestamp.txt`, now);
        }
      } else {
        if (options.outputs.includes('js')) {
          // We do not use an import file here because import is not
          // an ES5 feature and it is contrary to the spirit of ES5 code
          // to force-fit that type of code. We do not mandate ES6 in
          // "public" code (loaded for logged-out users who might have
          // old browsers).
          //
          // Of course, developers can push an "public" asset that is
          // the output of an ES6 pipeline.
          const publicImports = await getImports(name, '*.js');
          fs.writeFileSync(`${bundleDir}/${name}-build.js`,
            (((options.prologue || '') + '\n') || '') +
                  publicImports.paths.map(path => {
                    return fs.readFileSync(path, 'utf8');
                  }).join('\n')
          );
        }
        if (options.outputs.includes('css')) {
          const publicImports = await getImports(name, '*.css');
          fs.writeFileSync(`${bundleDir}/${name}-build.css`,
            publicImports.paths.map(path => {
              return self.filterCss(fs.readFileSync(path, 'utf8'), {
                modulesPrefix: `${self.getAssetBaseUrl()}/modules`
              });
            }).join('\n')
          );
        }
      }
      self.apos.util.log(req.t('apostrophe:assetTypeBuildComplete', {
        label: req.t(options.label)
      }));
    }

    function getMainModuleBundleFiles(ext) {
      return Object.values(self.verifiedBundles)
        .reduce((acc, entry) => {
          if (!entry.main) {
            return acc;
          };
          return [
            ...acc,
            ...(entry[ext] || [])
          ];
        }, []);
    }

    function getVerifiedBundlesInEffect() {
      return Object.entries(self.verifiedBundles)
        .reduce((acc, [ key, entry ]) => {
          if (entry.main) {
            return acc;
          };
          return {
            ...acc,
            [key]: entry
          };
        }, {});
    }

    function writeImportFile ({
      importFile,
      prologue,
      icon,
      components,
      tiptap,
      app,
      indexJs,
      indexSass
    }) {
      fs.writeFileSync(importFile, (prologue || '') + stripIndent`
              ${(icon && icon.importCode) || ''}
              ${(components && components.importCode) || ''}
              ${(tiptap && tiptap.importCode) || ''}
              ${(app && app.importCode) || ''}
              ${(indexJs && indexJs.importCode) || ''}
              ${(indexSass && indexSass.importCode) || ''}
              ${(icon && icon.registerCode) || ''}
              ${(components && components.registerCode) || ''}
              ${(tiptap && tiptap.registerCode) || ''}
              ` +
              (app
                ? stripIndent`
              if (document.readyState !== 'loading') {
                setTimeout(invoke, 0);
              } else {
                window.addEventListener('DOMContentLoaded', invoke);
              }
              function invoke() {
                ${app.invokeCode}
              }
              `
                : '') +
              // No delay on these, they expect to run early like ui/public code
              // and the first ones invoked set up expected stuff like apos.http
              (indexJs
                ? stripIndent`
                ${indexJs.invokeCode}
              `
                : '')
      );
    }

    async function getIcons() {
      for (const name of modulesToInstantiate) {
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
        registerCode: 'window.apos.iconComponents = window.apos.iconComponents || {};\n'
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
    }

    function merge(scenes) {
      return scenes.reduce((acc, scene) => {
        const jsModules = `${scene}-module-bundle.js`;
        const jsNoModules = `${scene}-nomodule-bundle.js`;
        const css = `${scene}-bundle.css`;

        writeSceneBundle({
          scene,
          filePath: jsModules,
          jsCondition: 'module'
        });
        writeSceneBundle({
          scene,
          filePath: jsNoModules,
          jsCondition: 'nomodule'
        });
        writeSceneBundle({
          scene,
          filePath: css,
          checkForFile: true
        });

        return [
          ...acc,
          jsModules,
          jsNoModules,
          css
        ];
      }, []);
    }

    function writeSceneBundle ({
      scene, filePath, jsCondition, checkForFile = false
    }) {
      const [ _ext, fileExt ] = filePath.match(/\.(\w+)$/);
      const filterBuilds = ({
        scenes, outputs, condition
      }) => {
        return outputs.includes(fileExt) &&
                ((!condition || !jsCondition) || condition === jsCondition) &&
                scenes.includes(scene);
      };

      const filesContent = Object.entries(self.builds)
        .filter(([ _, options ]) => filterBuilds(options))
        .map(([ name ]) => {
          const file = `${bundleDir}/${name}-build.${fileExt}`;
          const readFile = (n, f) => `/* BUILD: ${n} */\n${fs.readFileSync(f, 'utf8')}`;

          if (checkForFile) {
            return fs.existsSync(file)
              ? readFile(name, file)
              : '';
          }

          return readFile(name, file);
        }).join('\n');

      fs.writeFileSync(`${bundleDir}/${filePath}`, filesContent);
    }

    // If NODE_ENV is production, this function will copy the given
    // array of asset files from `${bundleDir}/${file}` to
    // the same relative location in the appropriate release subdirectory in
    // `/public/apos-frontend/releases`, or in `/apos-frontend/releases` in
    // uploadfs if `APOS_UPLOADFS_ASSETS` is present.
    //
    // If NODE_ENV is not production this function does nothing and
    // the assets are served directly from `/public/apos-frontend/${file}`.
    //
    // The namespace (e.g. default) should be part of each filename given.
    // A leading slash should NOT be passed.

    async function deploy(files) {
      if (process.env.NODE_ENV !== 'production') {
        return;
      }
      let copyIn;
      let releaseDir;
      const releaseId = self.getReleaseId();
      if (process.env.APOS_UPLOADFS_ASSETS) {
        // The right choice if uploadfs is mapped to S3, Azure, etc.,
        // not the local filesystem
        copyIn = util.promisify(self.uploadfs.copyIn);
        releaseDir = `/apos-frontend/releases/${releaseId}/${namespace}`;
      } else {
        // The right choice with Docker if uploadfs is just the local filesystem
        // mapped to a volume (a Docker build step can't access that)
        copyIn = fsCopyIn;
        releaseDir = `${self.apos.rootDir}/public/apos-frontend/releases/${releaseId}/${namespace}`;
        await fs.mkdirp(releaseDir);
      }
      for (const file of files) {
        const src = `${bundleDir}/${file}`;
        await copyIn(src, `${releaseDir}/${file}`);
        await fs.remove(src);
      }
    }

    async function fsCopyIn(from, to) {
      const base = path.dirname(to);
      await fs.mkdirp(base);
      return fs.copyFile(from, to);
    }

    async function getImports(folder, pattern, options = {}) {
      let components = [];
      const seen = {};
      for (const name of modulesToInstantiate) {
        const metadata = await self.apos.synth.getMetadata(name);
        for (const entry of metadata.__meta.chain) {
          if (options.ignoreModules?.[entry.name]) {
            seen[entry.dirname] = true;
          }
          if (seen[entry.dirname]) {
            continue;
          }
          components = components.concat(self.apos.util.glob(`${entry.dirname}/ui/${folder}/${pattern}`));
          seen[entry.dirname] = true;
        }
      }

      if (options.importLastVersion) {
        // Reverse the list so we can easily find the last configured import
        // of a given component, allowing "improve" modules to win over
        // the originals when shipping an override of a Vue component
        // with the same name, and filter out earlier versions
        components.reverse();
        const seen = new Set();
        components = components.filter(component => {
          const name = getComponentName(component, options);
          if (seen.has(name)) {
            return false;
          }
          seen.add(name);
          return true;
        });
        // Put the components back in their original order
        components.reverse();
      }

      if (options.mainModuleBundles) {
        components.push(...options.mainModuleBundles);
      }

      return getImportFileOutput(components, options);
    }

    function getImportFileOutput (components, options = {}) {
      let registerCode;
      if (options.registerComponents) {
        registerCode = 'window.apos.vueComponents = window.apos.vueComponents || {};\n';
      } else if (options.registerTiptapExtensions) {
        registerCode = 'window.apos.tiptapExtensions = window.apos.tiptapExtensions || [];\n';
      } else {
        registerCode = '';
      }
      const output = {
        importCode: '',
        registerCode,
        invokeCode: '',
        paths: []
      };

      components.forEach((component, i) => {
        if (options.requireDefaultExport) {
          if (!fs.readFileSync(component, 'utf8').match(/export[\s\n]+default/)) {
            throw new Error(stripIndent`
                    The file ${component} does not have a default export.

                    Any ui/src/index.js file that does not have a function as
                    its default export will cause the build to fail in production.
                  `);
          }
        }
        const jsFilename = JSON.stringify(component);
        const name = getComponentName(component, options, i);
        const jsName = JSON.stringify(name);
        const importName = `${name}${options.importSuffix || ''}`;
        const importCode = `
              import ${importName} from ${jsFilename};
              `;

        output.paths.push(component);
        output.importCode += `${importCode}\n`;

        if (options.registerComponents) {
          output.registerCode += `window.apos.vueComponents[${jsName}] = ${importName};\n`;
        }

        if (options.registerTiptapExtensions) {
          output.registerCode += stripIndent`
                  apos.tiptapExtensions.push(${importName});
                `;
        }
        if (options.invokeApps) {
          output.invokeCode += `${name}${options.importSuffix || ''}();\n`;
        }
      });

      return output;
    }

    async function lockFileIsNewer(name) {
      const timestamp = fs.readFileSync(`${bundleDir}/${name}-build-timestamp.txt`, 'utf8');
      let pkgStats;
      const packageLock = await findPackageLock();
      if (packageLock) {
        pkgStats = await fs.stat(packageLock);
      }

      const pkgTimestamp = pkgStats && pkgStats.mtimeMs;

      return pkgTimestamp > parseInt(timestamp);
    }

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

    function getComponentName(component, { enumerateImports } = {}, i) {
      return path
        .basename(component)
        .replace(/-/g, '_')
        .replace(/\.\w+/, '') + (enumerateImports ? `_${i}` : '');
    }

    function cleanErrors(errors) {
      // Dev experience: remove confusing and inaccurate webpack warning about
      // module loaders when straightforward JS parse errors occur,
      // stackoverflow is full of people confused by this
      return errors.replace(/(ERROR in[\s\S]*?Module parse failed[\s\S]*)You may need an appropriate loader.*/, '$1');
    }

    // A (CPU intensive) webpack cache helper to compute a hash and build paths.
    // Cache the result when possible.
    // The base cache path is by default `data/temp/webpack-cache`
    // but it can be overridden by an APOS_ASSET_CACHE environment.
    // In order to compute an accurate hash, this helper needs
    // the final, merged webpack configuration.
    async function computeCacheMeta(name, webpackConfig, symLinkModules) {
      const cacheBase = self.getCacheBasePath();

      if (!packageLockContentCached) {
        const packageLock = await findPackageLock();
        if (packageLock === false) {
          // this should happen only when testing and
          // we don't want to break all non-core module tests
          packageLockContentCached = 'none';
        } else {
          packageLockContentCached = await fs.readFile(packageLock, 'utf8');
        }
      }

      // Plugins can output timestamps or other random information as
      // configuration (e.g. StylelintWebpackPlugin). As we don't have
      // control over plugins, we need to remove their configuration values.
      // We keep only the plugin name and config keys sorted list.
      // Additionally plugins are sorted by their constructor names.
      // A shallow clone is enough to avoid modification of the original
      // config.
      const config = { ...webpackConfig };
      config.plugins = (config.plugins || []).map(p => {
        const result = [];
        if (p.constructor && p.constructor.name) {
          result.push(p.constructor.name);
        }
        const keys = Object.keys(p);
        keys.sort();
        result.push(...keys);
        return result;
      });
      config.plugins.sort((a, b) => (a[0] || '').localeCompare(b[0]));
      const configString = util.inspect(config, {
        depth: 10,
        compact: true,
        breakLength: Infinity
      });
      const hash = self.apos.util.md5(
              `${self.getNamespace()}:${name}:${packageLockContentCached}:${configString}`
      );
      const location = path.resolve(cacheBase, hash);

      // Retrieve symlinkModules and convert them to managedPaths regex rule
      let managedPathsRegex;
      if (symLinkModules.length > 0) {
        const regex = symLinkModules
          .map(m => self.apos.util.regExpQuote(m))
          .join('|');
        managedPathsRegex = new RegExp(
          '^(.+?[\\/]node_modules)[\\/]((?!' + regex + ')).*[\\/]*'
        );
      }

      return {
        base: cacheBase,
        hash,
        location,
        managedPathsRegex
      };
    }

    // Add .apos, useful for debugging, testing and cache invalidation.
    // It also keeps in sync the modified time of the cache folder.
    async function writeCacheMeta(name, cacheMeta) {
      try {
        const cachePath = path.join(cacheMeta.location, '.apos');
        const lastModified = new Date();
        await fs.writeFile(
          cachePath,
                `${lastModified.toISOString()} ${self.getNamespace()}:${name}`,
                'utf8'
        );
        // should be the same as the meta
        await fs.utimes(cachePath, lastModified, lastModified);
      } catch (e) {
        // Build probably failed, path is missing, ignore
      }
    }

    // Given a set of changes, leave only those that belong to an active
    // Apostrophe module. This would avoid unnecessary builds for non-active
    // watched files (e.g. in multi instance mode).
    // It's an expensive brute force O(n^2), so we do it once for all builds
    // and we rely on the fact that mass changes happen rarely.
    function filterValidChanges(all, modules) {
      return all.filter(c => {
        for (const module of modules) {
          if (c.includes(module)) {
            return true;
          }
        }
        return false;
      });
    }

    // Detect if a build should be executed based on the changed
    // paths. This function is invoked only when the appropriate `argv.changes`
    // is passed to the task.
    function shouldRebuildFor(buildName, buildOptions, changes) {
      const name = buildOptions.source || buildName;
      const id = `/ui/${name}/`;
      for (const change of changes) {
        if (change.includes(id)) {
          return true;
        }
      }
      return false;
    }
  }
});
