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
    optimization: {
      minimize: process.env.NODE_ENV === 'production'
    },
    devtool: 'eval-source-map',
    output: {
      path: outputPath,
      filename: outputFilename
    },
    resolveLoader: {
      extensions: [ '*', '.js' ],
      modules: [ 'node_modules' ]
    },
    resolve: {
      extensions: [ '*', '.js' ],
      alias: {
        // resolve apostrophe modules
        Modules: path.resolve(modulesDir)
      },
      modules: [
        `${apos.npmRootDir}/node_modules`
      ]
    },
    stats: 'verbose',
    plugins: process.env.APOS_BUNDLE_ANALYZER ? [ new BundleAnalyzerPlugin() ] : []
  };

  return merge(config, ...tasks);
};
