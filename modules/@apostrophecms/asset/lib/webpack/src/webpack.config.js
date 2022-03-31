const path = require('path');
const merge = require('webpack-merge').merge;
const scssTask = require('./webpack.scss');
const es5Task = require('./webpack.es5');

let BundleAnalyzerPlugin;

if (process.env.APOS_BUNDLE_ANALYZER) {
  BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
}

module.exports = ({
  importFile, modulesDir, outputPath, outputFilename, bundles = [], es5
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
      apos
    )
  );

  const config = {
    entry: {
      [mainBundleName]: importFile,
      ...formatBundles(bundles, mainBundleName)
    },
    target: es5 ? 'es5' : 'web',
    mode: process.env.NODE_ENV || 'development',
    optimization: {
      minimize: process.env.NODE_ENV === 'production'
    },
    devtool: 'source-map',
    output: {
      path: outputPath,
      filename: '[name].js'
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

  return merge(config, ...tasks);
};

function formatBundles (bundles, mainBundleName) {
  return bundles.reduce((acc, { bundleName, paths }) => {
    const jsPaths = paths.filter((p) => p.endsWith('.js'));
    const scssPaths = paths.filter((p) => p.endsWith('.scss'));

    return {
      ...acc,
      ...jsPaths.length && {
        [`${bundleName}-module-bundle`]: {
          import: jsPaths,
          dependOn: mainBundleName
        }
      },
      ...scssPaths.length && {
        [`${bundleName}-bundle`]: {
          import: scssPaths,
          dependOn: mainBundleName
        }
      }
    };
  }, {});
}
