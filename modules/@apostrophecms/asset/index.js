const glob = require('glob');
const fs = require('fs-extra');
const Promise = require('bluebird');
const webpackModule = require('webpack');
const globalIcons = require('./lib/globalIcons');
const path = require('path');
const express = require('express');
const { stripIndent } = require('common-tags');

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
    refreshOnRestart: false
  },

  init(self) {
    self.restartId = self.apos.util.generateId();
    self.iconMap = {
      ...globalIcons
    };
    self.configureBuilds();
    self.initUploadfs();
  },
  handlers (self) {
    return {
      'apostrophe:modulesRegistered': {
        async runUiBuildTask() {
          if (
            // Do not automatically build the UI if we're starting from a task
            !self.apos.isTask() &&
            // Or if we're in production
            process.env.NODE_ENV !== 'production' &&
            // Or if we've set an app option to skip the auto build
            self.apos.options.autoBuild !== false
          ) {
            // If starting up normally, run the build task, checking if we
            // really need to update the apos build
            await self.apos.task.invoke('@apostrophecms/asset:build', {
              'check-apos-build': true
            });
          }
        }
      },
      'apostrophe:destroy': {
        async destroyUploadfs() {
          if (self.uploadfs && (self.uploadfs !== self.apos.uploadfs)) {
            await Promise.promisify(self.uploadfs.destroy)();
          }
        }
      }
    };
  },
  tasks(self) {
    return {
      build: {
        usage: 'Build Apostrophe frontend CSS and JS bundles',
        afterModuleInit: true,
        async task(argv) {
          const req = self.apos.task.getReq();
          const namespace = self.getNamespace();
          const buildDir = `${self.apos.rootDir}/apos-build/${namespace}`;
          const bundleDir = `${self.apos.rootDir}/public/apos-frontend/${namespace}`;
          // Don't clutter up with previous builds.
          await fs.remove(buildDir);
          await fs.mkdirp(buildDir);

          for (const [ name, options ] of Object.entries(self.builds)) {
            // If the option is not present always rebuild everything
            let rebuild = argv && !argv['check-apos-build'];
            if (!rebuild) {
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
              await build(name, options);
            }
          }

          // Discover the set of unique asset scenes that exist (currently
          // just `public` and `apos`) by examining those specified as
          // targets for the various builds
          const scenes = [ ...new Set(Object.values(self.builds).map(options => options.scenes).flat()) ];
          let bundles = [];
          for (const scene of scenes) {
            bundles = [ ...bundles, ...merge(scene) ];
          }

          await deploy(bundles);

          if (process.env.APOS_BUNDLE_ANALYZER) {
            return new Promise((resolve, reject) => {
              // Intentionally never resolve it, so the task never exits
              // and the UI stays up
            });
          }

          async function moduleOverrides(modulesDir, source) {
            await fs.remove(modulesDir);
            await fs.mkdirp(modulesDir);
            let names = {};
            const directories = {};
            // Most other modules are not actually instantiated yet, but
            // we can access their metadata, which is sufficient
            for (const name of self.apos.modulesToBeInstantiated()) {
              const ancestorDirectories = [];
              const metadata = self.apos.synth.getMetadata(name);
              for (const entry of metadata.__meta.chain) {
                const effectiveName = entry.name.replace(/^my-/, '');
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
              const moduleDir = `${modulesDir}/${name}`;
              for (const dir of directories[name]) {
                const srcDir = `${dir}/ui/${source}`;
                if (fs.existsSync(srcDir)) {
                  await fs.copy(srcDir, moduleDir);
                }
              }
            }
          }

          async function build(name, options) {
            self.apos.util.log(req.t('apostrophe:assetTypeBuilding', {
              label: req.t(options.label)
            }));
            const modulesDir = `${buildDir}/${name}/modules`;
            const source = options.source || name;
            await moduleOverrides(modulesDir, source);

            let iconImports, componentImports, tiptapExtensionImports, appImports, indexJsImports, indexSassImports;
            if (options.apos) {
              iconImports = getIcons();
              componentImports = getImports(`${source}/components`, '*.vue', { registerComponents: true });
              tiptapExtensionImports = getImports(`${source}/tiptap-extensions`, '*.js', { registerTiptapExtensions: true });
              appImports = getImports(`${source}/apps`, '*.js', {
                invokeApps: true,
                enumerateImports: true,
                importSuffix: 'App'
              });
            }
            if (options.index) {
              indexJsImports = getImports(source, 'index.js', {
                invokeApps: true,
                enumerateImports: true,
                importSuffix: 'App',
                requireDefaultExport: true
              });
              indexSassImports = getImports(source, 'index.scss', {
                importSuffix: 'Stylesheet',
                enumerateImports: true
              });
            }

            if (options.webpack) {
              const importFile = `${buildDir}/${name}-import.js`;

              fs.writeFileSync(importFile, (options.prologue || '') + stripIndent`
                ${(iconImports && iconImports.importCode) || ''}
                ${(iconImports && iconImports.registerCode) || ''}
                ${(componentImports && componentImports.importCode) || ''}
                ${(tiptapExtensionImports && tiptapExtensionImports.importCode) || ''}
                ${(appImports && appImports.importCode) || ''}
                ${(indexJsImports && indexJsImports.importCode) || ''}
                ${(indexSassImports && indexSassImports.importCode) || ''}
                ${(iconImports && iconImports.registerCode) || ''}
                ${(componentImports && componentImports.registerCode) || ''}
                ${(tiptapExtensionImports && tiptapExtensionImports.registerCode) || ''}
              ` +
                (appImports ? stripIndent`
                  setTimeout(() => {
                    ${appImports.invokeCode}
                  }, 0);
                ` : '') +
                // No delay on these, they expect to run early like ui/public code
                // and the first ones invoked set up expected stuff like apos.http
                (indexJsImports ? stripIndent`
                  ${indexJsImports.invokeCode}
                ` : '')
              );

              const outputFilename = `${name}-build.js`;
              // Remove previous build artifacts, as some pipelines won't build all artifacts
              // if there is no input, and we don't want stale output in the bundle
              fs.removeSync(`${bundleDir}/${outputFilename}`);
              fs.removeSync(`${bundleDir}/${outputFilename}`.replace(/\.js$/, '.css'));
              await Promise.promisify(webpackModule)(require(`./lib/webpack/${name}/webpack.config`)(
                {
                  importFile,
                  modulesDir,
                  outputPath: bundleDir,
                  outputFilename
                },
                self.apos
              ));
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
                const publicImports = getImports(name, '*.js', { });
                fs.writeFileSync(`${bundleDir}/${name}-build.js`,
                  (((options.prologue || '') + '\n') || '') +
                  publicImports.paths.map(path => {
                    return fs.readFileSync(path, 'utf8');
                  }).join('\n')
                );
              }
              if (options.outputs.includes('css')) {
                const publicImports = getImports(name, '*.css', { });
                fs.writeFileSync(`${bundleDir}/${name}-build.css`,
                  publicImports.paths.map(path => {
                    return fs.readFileSync(path, 'utf8');
                  }).join('\n')
                );
              }
            }
            self.apos.util.log(req.t('apostrophe:assetTypeBuildComplete', {
              label: req.t(options.label)
            }));
          }

          function getIcons() {

            for (const name of self.apos.modulesToBeInstantiated()) {
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

          function merge(scene) {
            const jsModules = `${scene}-module-bundle.js`;
            const jsNoModules = `${scene}-nomodule-bundle.js`;
            const css = `${scene}-bundle.css`;
            fs.writeFileSync(
              `${bundleDir}/${jsModules}`,
              Object.entries(self.builds).filter(
                ([ name, options ]) => options.scenes.includes(scene) &&
                options.outputs.includes('js') &&
                (!options.condition || options.condition === 'module')
              ).map(([ name, options ]) => {
                return `// BUILD: ${name}\n` + fs.readFileSync(`${bundleDir}/${name}-build.js`, 'utf8');
              }).join('\n')
            );
            fs.writeFileSync(
              `${bundleDir}/${jsNoModules}`,
              Object.entries(self.builds).filter(
                ([ name, options ]) => options.scenes.includes(scene) &&
                options.outputs.includes('js') &&
                (!options.condition || options.condition === 'nomodule')
              ).map(([ name, options ]) => {
                return `// BUILD: ${name}\n` + fs.readFileSync(`${bundleDir}/${name}-build.js`, 'utf8');
              }).join('\n')
            );
            fs.writeFileSync(
              `${bundleDir}/${css}`,
              Object.entries(self.builds).filter(
                ([ name, options ]) => options.scenes.includes(scene) &&
                options.outputs.includes('css')
              ).map(([ name, options ]) => {
                const file = `${bundleDir}/${name}-build.css`;
                if (fs.existsSync(file)) {
                  return `/* BUILD: ${name} */\n` + fs.readFileSync(file, 'utf8');
                } else {
                  return '';
                }
              }).join('\n')
            );
            return [ jsModules, jsNoModules, css ];
          }

          async function deploy(bundles) {
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
              copyIn = fs.copyFile;
              releaseDir = `${self.apos.rootDir}/public/apos-frontend/releases/${releaseId}/${namespace}`;
              await fs.mkdirp(releaseDir);
            }
            for (const bundle of bundles) {
              const src = `${bundleDir}/${bundle}`;
              await copyIn(src, `${releaseDir}/${bundle}`);
              await fs.remove(src);
            }
          }

          function getImports(folder, pattern, options) {
            let components = [];
            const seen = {};
            for (const name of self.apos.modulesToBeInstantiated()) {
              const metadata = self.apos.synth.getMetadata(name);
              for (const entry of metadata.__meta.chain) {
                if (seen[entry.dirname]) {
                  continue;
                }
                components = components.concat(glob.sync(`${entry.dirname}/ui/${folder}/${pattern}`));
                seen[entry.dirname] = true;
              }
            }
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
              const name = require('path').basename(component).replace(/\.\w+/, '') + (options.enumerateImports ? `_${i}` : '');
              const jsName = JSON.stringify(name);
              output.paths.push(component);
              const importCode = `
              import ${name}${options.importSuffix || ''} from ${jsFilename};
              `;
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

            if (await fs.pathExists(`${self.apos.rootDir}/package-lock.json`)) {
              pkgStats = await fs.stat(`${self.apos.rootDir}/package-lock.json`);
            } else if (await fs.pathExists(`${self.apos.rootDir}/yarn.lock`)) {
              pkgStats = await fs.stat(`${self.apos.rootDir}/yarn.lock`);
            }

            const pkgTimestamp = pkgStats && pkgStats.mtimeMs;

            return pkgTimestamp > parseInt(timestamp);
          }
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
      async initUploadfs() {
        if (self.options.uploadfs) {
          self.uploadfs = await self.apos.modules['@apostrophecms/uploadfs'].getInstance(self.options.uploadfs);
        } else {
          self.uploadfs = self.apos.uploadfs;
        }
      },
      stylesheetsHelper(when) {
        const base = self.getAssetBaseUrl();
        const bundle = `<link href="${base}/${when}-bundle.css" rel="stylesheet" />`;
        return self.apos.template.safe(bundle);
      },
      scriptsHelper(when) {
        const base = self.getAssetBaseUrl();
        if (self.options.es5) {
          return self.apos.template.safe(stripIndent`
            <script nomodule src="${base}/${when}-nomodule-bundle.js"></script>
            <script type="module" src="${base}/${when}-module-bundle.js"></script>
          `);
        } else {
          return self.apos.template.safe(stripIndent`
            <script src="${base}/${when}-module-bundle.js"></script>
          `);
        }
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
      // An implementation method that you should not need to call.
      // Sets a predetermined configuration for the frontend builds.
      // If you are trying to enable IE11 support for ui/src, use the
      // `es5: true` option (es5 builds are disabled by default).
      configureBuilds() {
        const srcPrologue = stripIndent`
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
            prologue: srcPrologue
          },
          'src-es5': {
            // An alternative build from the same sources for IE11
            source: 'src',
            webpack: true,
            scenes: [ 'public', 'apos' ],
            // The CSS from the src build is identical, do not duplicate it
            outputs: [ 'js' ],
            label: 'apostrophe:ie11Build',
            // Load index.js and index.scss from each module
            index: true,
            // The polyfills babel will be expecting
            prologue: stripIndent`
              import "core-js/stable";
              import "regenerator-runtime/runtime";
              ${srcPrologue}
            `,
            // Load only in browsers that do not support ES6 modules
            condition: 'nomodule'
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
        if (!self.options.es5) {
          delete self.builds['src-es5'];
        }
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
        const script = fs.readFileSync(path.join(__dirname, '/lib/refresh-on-restart.js'), 'utf8');
        return self.apos.template.safe(`<script data-apos-refresh-on-restart="${self.action}/restart-id">\n${script}</script>`);
      }
    };
  },
  apiRoutes(self) {
    if (!self.shouldRefreshOnRestart()) {
      return;
    }
    return {
      // Use a POST route so IE11 doesn't cache it
      post: {
        async restartId(req) {
          // Long polling: keep the logs quiet by responding slowly, except the
          // first time. If we restart, the request will fail immediately,
          // and the client will know to try again with `fast`. The client also
          // uses `fast` the first time
          if (!req.query.fast) {
            await Promise.delay(30000);
          }
          return self.restartId;
        }
      }
    };
  }
};
