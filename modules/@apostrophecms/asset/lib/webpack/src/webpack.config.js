const path = require('path');
const merge = require('webpack-merge').merge;
const scssTask = require('./webpack.scss');
const es5Task = require('./webpack.es5');

let BundleAnalyzerPlugin;

if (process.env.APOS_BUNDLE_ANALYZER) {
  BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
}

module.exports = ({
  importFile, modulesDir, outputPath, outputFilename, es5
}, apos) => {
  const taskFns = [ scssTask ];
  if (es5) {
    taskFns.push(es5Task);
  }
  const tasks = taskFns.map(task =>
    task(
      {
        importFile,
        modulesDir,
        outputFilename
      },
      apos
    )
  );

  let config = {
    entry: importFile,
    target: es5 ? 'es5' : 'web',
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
        `${apos.npmRootDir}/node_modules`,
        // Make sure core-js and regenerator-runtime can always be found, even
        // if npm didn't hoist them
        `${apos.npmRootDir}/node_modules/apostrophe/node_modules`
      ]
    },
    stats: 'verbose',
    plugins: process.env.APOS_BUNDLE_ANALYZER ? [ new BundleAnalyzerPlugin() ] : []
  };

  config = merge(config, ...tasks);
  return config;
};
