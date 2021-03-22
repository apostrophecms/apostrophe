const glob = require('glob');
const fs = require('fs-extra');
const Promise = require('bluebird');
const webpackModule = require('webpack');
const globalIcons = require('./lib/globalIcons');
const path = require('path');
const express = require('express');

module.exports = {

  options: {
    alias: 'asset',
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
  },
  tasks(self) {
    return {
      build: {
        usage: 'Build Apostrophe frontend javascript master import files',
        afterModuleInit: true,
        async task(argv) {
          const namespace = self.getNamespace();
          const buildDir = `${self.apos.rootDir}/apos-build/${namespace}`;
          const modulesDir = `${buildDir}/modules`;
          const bundleDir = `${self.apos.rootDir}/public/apos-frontend/${namespace}`;
          // Don't clutter up with previous builds.
          await fs.remove(buildDir);
          await fs.mkdirp(buildDir);
          await fs.remove(modulesDir);
          await fs.mkdirp(modulesDir);
          await fs.remove(bundleDir);
          await fs.mkdirp(bundleDir);
          await moduleOverrides();
          buildPublicCssBundle();
          buildPublicJsBundle();
          await buildAposBundle();
          merge();
          await deploy();

          if (process.env.APOS_BUNDLE_ANALYZER) {
            return new Promise((resolve, reject) => {
              // Intentionally never resolve it, so the task never exits
              // and the UI stays up
            });
          }

          async function moduleOverrides() {
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
                const srcDir = `${dir}/ui/apos`;
                if (fs.existsSync(srcDir)) {
                  await fs.copy(srcDir, moduleDir);
                }
              }
            }
          }

          function buildPublicCssBundle() {
            const publicImports = getImports('public', '*.css', { });
            fs.writeFileSync(`${bundleDir}/public-bundle.css`,
              publicImports.paths.map(path => {
                return fs.readFileSync(path);
              }).join('\n')
            ); // TODO: use webpack just to minify at the end.
          }

          function buildPublicJsBundle() {
            // We do not use an import file here because import is not
            // an ES5 feature and it is contrary to the spirit of ES5 code
            // to force-fit that type of code. We do not mandate ES6 in
            // "public" code (loaded for logged-out users who might have
            // old browsers).
            //
            // Of course, developers can push an "public" asset that is
            // the output of an ES6 pipeline.
            const publicImports = getImports('public', '*.js', { });
            fs.writeFileSync(`${bundleDir}/public-bundle.js`,
              `
    (function() {
    window.apos = window.apos || {};
    var data = document.body && document.body.getAttribute('data-apos');
    Object.assign(window.apos, JSON.parse(data || '{}'));
    if (data) {
      document.body.removeAttribute('data-apos');
    }
    })();
    ` +
            publicImports.paths.map(path => {
              return fs.readFileSync(path);
            }).join('\n')); // TODO: use webpack just to minify at the end.
          }

          async function buildAposBundle() {
            const iconImports = getIcons();
            const componentImports = getImports('apos/components', '*.vue', { registerComponents: true });
            const tiptapExtensionImports = getImports('apos/tiptap-extensions', '*.js', { registerTiptapExtensions: true });
            const appImports = getImports('apos/apps', '*.js', {
              invokeApps: true,
              importSuffix: 'App'
            });
            const importFile = `${buildDir}/import.js`;

            fs.writeFileSync(importFile, `
    import 'Modules/@apostrophecms/ui/scss/global/import-all.scss';
    import Vue from 'Modules/@apostrophecms/ui/lib/vue';
    if (window.apos.modules) {
    for (const module of Object.values(window.apos.modules)) {
      if (module.alias) {
        window.apos[module.alias] = module;
      }
    }
    }
    window.apos.bus = new Vue();
    ${iconImports.importCode}
    ${iconImports.registerCode}
    ${componentImports.importCode}
    ${tiptapExtensionImports.importCode}
    ${appImports.importCode}
    ${iconImports.registerCode}
    ${componentImports.registerCode}
    ${tiptapExtensionImports.registerCode}
    setTimeout(() => {
    ${appImports.invokeCode}
    }, 0);
            `);

            fs.writeFileSync(`${buildDir}/imports.json`, JSON.stringify({
              icons: iconImports,
              components: componentImports,
              tiptapExtensions: tiptapExtensionImports,
              apps: appImports
            }));

            await Promise.promisify(webpackModule)(require('./lib/webpack.config')(
              {
                importFile,
                modulesDir,
                outputPath: bundleDir,
                outputFilename: 'apos-only-bundle.js'
              },
              self.apos
            ));
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

          function merge() {
            fs.writeFileSync(`${bundleDir}/apos-bundle.js`, fs.readFileSync(`${bundleDir}/public-bundle.js`) + fs.readFileSync(`${bundleDir}/apos-only-bundle.js`));
          }

          async function deploy() {
            if (process.env.NODE_ENV !== 'production') {
              return;
            }
            let copyIn;
            let releaseDir;
            const releaseId = self.getReleaseId();
            if (process.env.APOS_UPLOADFS_ASSETS) {
              // The right choice if uploadfs is mapped to S3, Azure, etc.,
              // not the local filesystem
              copyIn = require('util').promisify(self.apos.uploadfs.copyIn);
              releaseDir = `/apos-frontend/releases/${releaseId}/${namespace}`;
            } else {
              // The right choice with Docker if uploadfs is just the local filesystem
              // mapped to a volume (a Docker build step can't access that)
              copyIn = fs.copyFile;
              releaseDir = `${self.apos.rootDir}/public/apos-frontend/releases/${releaseId}/${namespace}`;
              await fs.mkdirp(releaseDir);
            }
            for (const file of [ 'apos-bundle.js', 'public-bundle.js', 'public-bundle.css' ]) {
              const src = `${bundleDir}/${file}`;
              await copyIn(src, `${releaseDir}/${file}`);
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

            components.forEach(component => {
              const jsFilename = JSON.stringify(component);
              const name = require('path').basename(component).replace(/\.\w+/, '');
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
                output.registerCode += `
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
      stylesheetsHelper(when) {
        const base = self.getAssetBaseUrl();
        // The styles for apostrophe admin UI are baked into the JS bundle. But
        // for public styles we break them out separately to avoid a FOUC.
        const bundle = `<link href="${base}/public-bundle.css" rel="stylesheet" />`;
        return self.apos.template.safe(bundle);
      },
      scriptsHelper(when) {
        const base = self.getAssetBaseUrl();
        let bundle;
        if (when === 'apos') {
          bundle = `<script src="${base}/apos-bundle.js"></script>`;
        } else {
          bundle = `<script src="${base}/public-bundle.js"></script>`;
        }
        return self.apos.template.safe(bundle);
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
          throw new Error(`When running in production you must set the APOS_RELEASE_ID
environment variable to a short, unique string identifying this particular
release of the application, or write it to the file release-id. Apostrophe will
also autodetect HEROKU_RELEASE_VERSION, PLATFORM_TREE_ID or the current git commit
if your deployment is a git checkout.`);
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
            return `${self.apos.uploadfs.getUrl()}${releaseDir}`;
          } else {
            return releaseDir;
          }
        } else {
          return `/apos-frontend/${namespace}`;
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
      get: {
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
