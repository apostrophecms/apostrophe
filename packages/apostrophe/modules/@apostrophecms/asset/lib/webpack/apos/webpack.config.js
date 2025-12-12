const path = require('path');
const merge = require('webpack-merge').merge;
const scss = require('./webpack.scss');
const vue = require('./webpack.vue');
const js = require('./webpack.js');

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

  const mode = process.env.NODE_ENV || 'development';
  const pnpmModulePath = apos.isPnpm ? [ path.join(apos.selfDir, '../') ] : [];
  const dev = (mode === 'development');
  const csp = apos.modules['@apostrophecms/security-headers'];
  const config = {
    performance: {
      hints: false
    },
    entry: importFile,
    // Ensure that the correct version of vue-loader is found
    context: __dirname,
    mode,
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
      extensions: [ '.*', '.js', '.vue', '.json' ],
      modules: [
        // 1. Allow webpack to find loaders from core dependencies (pnpm),
        // empty if not pnpm
        ...pnpmModulePath,
        // 2. Allow webpack to find loaders from dependencies of any project
        // level packages (pnpm), empty if not pnpm
        ...[ ...pnpmModulesResolvePaths ],
        // 3. npm related paths
        'node_modules/apostrophe/node_modules',
        'node_modules'
      ]
    },
    resolve: {
      extensions: [ '.*', '.js', '.vue', '.json' ],
      alias: {
        vue$: getVueAlias(mode, apos),
        // resolve apostrophe modules
        Modules: path.resolve(modulesDir)
      },
      modules: [
        'node_modules',
        // 1. Allow webpack to find imports from core dependencies (pnpm),
        // empty if not pnpm
        ...pnpmModulePath,
        // 2. Allow webpack to find imports from dependencies of any project
        // level packages (pnpm), empty if not pnpm
        ...[ ...pnpmModulesResolvePaths ],
        // 3. npm related paths
        `${apos.npmRootDir}/node_modules/apostrophe/node_modules`,
        `${apos.npmRootDir}/node_modules`
      ],
      symlinks: false
    },
    stats: 'verbose'
  };

  return merge(config, ...tasks);
};

function getVueAlias(mode, apos) {
  if (mode !== 'development') {
    return '@vue/runtime-dom';
  }

  const candidateRoots = [
    apos?.rootDir,
    apos?.npmRootDir,
    path.resolve(__dirname, '../../../../../../')
  ].filter(Boolean);

  try {
    return require.resolve('@vue/runtime-dom', { paths: candidateRoots });
  } catch (err) {
    // Fall back to the module name so webpack can still try the default resolver.
    return '@vue/runtime-dom';
  }
}
