const {
  formatRebundleConfig,
  verifyBundlesEntryPoints,
  formatExtensionsOptions,
  fillExtensionsOptions,
  flattenBundles,
  fillExtraBundles
} = require('../webpack/utils');

module.exports = {
  // The names of the modules whose UI sources no build includes: those
  // whose `build.enable` is false, or a function returning false for the
  // module's options as configured. The last level of the module that sets
  // it decides. Read before any module is created, so it depends on
  // configuration only (see moog's `getMetadata`). The module works as
  // usual on the server; project level modules improving it bring no UI
  // either. `modulesMeta` is the metadata of the registered modules.
  getInactiveModules(modulesMeta) {
    const inactive = new Set();
    for (const {
      build, options, __meta
    } of modulesMeta) {
      const enable = Object.values(build)
        .findLast(level => level?.enable !== undefined)
        ?.enable ?? true;
      const isEnabled = (typeof enable === 'function')
        ? enable(options)
        : enable;
      if (!isEnabled) {
        inactive.add(__meta.name);
      }
    }
    return inactive;
  },

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
  // The new `build` format (`enable`, true by default, is not a build
  // vendor: see `getInactiveModules()`):
  // {
  //   build: {
  //     enable: true | false | (options) => Boolean,
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
  // `modulesMeta` is the metadata of the modules when the caller has it
  // already, otherwise it is read with `getMetadata` for each of
  // `modulesToInstantiate`. `isInactive(name)` tells the module levels
  // whose bundles are left out (see `getInactiveModules()`).
  async getBuildExtensions({
    modulesMeta,
    getMetadata,
    modulesToInstantiate,
    rebundleModulesConfig = {},
    isInactive = () => false
  }) {
    if (!modulesMeta) {
      modulesMeta = [];
      for (const name of modulesToInstantiate) {
        modulesMeta.push(await getMetadata(name));
      }
    }

    const rebundleModules = formatRebundleConfig(rebundleModulesConfig);

    const configsPerAlias = getModulesBuildConfigs(
      modulesMeta,
      rebundleModules,
      isInactive
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

function getModulesBuildConfigs(modulesMeta, rebundleModules, isInactive) {
  const result = {};

  for (const meta of modulesMeta) {
    const { build, __meta } = meta;
    const configsPerAlias = formatBuildConfigs({
      chain: __meta.chain,
      buildConfigs: build,
      rebundleModules,
      isInactive
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
  chain, buildConfigs, rebundleModules, isInactive, result = {}
}) {
  Object.entries(buildConfigs)
    .forEach(([ name, options ], i) => {

      if (!options) {
        return null;
      }

      for (const [ alias, config ] of Object.entries(options)) {
        // Whether the module's UI is built at all, not a build vendor (see
        // `getInactiveModules()`)
        if (alias === 'enable') {
          continue;
        }
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
        // An inactive module's bundles are its UI sources: none is built
        const bundleNames = isInactive(chain[i].name) ? [] : Object.keys(bundles);

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
