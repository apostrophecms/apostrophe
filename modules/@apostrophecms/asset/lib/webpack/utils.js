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
      const { name, webpack } = mod.__meta;

      if (
        !webpack[name] ||
        !webpack[name].extensions
      ) {
        return acc;
      }

      return {
        ...acc,
        ...webpack[name].extensions
      };
    }, {});

    return webpackMerge(config, ...Object.values(extensions));
  }
};
