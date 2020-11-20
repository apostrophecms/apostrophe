const _ = require('lodash');
const glob = require('glob');
const fs = require('fs-extra');
const Promise = require('bluebird');
const webpackModule = require('webpack');
const globalIcons = require('./lib/globalIcons');
const path = require('path');

// Wrap webpack to report its errors readably, in
// preparation to promisify it

function webpack(config, cb) {
  return webpackModule(config, function (err, stats) {
    if (err || stats.hasErrors()) {
      return cb(err || stats.toJson().errors.join('\n'));
    }
    return cb(null);
  });
}

module.exports = {

  options: {
    alias: 'asset',
    // If this option is true and process.env.NODE_ENV is not `production`,
    // the browser will refresh when the Apostrophe application
    // restarts. A useful companion to `nodemon`.
    refreshOnRestart: false
  },

  init(self, options) {
    self.restartId = self.apos.util.generateId();
    self.iconMap = {
      ...globalIcons
    };
    self.addTask('build', 'Build Apostrophe frontend javascript master import files', self.buildTask);
  },
  middleware(self, options) {
    return {
      serveStaticAssets: {
        before: '@apostrophecms/express',
        middleware: self.apos.express.static(self.apos.rootDir + '/public', self.options.static || {})
      }
    };
  },
  methods(self, options) {
    return {
      scriptsHelper(when) {
        // TODO we still need an asset generation identifier
        const bundle = (when === 'apos') ? '<script src="/apos-frontend/apos-bundle.js"></script>' : '<script src="/apos-frontend/public-bundle.js"></script>';
        return self.apos.template.safe(`
${bundle}
`);
      },
      shouldRefreshOnRestart() {
        return options.refreshOnRestart && (process.env.NODE_ENV !== 'production');
      },
      // Register an icon as a Vue component for use in the Apostrophe admin
      // interface. This is suitable for use with the `icon` option of the
      // `@apostrophecms/widget-type` module.
      //
      // `registerAs` should be a hyphenated name like `chevron-down-icon`
      // and will be registered as a Vue component so your frontend logic does not
      // have to separately import it. `importFrom` should be the name
      // of a Vue component file, without the `.vue` extension, as found in
      // the `vue-material-design-icons` npm package, like `ChevronDown`.
      //
      // Alternatively, you may import an icon as a Vue component from any npm
      // module if you precede `importFrom` with a `~`. In the latter case a `.vue`
      // extension is not automatically added.
      addIcon(registerAs, importFrom) {
        self.iconMap[registerAs] = importFrom;
      },
      async buildTask(apos, argv) {
        const buildDir = `${apos.rootDir}/apos-build`;
        const modulesDir = `${buildDir}/modules`;
        const bundleDir = `${apos.rootDir}/public/apos-frontend`;

        // Don't clutter up with previous builds.
        await fs.remove(buildDir);
        await fs.mkdir(buildDir);
        await fs.mkdir(modulesDir);
        await fs.remove(bundleDir);
        await fs.mkdir(bundleDir);
        await moduleOverrides();
        buildPublicBundle();
        await buildAposBundle();
        merge();
        if (process.env.APOS_BUNDLE_ANALYZER) {
          return new Promise((resolve, reject) => {
            // Intentionally never resolve it, so the task never exits
            // and the UI stays up
          });
        }

        async function moduleOverrides() {
          let names = {};
          const directories = {};
          for (const name of Object.keys(self.apos.modules)) {
            const ancestorDirectories = [];
            for (const entry of self.apos.modules[name].__meta.chain) {
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

        function buildPublicBundle() {
          // We do not use an import file here because import is not
          // an ES5 feature and it is contrary to the spirit of ES5 code
          // to force-fit that type of code. We do not mandate ES6 in
          // "public" code (loaded for logged-out users who might have
          // old browsers).
          //
          // Of course, developers can push an "public" asset that is
          // the output of an ES6 pipeline.
          const publicImports = getImports('public', '*.js', { });
          fs.writeFileSync(`${apos.rootDir}/public/apos-frontend/public-bundle.js`,
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
setImmediate(() => {
${appImports.invokeCode}
});
          `);

          fs.writeFileSync(`${buildDir}/imports.json`, JSON.stringify({
            icons: iconImports,
            components: componentImports,
            tiptapExtensions: tiptapExtensionImports,
            apps: appImports
          }));

          await Promise.promisify(webpack)(require('./lib/webpack.config')(
            {
              importFile,
              modulesDir
            },
            apos
          ));
        }

        function getIcons() {
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
          fs.writeFileSync(`${apos.rootDir}/public/apos-frontend/apos-bundle.js`, fs.readFileSync(`${apos.rootDir}/public/apos-frontend/public-bundle.js`) + fs.readFileSync(`${apos.rootDir}/public/apos-frontend/apos-only-bundle.js`));
        }

        function getImports(folder, pattern, options) {
          let components = [];
          const seen = {};
          _.each(self.apos.modules, function (module, name) {
            _.each(module.__meta.chain, function (entry) {
              if (seen[entry.dirname]) {
                return;
              }
              components = components.concat(glob.sync(`${entry.dirname}/ui/${folder}/${pattern}`));
              seen[entry.dirname] = true;
            });
          });
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

    };
  },
  helpers(self, options) {
    return {
      stylesheets: function (when) {
        // Stylesheets are part of the js bundle
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
  apiRoutes(self, options) {
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
