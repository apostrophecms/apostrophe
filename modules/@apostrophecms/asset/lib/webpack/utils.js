const fs = require('fs-extra');
const { merge: webpackMerge } = require('webpack-merge');

module.exports = {
  checkModulesWebpackConfig(modules, t) {
    const allowedProperties = [ 'extensions', 'bundles' ];

    for (const mod of Object.values(modules)) {
      const webpackConfig = mod.__meta.webpack[mod.__meta.name];

      if (!webpackConfig) {
        continue;
      }

      if (
        typeof webpackConfig !== 'object' ||
        webpackConfig === null ||
        Array.isArray(webpackConfig) ||
        Object.keys(webpackConfig).some((prop) => !allowedProperties.includes(prop))
      ) {
        const error = t('apostrophe:assetWebpackConfigWarning', {
          module: mod.__meta.name
        });

        throw new Error(error);
      }
    }
  },

  getModulesWebpackConfigs (modules, instantiatedModules) {
    const { extensions, bundles } = instantiatedModules.reduce((acc, moduleName) => {
      const {
        webpack, chain
      } = modules[moduleName].__meta;

      const configs = getConfigInChain(chain, webpack);

      if (!configs.length) {
        return acc;
      }

      const moduleBundles = configs.reduce((acc, conf) => {
        return {
          ...acc,
          ...conf.bundles
        };
      }, {});

      return {
        extensions: {
          ...acc.extensions,
          ...configs.reduce((acc, config) => ({
            ...acc,
            ...config.extensions
          }), {})
        },
        bundles: {
          ...acc.bundles,
          ...moduleBundles
        }
      };
    }, {
      extensions: {},
      bundles: {}
    });

    return {
      extensions,
      bundles: flattenBundles(bundles)
    };
  },

  async verifyBundlesEntryPoints (bundles) {
    const checkPathsPromises = bundles.map(async ({ bundleName, modulePath }) => {
      const jsPath = `${modulePath}/ui/src/${bundleName}.js`;
      const scssPath = `${modulePath}/ui/src/${bundleName}.scss`;

      const jsFileExists = await fs.pathExists(jsPath);
      const scssFileExists = await fs.pathExists(scssPath);

      return {
        bundleName,
        paths: [
          ...jsFileExists ? [ jsPath ] : [],
          ...scssFileExists ? [ scssPath ] : []
        ]
      };
    });

    const bundlesPaths = (await Promise.all(checkPathsPromises))
      .filter((bundle) => bundle.paths.length);

    return bundlesPaths;
  },

  mergeWebpackConfigs (modules, config) {
    const extensions = Object.values(modules).reduce((acc, mod) => {
      const { webpack } = mod.__meta;

      const inheritedExtensions = Object.values(webpack)
        .filter((config) => config && config.extensions)
        .map((config) => config.extensions);

      if (!inheritedExtensions.length) {
        return acc;
      }

      return {
        ...acc,
        ...inheritedExtensions.reduce((acc, ext) => ({
          ...acc,
          ...ext
        }), {})
      };
    }, {});

    return webpackMerge(config, ...Object.values(extensions));
  }
};

function getConfigInChain (chain, webpackConfigs) {
  return Object.entries(webpackConfigs)
    .map(([ name, conf ], i) => {
      if (!conf) {
        return conf;
      }

      const { bundles, extensions } = conf;

      return {
        extensions,
        bundles: {
          [name]: {
            bundleNames: Object.keys(bundles),
            modulePath: chain[i].dirname
          }
        }
      };
    }).filter((conf) => conf);
}

function flattenBundles (bundles) {
  return Object.values(bundles)
    .reduce((acc, { bundleNames, modulePath }) => {
      return [
        ...acc,
        ...bundleNames.map((bundleName) => ({
          bundleName,
          modulePath
        }))
      ];
    }, []);
}
