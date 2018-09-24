const _ = require('lodash');
const glob = require('glob');
const fs = require('fs');
const Promise = require('bluebird');
const VueLoaderPlugin = require('vue-loader').VueLoaderPlugin;
const exec = require('child-process-promise').exec;
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
      // 1. rsync-like copy of everything to public/apos-modules
      // 2. webpack can glob it, and we can make the export file
      let components = [];
      const seen = {};
      _.each(apos.modules, function(module, name) {
        _.each(module.__meta.chain, function(entry) {
          if (seen[entry.dirname]) {
            return;
          }
          components = components.concat(glob.sync(`${entry.dirname}/src/apos/**/*.vue`));       
          seen[entry.dirname] = true;
        });
      });
      const mapped = components.map(component => {
        const jsFilename = JSON.stringify(component);
        const name = require('path').basename(component).replace(/\.\w+/, '');
        const jsName = JSON.stringify(name);
        return `
import ${name} from ${jsFilename};
Vue.component(${jsName}, ${name});
`
      ;
      }).join('\n');
      const buildDir = `${apos.rootDir}/apos-build`;
      if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
      }
      const importFile = `${buildDir}/import-components.js`;
      fs.writeFileSync(importFile, `
import Vue from 'apostrophe/vue';
${mapped}
`
      );
      return Promise.promisify(webpack)({
        entry: importFile,
        output: {
          path: `${apos.rootDir}/public/apos-frontend`,
          filename: 'user-bundle.js'
        },
        resolve: {
          alias: {
            apostrophe: apos.rootDir + '/node_modules/apostrophe/node_modules'
          }
        },
        stats: 'verbose',
        module: {
          rules: [
            {
              test: /\.vue$/,
              loader: 'vue-loader'
            }
          ]
        },
        plugins: [
          // make sure to include the plugin for the magic
          new VueLoaderPlugin()
        ]
      });
    });

    self.push = function() {};
    self.addHelpers({
      stylesheets: function(when) {
        console.log('TODO do we still need a stylesheets helper');
      },
      scripts: function(when) {
        return self.apos.templates.safe('<script src="/apos-frontend/user-bundle.js"></script>');
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
  }
};

