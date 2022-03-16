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

  getModulesWebpackConfigs (modules) {
    const { extensions, bundles } = Object.values(modules).reduce((acc, mod) => {
      const { name, webpack } = mod.__meta;

      if (
        !webpack[name] ||
        (!webpack[name].extensions && !webpack[name].bundles)
      ) {
        return acc;
      }

      const bundlesNames = Object.keys(webpack[name].bundles) || []

      return {
        extensions: {
          ...acc.extensions,
          ...webpack[name].extensions || {}
        },
        bundles: [
          ...acc.bundles,
          ...webpack[name].bundles ? [{
            [mod.__meta.name]: {
              bundleNames: Object.keys(webpack[name].bundles),
              modulePath: mod.__meta.chain[mod.__meta.chain.length - 1].dirname
            }
            }] : []
        ]
      };
    }, {
      extensions: {},
      bundles: []
    });

    return {
      extensions,
      bundles
    };
  },

  async verifyBundlesEntryPoints (bundles) {
    const promises = Object.entries(bundles)
      .map(async ([ moduleName, { bundleNames, modulePath } ]) => {
        // for (const name of bundleNames) {
        //   const entryPointExist = await fs.pathExists(`${modulePath}/ui/src/${name}.js`);

        //   console.log('entryPointExist ===> ', entryPointExist);
        // }

        await Promise.all(bundleNames.map((n) => {
          const entryPointExist = await fs.pathExists(`${modulePath}/ui/src/${name}.js`);
        }))
      });

    async function checkEachBundleName (bundles, moduleName) {
      const promises = bundleNames.map((n) => {
        const jsPath = `${modulePath}/ui/src/${n}.js`
        const scssPath = `${modulePath}/ui/src/${n}.scss`

        const jsEntryPointExists = await fs.pathExists(jsPath);
        const scssEntryPointExists = await fs.pathExists(scssPath);

      })


      await Promise.all()
    }

    const res = Promise.all(promises);

    // for (const [ moduleName, { bundleNames, modulePath } ] of Object.entries(bundles)) {
    //   console.log('modulePath ===> ', modulePath);

    //   for (const name of bundleNames) {
    //     const entryPointExist = await fs.pathExists(`${modulePath}/ui/src/${name}.js`);

    //     console.log('entryPointExist ===> ', entryPointExist);
    //   }
    // }
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
