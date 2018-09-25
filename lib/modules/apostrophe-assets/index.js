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
      const importFile = `${buildDir}/import-components.js`;
      fs.writeFileSync(importFile, `
import Vue from 'apostrophe/vue';
${componentImports.importCode}
${appImports.importCode}
${componentImports.registerCode}
${appImports.invokeCode}
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
        resolveLoader: {
          extensions: ['*', '.js', '.vue', '.json'],
          alias: {
            'apostrophe': `${apos.rootDir}/node_modules/apostrophe/node_modules`
          }
        },
        resolve: {
          extensions: ['*', '.js', '.vue', '.json'],
          alias: {
            'apostrophe/vue$': `${apos.rootDir}/node_modules/apostrophe/node_modules/vue/dist/vue.esm.js`,
            'apostrophe': `${apos.rootDir}/node_modules/apostrophe/node_modules`
          }
        },
        stats: 'verbose',
        module: {
          rules: [
            {
              test: /\.vue$/,
              loader: 'apostrophe/vue-loader'
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
