const path = require('path');
const merge = require('webpack-merge').merge;
const scss = require('./webpack.scss');
const vue = require('./webpack.vue');
const js = require('./webpack.js');

let BundleAnalyzerPlugin;

if (process.env.APOS_BUNDLE_ANALYZER) {
  BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
}

module.exports = ({
  importFile,
  modulesDir,
  outputPath,
  outputFilename,
  // it's a Set, not an array
  pnpmModulesResolvePaths
}, apos) => {
  const tasks = [ scss, vue, js ].map(task =>
    task(
      {
        importFile,
        modulesDir
      },
      apos
    )
  );

  const pnpmModulePath = apos.isPnpm ? [ path.join(apos.selfDir, '../') ] : [];
  const config = {
    entry: importFile,
    // Ensure that the correct version of vue-loader is found
    context: __dirname,
    mode: process.env.NODE_ENV || 'development',
    optimization: {
      minimize: process.env.NODE_ENV === 'production'
    },
    devtool: 'source-map',
    output: {
      path: outputPath,
      filename: outputFilename
    },
    // cacheLocation will be added dynamically later
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [ __filename ]
      }
    },
    // we could extend this with aliases for other apostrophe modules
    // at a later date if needed
    resolveLoader: {
      extensions: [ '*', '.js', '.vue', '.json' ],
      modules: [
        // 1. Allow webpack to find loaders from core dependencies (pnpm), empty if not pnpm
        ...pnpmModulePath,
        // 2. Allow webpack to find loaders from dependencies of any project level packages (pnpm),
        // empty if not pnpm
        ...[ ...pnpmModulesResolvePaths ],
        // 3. npm related paths
        'node_modules/apostrophe/node_modules',
        'node_modules'
      ]
    },
    resolve: {
      extensions: [ '*', '.js', '.vue', '.json' ],
      alias: {
        vue$: 'vue/dist/vue.runtime.esm.js',
        // resolve apostrophe modules
        Modules: path.resolve(modulesDir)
      },
      modules: [
        'node_modules',
        // 1. Allow webpack to find imports from core dependencies (pnpm), empty if not pnpm
        ...pnpmModulePath,
        // 2. Allow webpack to find imports from dependencies of any project level packages (pnpm),
        // empty if not pnpm
        ...[ ...pnpmModulesResolvePaths ],
        // 3. npm related paths
        `${apos.npmRootDir}/node_modules/apostrophe/node_modules`,
        `${apos.npmRootDir}/node_modules`
      ],
      symlinks: false
    },
    stats: 'verbose',
    plugins: process.env.APOS_BUNDLE_ANALYZER ? [ new BundleAnalyzerPlugin() ] : []
  };

  return merge(config, ...tasks);
};
