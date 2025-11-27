const {
  formatRebundleConfig,
  verifyBundlesEntryPoints,
  formatExtensionsOptions,
  fillExtensionsOptions,
  flattenBundles,
  fillExtraBundles
} = require('../webpack/utils');

module.exports = {
  // Walk through the modules, detect `build` property and
  // format it to configuration per build alias (vendor).
  // The format is the same as the legacy `webpack` configuration
  // but the result is stored per alias.
  // The legacy format in some module:
  // {
  //   webpack: {
  //     bundles: {
  //       'bundle-name': {}
  //     }
  //   }
  // }
  // The new `build` format:
  // {
  //   build: {
  //     webpack: {
  //       bundles: {
  //         'bundle-name': {}
  //       }
  //     }
  //     vite: {
  //       bundles: {
  //         'bundle-name': {}
  //       }
  //     }
  //   }
  // }
  // The return result is an object with the following structure:
  // {
  //   vite: {
  //     extensions: {...},
  //     extensionOptions: {...},
  //     verifiedBundles: {...},
  //     rebundleModules: [...]
  //   },
  //   webpack: {
  //     extensions: {...},
  //     extensionOptions: {...},
  //     verifiedBundles: {...},
  //     rebundleModules: [...]
  //   }
  // }
  async getBuildExtensions({
    getMetadata, modulesToInstantiate, rebundleModulesConfig = {}
  }) {
    const modulesMeta = [];

    for (const name of modulesToInstantiate) {
      modulesMeta.push(await getMetadata(name));
    }

    const rebundleModules = formatRebundleConfig(rebundleModulesConfig);

    const configsPerAlias = getModulesBuildConfigs(
      modulesMeta,
      rebundleModules
    );

    const configs = {};

    for (const [ alias, config ] of Object.entries(configsPerAlias)) {
      const {
        extensions, extensionOptions, foundBundles
      } = config;
      const verifiedBundles = await verifyBundlesEntryPoints(foundBundles);
      configs[alias] = {
        extensions,
        extensionOptions,
        verifiedBundles,
        rebundleModules
      };
    }

    return configs;
  },
  fillExtraBundles

};

function getModulesBuildConfigs(modulesMeta, rebundleModules) {
  const result = {};

  for (const meta of modulesMeta) {
    const { build, __meta } = meta;
    const configsPerAlias = formatBuildConfigs({
      chain: __meta.chain,
      buildConfigs: build,
      rebundleModules
    });

    for (const [ alias, configs ] of Object.entries(configsPerAlias)) {
      if (!configs.length) {
        continue;
      }
      if (!result[alias]) {
        result[alias] = {
          extensions: {},
          extensionOptions: [],
          bundles: {}
        };
      }

      const extensionOptions = configs.reduce((acc, { extensionOptions = {} }) => {
        return [
          ...acc,
          extensionOptions
        ];
      }, []);

      result[alias].extensions = Object.assign(
        result[alias].extensions,
        reduce(configs, 'extensions')
      );
      result[alias].extensionOptions.push(...extensionOptions);
      result[alias].bundles = Object.assign(
        result[alias].bundles,
        reduce(configs, 'bundles')
      );
    }
  }

  return Object.entries(result).reduce((acc, [ alias, config ]) => {
    const {
      extensions, extensionOptions, bundles
    } = config;
    const formattedOptions = formatExtensionsOptions(extensionOptions);
    const { exts, options } = fillExtensionsOptions(extensions, formattedOptions);
    acc[alias] = {
      extensions: exts,
      extensionOptions: options,
      foundBundles: flattenBundles(bundles)
    };
    return acc;
  }, {});

  function reduce(list, prop) {
    return list.reduce((acc, cur) => {
      Object.assign(acc, cur[prop] || {});
      return acc;
    }, {});
  }
};

function formatBuildConfigs({
  chain, buildConfigs, rebundleModules, result = {}
}) {
  Object.entries(buildConfigs)
    .forEach(([ name, options ], i) => {

      if (!options) {
        return null;
      }

      for (const [ alias, config ] of Object.entries(options)) {
        if (!Object.keys(config).length) {
          continue;
        }
        if (!result[alias]) {
          result[alias] = [];
        }

        const {
          bundles = {},
          extensions = {},
          extensionOptions = {}
        } = config;
        const bundleNames = Object.keys(bundles);

        // Remapping only for the explicitly defined by the module bundle
        // configurations
        const bundleRemapping = rebundleModules
          .filter(entry => entry.name === chain[i].name);

        result[alias].push({
          name: chain[i].name,
          extensions,
          extensionOptions,
          bundles: {
            [name]: {
              bundleNames,
              modulePath: chain[i].dirname,
              bundleRemapping
            }
          }
        });
      }
    });
  return result;
}
