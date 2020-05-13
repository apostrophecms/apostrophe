const _ = require('lodash');
const glob = require('glob');
const fs = require('fs-extra');
const Promise = require('bluebird');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const webpackModule = require('webpack');

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
  options: { alias: 'assets' },
  init(self, options) {
    self.addTask('build', 'Build Apostrophe frontend javascript master import files', async function (apos, argv) {
      const buildDir = `${apos.rootDir}/apos-build`;
      const modulesDir = `${buildDir}/modules`;
      // Don't clutter up with previous builds.
      await fs.remove(buildDir);
      await fs.mkdir(buildDir);
      await fs.mkdir(modulesDir);
      await moduleOverrides();
      anon();
      await user();
      merge();

      async function moduleOverrides() {
        let names = {};
        const directories = {};
        for (let name of Object.keys(self.apos.modules)) {
          const ancestorDirectories = [];
          for (let entry of self.apos.modules[name].__meta.chain) {
            const effectiveName = entry.name.replace(/^my-/, '');
            names[effectiveName] = true;
            ancestorDirectories.push(entry.dirname);
            directories[effectiveName] = directories[effectiveName] || [];
            for (let dir of ancestorDirectories) {
              if (!directories[effectiveName].includes(dir)) {
                directories[effectiveName].push(dir);
              }
            }
          }
        }
        names = Object.keys(names);
        for (let name of names) {
          const moduleDir = `${modulesDir}/${name}`;
          for (let dir of directories[name]) {
            const srcDir = `${dir}/src/apos`;
            if (fs.existsSync(srcDir)) {
              await fs.copy(srcDir, moduleDir);
            }
          }
        }
      }

      function anon() {
        let components = [];
        // We do not use an import file here because import is not
        // an ES5 feature and it is contrary to the spirit of ES5 code
        // to force-fit that type of code. We do not mandate ES6 in
        // "always" code (loaded for logged-out users who might have
        // old browsers).
        //
        // Of course, developers can push an "always" asset that is
        // the output of an ES6 pipeline.
        for (let dir of fs.readdirSync(modulesDir)) {
          components = components.concat(glob.sync(`${modulesDir}/${dir}/always/*.js`));
        }
        fs.writeFileSync(`${apos.rootDir}/public/apos-frontend/anon-bundle.js`, components.map(component => {
          return fs.readFileSync(component);
        }).join('\n')); // TODO: use webpack just to minify at the end.
      }

      async function user() {
        const componentImports = getImports('components', '*.vue', { registerComponents: true });
        const tiptapExtensionImports = getImports('tiptap-extensions', '*.js', { registerTiptapExtensions: true });
        const appImports = getImports('apps', '*.js', { invokeApps: true });
        const importFile = `${buildDir}/import.js`;
        fs.writeFileSync(importFile, `
import Vue from 'apostrophe/vue';
window.apos.bus = new Vue();
${componentImports.importCode}
${tiptapExtensionImports.importCode}
${appImports.importCode}
${componentImports.registerCode}
${tiptapExtensionImports.registerCode}
setImmediate(() => {
${appImports.invokeCode}
});
`);
        await Promise.promisify(webpack)({
          entry: importFile,
          mode: 'development',
          optimization: { minimize: false },
          output: {
            path: `${apos.rootDir}/public/apos-frontend`,
            filename: 'user-only-bundle.js'
          },
          // we could extend this with aliases for other apostrophe modules
          // at a later date if needed
          resolveLoader: {
            extensions: [
              '*',
              '.js',
              '.vue',
              '.json'
            ],
            modules: [
              'node_modules/apostrophe/node_modules',
              'node_modules'
            ]
          },
          resolve: {
            extensions: [
              '*',
              '.js',
              '.vue',
              '.json'
            ],
            alias: {
              'apostrophe/vue$': 'vue/dist/vue.esm.js',
              // resolve apostrophe modules, with overrides
              'apostrophe': require('path').resolve(modulesDir)
            },
            modules: [
              'node_modules/apostrophe/node_modules',
              'node_modules'
            ]
          },
          stats: 'verbose',
          module: {
            rules: [
              {
                test: /\.vue$/,
                loader: 'vue-loader'
              },
              {
                test: /\.css$/,
                use: [
                  'vue-style-loader',
                  'css-loader'
                ]
              },
              {
                test: /\.scss$/,
                use: [
                  'vue-style-loader',
                  'css-loader',
                  'sass-loader'
                ]
              },
              {
                test: /\.sass$/,
                use: [
                  'vue-style-loader',
                  'css-loader',
                  'sass-loader?indentedSyntax'
                ]
              }
            ]
          },
          plugins: [// make sure to include the plugin for the magic
            new VueLoaderPlugin()]
        });
      }

      function merge() {
        fs.writeFileSync(`${apos.rootDir}/public/apos-frontend/user-bundle.js`, fs.readFileSync(`${apos.rootDir}/public/apos-frontend/anon-bundle.js`) + fs.readFileSync(`${apos.rootDir}/public/apos-frontend/user-only-bundle.js`));
      }

      function getImports(folder, pattern, options) {
        let components = [];
        const seen = {};
        _.each(self.apos.modules, function (module, name) {
          _.each(module.__meta.chain, function (entry) {
            if (seen[entry.dirname]) {
              return;
            }
            components = components.concat(glob.sync(`${entry.dirname}/src/apos/${folder}/${pattern}`));
            seen[entry.dirname] = true;
          });
        });
        const output = {
          importCode: '',
          registerCode: '',
          invokeCode: ''
        };
        components.forEach(component => {
          const jsFilename = JSON.stringify(component);
          const name = require('path').basename(component).replace(/\.\w+/, '');
          const jsName = JSON.stringify(name);
          const importCode = `
          import ${name} from ${jsFilename};
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
            output.invokeCode += `${name}();\n`;
          }
        });
        return output;
      }
    });
    self.servePublicAssets();
  },
  methods(self, options) {
    return {

      push() {
      },

      servePublicAssets() {
        self.expressMiddleware = {
          // Run really early, before all of the stuff @apostrophecms/express normally
          // puts in, for performance reasons. Preempts expensive
          // queries related to `@apostrophecms/global` on every static file
          when: 'beforeRequired',
          middleware: self.apos.express.static(self.apos.rootDir + '/public', self.options.static || {})
        };
      },

      getCoreAposProperties(when) {
        return _.assign({ modules: {} }, _.pick(self.apos, 'prefix', 'csrfCookieName'), when === 'user' ? {
          // A unique identifier for the lifetime of this
          // HTML page in the browser
          htmlPageId: self.apos.utils.generateId()
        } : {});
      },

      scriptsHelper(when) {
        const json = JSON.stringify(self.getCoreAposProperties(when));
        const bundle = when === 'user' ? `<script src="/apos-frontend/user-bundle.js"></script>` : '<script src="/apos-frontend/anon-bundle.js"></script>';
        return self.apos.templates.safe(`
<script>
  window.apos = ${json};
</script>
${bundle}
`);
      }
    };
  },
  helpers(self, options) {
    return {
      stylesheets: function (when) {
      },
      scripts: function (when) {
        return self.scriptsHelper(when);
      }
    };
  }
};
