const fs = require('fs-extra');

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

      if (webpackConfig && webpackConfig.bundles) {
        const bundles = Object.values(webpackConfig.bundles);

        bundles.forEach(bundle => {
          const bundleProps = Object.keys(bundle);
          if (
            bundleProps.length > 1 ||
            (bundleProps.length === 1 && !bundle.templates) ||
            (bundle.templates && !Array.isArray(bundle.templates))
          ) {
            const error = t('apostrophe:assetWebpackBundlesWarning', {
              module: mod.__meta.name
            });

            throw new Error(error);
          }
        });
      }
    }
  },

  async getWebpackExtensions ({
    getMetadata, modulesToInstantiate
  }) {
    const modulesMeta = modulesToInstantiate
      .map((name) => getMetadata(name));

    const { extensions, foundBundles } = getModulesWebpackConfigs(
      modulesMeta
    );

    const verifiedBundles = await verifyBundlesEntryPoints(foundBundles);

    return {
      extensions,
      verifiedBundles
    };
  },

  fillExtraBundles (verifiedBundles = {}) {
    return Object.entries(verifiedBundles).reduce((acc, [ bundleName, { js, scss } ]) => {
      return {
        js: [
          ...acc.js,
          ...(js.length && !acc.js.includes(bundleName)) ? [ bundleName ] : []
        ],
        css: [
          ...acc.css,
          ...(scss.length && !acc.css.includes(bundleName)) ? [ bundleName ] : []
        ]
      };
    }, {
      js: [],
      css: []
    });
  },

  getBundlesNames (bundles, es5 = false) {
    return Object.entries(bundles).reduce((acc, [ ext, bundlesNames ]) => {
      const nameExtension = ext === 'css'
        ? '-bundle'
        : '-module-bundle';

      const es5Bundles = es5 && ext === 'js'
        ? bundlesNames.map((name) => `${name}-nomodule-bundle.${ext}`)
        : [];

      return [
        ...acc,
        ...bundlesNames.map((name) => `${name}${nameExtension}.${ext}`),
        ...es5Bundles
      ];
    }, []);
  }
};

function getModulesWebpackConfigs (modulesMeta) {
  const { extensions, bundles } = modulesMeta.reduce((acc, meta) => {
    const { webpack, __meta } = meta;

    const configs = formatConfigs(__meta.chain, webpack);

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
    foundBundles: flattenBundles(bundles)
  };
};

async function verifyBundlesEntryPoints (bundles) {
  const checkPathsPromises = bundles.map(async ({ bundleName, modulePath }) => {
    const jsPath = `${modulePath}/ui/src/${bundleName}.js`;
    const scssPath = `${modulePath}/ui/src/${bundleName}.scss`;

    const jsFileExists = await fs.pathExists(jsPath);
    const scssFileExists = await fs.pathExists(scssPath);

    return {
      bundleName,
      ...jsFileExists && { jsPath: jsPath },
      ...scssFileExists && { scssPath: scssPath }
    };
  });

  const bundlesPaths = (await Promise.all(checkPathsPromises));

  const packedFilesByBundle = bundlesPaths.reduce((acc, {
    bundleName, jsPath, scssPath
  }) => {
    if (!jsPath && !scssPath) {
      return acc;
    }

    return {
      ...acc,
      [bundleName]: {
        js: [
          ...acc[bundleName] ? acc[bundleName].js : [],
          ...jsPath ? [ jsPath ] : []
        ],
        scss: [
          ...acc[bundleName] ? acc[bundleName].scss : [],
          ...scssPath ? [ scssPath ] : []
        ]
      }
    };
  }, {});

  return packedFilesByBundle;
};

function formatConfigs (chain, webpackConfigs) {
  return Object.entries(webpackConfigs)
    .map(([ name, config ], i) => {

      if (!config) {
        return null;
      }

      const { bundles = {}, extensions = {} } = config;

      return {
        extensions,
        bundles: {
          [name]: {
            bundleNames: Object.keys(bundles),
            modulePath: chain[i].dirname
          }
        }
      };
    }).filter((config) => config);
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
