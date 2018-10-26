const _ = require('lodash');
const glob = require('glob');
const fs = require('fs');
const Promise = require('bluebird');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const webpackModule = require('webpack');

function webpack(config, callback) {
  return webpackModule(config, function(err, stats) {
    if (err || stats.hasErrors()) {
      return callback(err || stats.toJson().errors.join('\n'));
    }
    return callback(null);
  });
}

module.exports = {
  alias: 'assets',
  afterConstruct: function(self) {
    self.servePublicAssets();
  },
  construct: function(self, options) {
    self.addTask('build', 'Build Apostrophe frontend javascript master import file', (apos, argv) => {

      const componentImports = getImports('components', '*.vue', { registerComponents: true });
      const appImports = getImports('apps', '*.js', { invokeApps: true });
      const buildDir = `${apos.rootDir}/apos-build`;
      if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
      }
      const importFile = `${buildDir}/import.js`;
      fs.writeFileSync(importFile, `
import Vue from 'vue/dist/vue.js';
window.apos.bus = new Vue();

// // TODO this should be factored to somewhere sensible,
// // but what does that import path look like?
// import axios from 'axios';
// window.apos.api = async function(moduleName, verb, data) {
//   // Try it as a module name, if no match, try it as an alias
//   const options = window.apos.modules[moduleName] || window.apos[moduleName];
//   return await axios.create({
//     headers: {
//       'X-XSRF-TOKEN': cookies.get(window.apos.csrfCookieName)
//     }
//   }).post(
//     options.action + '/' + verb,
//     data
//   );
// };

${componentImports.importCode}
${appImports.importCode}
${componentImports.registerCode}
setImmediate(() => {
  ${appImports.invokeCode}
});

`
      );
      return Promise.promisify(webpack)({
        entry: importFile,
        mode: 'development',
        optimization: {
          minimize: false
        },
        output: {
          path: `${apos.rootDir}/public/apos-frontend`,
          filename: 'user-bundle.js'
        },
        // we could extend this with aliases for other apostrophe modules
        // at a later date if needed
        // resolveLoader: {
        //   extensions: ['*', '.js', '.vue', '.json'],
        //   alias: {
        //     'apostrophe': `${apos.rootDir}/node_modules/apostrophe/node_modules`
        //   }
        // },
        resolve: {
          modules: [ require('path').resolve(__dirname + '/../../..') + '/node_modules' ],
          extensions: ['*', '.js', '.vue', '.json'],
          alias: {
            // Unsustainable - normal npm full install would
            // flatten all the dependencies. -Tom
            // 'apostrophe/vue$': `${apos.rootDir}/node_modules/apostrophe/node_modules/vue/dist/vue.esm.js`,
            // 'apostrophe': `${apos.rootDir}/node_modules/apostrophe/node_modules`
          }
        },
        resolveLoader: {
          modules: [ require('path').resolve(__dirname + '/../../..') + '/node_modules' ],
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
        plugins: [
          // make sure to include the plugin for the magic
          new VueLoaderPlugin()
        ]
      });

      function getImports(folder, pattern, options) {
        let components = [];
        const seen = {};
        _.each(apos.modules, function(module, name) {
          _.each(module.__meta.chain, function(entry) {
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
          if (options.invokeApps) {
            output.invokeCode += `${name}();\n`;
          }
        });
        return output;
      }

    });

    self.push = function() {
      // console.log('TODO remove all old-school asset push calls');
    };

    self.addHelpers({
      stylesheets: function(when) {
        console.log('TODO do we still need a stylesheets helper');
      },
      scripts: function(when) {
        return self.scriptsHelper(when);
      }
    });

    self.servePublicAssets = function() {
      self.expressMiddleware = {
        // Run really early, before all of the stuff apostrophe-express normally
        // puts in, for performance reasons. Preempts expensive
        // queries related to `apostrophe-global` on every static file
        when: 'beforeRequired',
        middleware: self.apos.express.static(
          self.apos.rootDir + '/public',
          self.options.static || {}
        )
      };
    };

    self.getCoreAposProperties = function(when) {
      return _.assign(
        {
          modules: {}
        },
        _.pick(self.apos, 'prefix', 'csrfCookieName'),
        (when === 'user')
          ? {
          // A unique identifier for the lifetime of this
          // HTML page in the browser
            htmlPageId: self.apos.utils.generateId()
          } : {}
      );
    };

    self.scriptsHelper = function(when) {
      const json = JSON.stringify(self.getCoreAposProperties(when));
      return self.apos.templates.safe(`
<script>
  window.apos = ${json};
</script>
<script src="/apos-frontend/user-bundle.js"></script>
`);
    };
  }
};
