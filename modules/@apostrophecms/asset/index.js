const glob = require('glob');
const fs = require('fs-extra');
const Promise = require('bluebird');
const webpackModule = require('webpack');
const globalIcons = require('./lib/globalIcons');
const path = require('path');
const util = require('util');
const express = require('express');
const { stripIndent } = require('common-tags');
const { mergeWithCustomize: webpackMerge } = require('webpack-merge');
const cuid = require('cuid');
const chokidar = require('chokidar');
const _ = require('lodash');
const {
  checkModulesWebpackConfig,
  getWebpackExtensions,
  fillExtraBundles,
  getBundlesNames,
  writeBundlesImportFiles,
  findNodeModulesSymlinks,
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
    rebundleModules: undefined
  },

  async init(self) {

    self.restartId = self.apos.util.generateId();
    self.iconMap = {
      ...globalIcons
    };
    self.configureBuilds();
    self.initUploadfs();

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

    self.extraBundles = fillExtraBundles(verifiedBundles);
    self.webpackExtensions = extensions;
    self.webpackExtensionOptions = extensionOptions;
    self.verifiedBundles = verifiedBundles;
    self.rebundleModules = rebundleModules;
    self.buildWatcherEnable = process.env.APOS_ASSET_WATCH !== '0' && self.options.watch !== false;
    self.buildWatcherDebounceMs = parseInt(self.options.watchDebounceMs || 1000, 10);
    self.buildWatcher = null;
  },
  handlers (self) {
    return {
      'apostrophe:modulesRegistered': {
        async runUiBuildTask() {
          const ran = await self.autorunUiBuildTask();
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
        const placeholder = `[scripts-placeholder:${cuid()}]`;

        req.scriptsPlaceholder = placeholder;

        return {
          placeholder
        };
      },
      stylesheets(req, data) {
        const placeholder = `[stylesheets-placeholder:${cuid()}]`;

        req.stylesheetsPlaceholder = placeholder;

        return {
          placeholder
        };
      }
    };
  },
  tasks(self) {
    return {
      build: {
        usage: 'Build Apostrophe frontend CSS and JS bundles',
        afterModuleInit: true,
        async task(argv = {}) {
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
          // Remove invalid changes. `argv.changes` is a comma separated list of relative
          // to `apos.rootDir` files or folders
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
          // to the same relative path `/public/apos-frontend/namespace/modules/modulename`.
          // Inherited files are also copied, with the deepest subclass overriding in the
          // event of a conflict
          await moduleOverrides(`${bundleDir}/modules`, 'public');

          for (const [ name, options ] of Object.entries(self.builds)) {
            // If the option is not present always rebuild everything...
            let rebuild = argv && !argv['check-apos-build'];
            // ...but only when not in a watcher mode
            if (detectChanges) {
              rebuild = shouldRebuildFor(name, options, sourceChanges);
            } else if (!rebuild) {
              let checkTimestamp = false;

              // Only builds contributing to the apos admin UI (currently just "apos")
              // are candidates to skip the build simply because package-lock.json is
              // older than the bundle. All other builds frequently contain
              // project level code
              if (options.apos) {
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
            const scenes = [ ...new Set(buildsExecuted.map(name => self.builds[name].scenes).flat()) ];
            merge(scenes);
            return buildsExecuted;
          }

          // Discover the set of unique asset scenes that exist (currently
          // just `public` and `apos`) by examining those specified as
          // targets for the various builds
          const scenes = [ ...new Set(Object.values(self.builds).map(options => options.scenes).flat()) ];

          // enumerate public assets and include them in deployment if appropriate
          const publicAssets = glob.sync('modules/**/*', {
            cwd: bundleDir,
            mark: true
          }).filter(match => !match.endsWith('/'));

          const deployFiles = [
            ...publicAssets,
            ...merge(scenes),
            ...getBundlesNames(self.extraBundles, self.options.es5)
          ];

          await deploy(deployFiles);

          if (process.env.APOS_BUNDLE_ANALYZER) {
            return new Promise((resolve, reject) => {
              // Intentionally never resolve it, so the task never exits
              // and the UI stays up
            });
          }

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
              const metadata = self.apos.synth.getMetadata(name);
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
            // Gather pnpm modules that are used in the build to be added as resolve paths
            const pnpmModules = new Set();
            await moduleOverrides(modulesDir, `ui/${source}`, pnpmModules);

            let iconImports, componentImports, tiptapExtensionImports, appImports, indexJsImports, indexSassImports;
            if (options.apos) {
              iconImports = getIcons();
              componentImports = getImports(`${source}/components`, '*.vue', {
                registerComponents: true,
                importLastVersion: true
              });
              tiptapExtensionImports = getImports(`${source}/tiptap-extensions`, '*.js', { registerTiptapExtensions: true });
              appImports = getImports(`${source}/apps`, '*.js', {
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

              indexJsImports = getImports(source, 'index.js', {
                invokeApps: true,
                enumerateImports: true,
                importSuffix: 'App',
                requireDefaultExport: true,
                mainModuleBundles: getMainModuleBundleFiles('js'),
                ignoreModules
              });
              indexSassImports = getImports(source, 'index.scss', {
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
              // Remove previous build artifacts, as some pipelines won't build all artifacts
              // if there is no input, and we don't want stale output in the bundle
              fs.removeSync(`${bundleDir}/${outputFilename}`);
              const cssPath = `${bundleDir}/${outputFilename}`.replace(/\.js$/, '.css');
              fs.removeSync(cssPath);
              const webpack = Promise.promisify(webpackModule);
              const webpackBaseConfig = require(`./lib/webpack/${name}/webpack.config`);

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
              const cacheMeta = await computeCacheMeta(name, webpackInstanceConfigMerged, symLinkModules);
              webpackInstanceConfigMerged.cache.cacheLocation = cacheMeta.location;
              // Exclude symlinked modules from the cache managedPaths, no other way for now
              // https://github.com/webpack/webpack/issues/12112
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
              if (options.apos) {
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
                const publicImports = getImports(name, '*.js');
                fs.writeFileSync(`${bundleDir}/${name}-build.js`,
                  (((options.prologue || '') + '\n') || '') +
                  publicImports.paths.map(path => {
                    return fs.readFileSync(path, 'utf8');
                  }).join('\n')
                );
              }
              if (options.outputs.includes('css')) {
                const publicImports = getImports(name, '*.css');
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
              ${(icon && icon.registerCode) || ''}
              ${(components && components.importCode) || ''}
              ${(tiptap && tiptap.importCode) || ''}
              ${(app && app.importCode) || ''}
              ${(indexJs && indexJs.importCode) || ''}
              ${(indexSass && indexSass.importCode) || ''}
              ${(icon && icon.registerCode) || ''}
              ${(components && components.registerCode) || ''}
              ${(tiptap && tiptap.registerCode) || ''}
              ` +
              (app ? stripIndent`
              if (document.readyState !== 'loading') {
                setTimeout(invoke, 0);
              } else {
                window.addEventListener('DOMContentLoaded', invoke);
              }
              function invoke() {
                ${app.invokeCode}
              }
              ` : '') +
              // No delay on these, they expect to run early like ui/public code
              // and the first ones invoked set up expected stuff like apos.http
              (indexJs ? stripIndent`
                ${indexJs.invokeCode}
              ` : '')
            );
          }

          function getIcons() {
            for (const name of modulesToInstantiate) {
              const metadata = self.apos.synth.getMetadata(name);
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
              registerCode: ''
            };

            for (const [ registerAs, importFrom ] of Object.entries(self.iconMap)) {
              if (importFrom.substring(0, 1) === '~') {
                output.importCode += `import ${importFrom}Icon from '${importFrom.substring(1)}';\n`;
              } else {
                output.importCode += `import ${importFrom}Icon from 'vue-material-design-icons/${importFrom}.vue';\n`;
              }
              output.registerCode += `Vue.component('${registerAs}', ${importFrom}Icon);\n`;
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
              copyIn = require('util').promisify(self.uploadfs.copyIn);
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

          function getImports(folder, pattern, options = {}) {
            let components = [];
            const seen = {};
            for (const name of modulesToInstantiate) {
              const metadata = self.apos.synth.getMetadata(name);
              for (const entry of metadata.__meta.chain) {
                if (options.ignoreModules?.[entry.name]) {
                  seen[entry.dirname] = true;
                }
                if (seen[entry.dirname]) {
                  continue;
                }
                components = components.concat(glob.sync(`${entry.dirname}/ui/${folder}/${pattern}`));
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
            const output = {
              importCode: '',
              registerCode: '',
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
              const importCode = `
              import ${name}${options.importSuffix || ''} from ${jsFilename};
              `;

              output.paths.push(component);
              output.importCode += `${importCode}\n`;

              if (options.registerComponents) {
                output.registerCode += `Vue.component(${jsName}, ${name});\n`;
              }

              if (options.registerTiptapExtensions) {
                output.registerCode += stripIndent`
                  apos.tiptapExtensions = apos.tiptapExtensions || [];
                  apos.tiptapExtensions.push(${name});
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
            // Dev experience: remove confusing and inaccurate webpack warning about module loaders
            // when straightforward JS parse errors occur, stackoverflow is full of people
            // confused by this
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
      },

      'clear-cache': {
        usage: 'Clear build cache',
        afterModuleReady: true,
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
            scenes: [ 'public', 'apos' ],
            webpack: true,
            outputs: [ 'css', 'js' ],
            label: 'apostrophe:modernBuild',
            // Load index.js and index.scss from each module
            index: true,
            // Load only in browsers that support ES6 modules
            condition: 'module',
            prologue: self.srcPrologue
          },
          public: {
            scenes: [ 'public', 'apos' ],
            outputs: [ 'css', 'js' ],
            label: 'apostrophe:rawCssAndJs',
            // Just concatenates
            webpack: false
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
              import Vue from 'Modules/@apostrophecms/ui/lib/vue';
              window.apos.bus = new Vue();
            `,
            // Load only in browsers that support ES6 modules
            condition: 'module'
          }
          // We could add an apos-ie11 bundle that just pushes a "sorry charlie" prologue,
          // if we chose
        };
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
