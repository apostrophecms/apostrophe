const path = require('path');
const merge = require('webpack-merge').merge;
const scssTask = require('./webpack.scss');
const es5Task = require('./webpack.es5');
const srcBuildNames = [ 'src-build', 'src-es5-build' ];

let BundleAnalyzerPlugin;

if (process.env.APOS_BUNDLE_ANALYZER) {
  BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
}

module.exports = ({
  importFile, modulesDir, outputPath, outputFilename, bundles = {}, es5
}, apos) => {
  const mainBundleName = outputFilename.replace('.js', '');
  const taskFns = [ scssTask ];

  if (es5) {
    taskFns.push(es5Task);
  }
  const tasks = taskFns.map(task =>
    task(
      {
        importFile,
        modulesDir
      },
      apos,
      srcBuildNames
    )
  );

  const moduleName = es5 ? 'nomodule' : 'module';
  const config = {
    entry: {
      [mainBundleName]: importFile,
      ...bundles
    },
    target: es5 ? [ 'web', 'es5' ] : 'web',
    mode: process.env.NODE_ENV || 'development',
    optimization: {
      minimize: process.env.NODE_ENV === 'production'
    },
    devtool: 'source-map',
    output: {
      path: outputPath,
      filename: ({ chunk }) => {
        return srcBuildNames.includes(chunk.name)
          ? '[name].js'
          : `[name]-${moduleName}-bundle.js`;
      }
    },
    // cacheLocation will be added dynamically later
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [ __filename ]
      }
    },
    resolveLoader: {
      extensions: [ '*', '.js' ],
      // Make sure css-loader and postcss-loader can always be found, even
      // if npm didn't hoist them
      modules: [ 'node_modules', 'node_modules/apostrophe/node_modules' ]
    },
    resolve: {
      extensions: [ '*', '.js' ],
      alias: {
        // resolve apostrophe modules
        Modules: path.resolve(modulesDir)
      },
      modules: [
        'node_modules',
        `${apos.npmRootDir}/node_modules`,
        // Make sure core-js and regenerator-runtime can always be found, even
        // if npm didn't hoist them
        `${apos.npmRootDir}/node_modules/apostrophe/node_modules`
      ],
      symlinks: false
    },
    stats: 'verbose',
    plugins: process.env.APOS_BUNDLE_ANALYZER ? [ new BundleAnalyzerPlugin() ] : []
  };

  if (es5) {
    config.output.chunkFormat = 'array-push';
  }

  return merge(config, ...tasks);
};
