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
