const path = require('path');
const merge = require('webpack-merge').merge;
const scss = require('./webpack.scss');

let BundleAnalyzerPlugin;

if (process.env.APOS_BUNDLE_ANALYZER) {
  BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
}

module.exports = ({
  importFile, modulesDir, outputPath, outputFilename
}, apos) => {
  const tasks = [ scss ].map(task =>
    task(
      {
        importFile,
        modulesDir
      },
      apos
    )
  );

  const config = {
    entry: importFile,
    mode: process.env.NODE_ENV || 'development',
    optimization: { minimize: false },
    devtool: 'eval-source-map',
    output: {
      path: outputPath,
      filename: outputFilename
    },
    // we could extend this with aliases for other apostrophe modules
    // at a later date if needed
    resolveLoader: {
      extensions: [ '*', '.js', '.json' ],
      modules: [ 'node_modules/apostrophe/node_modules', 'node_modules' ]
    },
    resolve: {
      extensions: [ '*', '.js', '.json' ],
      alias: {
        // resolve apostrophe modules
        Modules: path.resolve(modulesDir)
      },
      modules: [
        `${apos.npmRootDir}/node_modules/apostrophe/node_modules`,
        `${apos.npmRootDir}/node_modules`
      ]
    },
    stats: 'verbose',
    plugins: process.env.APOS_BUNDLE_ANALYZER ? [ new BundleAnalyzerPlugin() ] : []
  };

  return merge(config, ...tasks);
};
