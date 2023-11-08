const path = require('path');
const merge = require('webpack-merge').merge;
const scssTask = require('./webpack.scss');
const srcBuildNames = [ 'src-build', 'src-es5-build' ];

module.exports = ({
  importFile,
  modulesDir,
  outputPath,
  outputFilename,
  // it's a Set, not an array
  pnpmModulesResolvePaths,
  bundles = {},
  es5,
  es5TaskFn
}, apos) => {
  const mainBundleName = outputFilename.replace('.js', '');
  const taskFns = [ scssTask, ...(es5 ? [ es5TaskFn ] : []) ];

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
  const pnpmModulePath = apos.isPnpm ? [ path.join(apos.selfDir, '../') ] : [];
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
      modules: [
        'node_modules',
        // 1. Allow webpack to find loaders from dependencies of any project level packages (pnpm),
        // empty if not pnpm
        ...[ ...pnpmModulesResolvePaths ],
        // 2. Allow webpack to find loaders from core dependencies (pnpm), empty if not pnpm
        ...pnpmModulePath,
        // 3. npm related paths
        'node_modules/apostrophe/node_modules'
      ]
    },
    resolve: {
      extensions: [ '*', '.js' ],
      alias: {
        // resolve apostrophe modules
        Modules: path.resolve(modulesDir)
      },
      modules: [
        'node_modules',
        // 1. Allow webpack to find imports from dependencies of any project level packages (pnpm),
        // empty if not pnpm
        ...[ ...pnpmModulesResolvePaths ],
        // 2. Allow webpack to find imports from core dependencies (pnpm), empty if not pnpm
        ...pnpmModulePath,
        // 3. npm related paths
        `${apos.npmRootDir}/node_modules`,
        // Make sure core-js and regenerator-runtime can always be found, even
        // if npm didn't hoist them
        `${apos.npmRootDir}/node_modules/apostrophe/node_modules`
      ],
      symlinks: false
    },
    stats: 'verbose',
    plugins: []
  };

  if (es5) {
    config.output.chunkFormat = 'array-push';
  }

  return merge(config, ...tasks);
};
