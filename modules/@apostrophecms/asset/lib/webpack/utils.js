const fs = require('fs-extra');
const path = require('path');

module.exports = {
  checkModulesWebpackConfig(modules, t) {
    const allowedProperties = [ 'extensions', 'extensionsOptions', 'bundles' ];

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
          module: mod.__meta.name,
          properties: allowedProperties.join(', ')
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
  },

  writeBundlesImportFiles ({
    name,
    buildDir,
    mainBundleName,
    verifiedBundles,
    getImportFileOutput,
    writeImportFile
  }) {
    if (!name.includes('src')) {
      return [];
    }

    const bundlesOutputs = Object.entries(verifiedBundles)
      .map(([ bundleName, paths ]) => {
        return {
          bundleName,
          importFile: `${buildDir}/${bundleName}-import.js`,
          js: getImportFileOutput(paths.js, {
            invokeApps: true,
            enumerateImports: true,
            requireDefaultExport: true
          }),
          scss: getImportFileOutput(paths.scss, {
            enumerateImports: true,
            importSuffix: 'Stylesheet'
          })
        };
      });

    for (const output of bundlesOutputs) {
      writeImportFile({
        importFile: output.importFile,
        indexJs: output.js,
        indexSass: output.scss
      });
    }

    return bundlesOutputs.reduce((acc, { bundleName, importFile }) => {
      return {
        ...acc,
        [bundleName]: {
          import: importFile,
          dependOn: mainBundleName
        }
      };
    }, {});
  },

  // Find all symlinks in node modules.
  // This would find both `module-name` and `@company/module-name`
  // package symlinks
  findNodeModulesSymlinks(rootDir) {
    return findSymlinks(path.join(rootDir, 'node_modules'));
  }
};

async function findSymlinks(where, sub = '') {
  let result = [];
  const handle = await fs.promises.opendir(path.join(where, sub));
  let mod = await handle.read();
  while (mod) {
    if (mod.isSymbolicLink()) {
      result.push(sub + mod.name);
    } else if (!sub && mod.name.startsWith('@')) {
      const dres = await findSymlinks(where, `${mod.name}/`);
      result = [ ...result, ...dres ];
    }
    mod = await handle.read();
  }
  await handle.close();
  return result;
}

function getModulesWebpackConfigs (modulesMeta) {
  const {
    extensions, extensionsOptions, bundles
  } = modulesMeta.reduce((modulesAcc, meta) => {
    const { webpack, __meta } = meta;

    const configs = formatConfigs(__meta.chain, webpack);

    if (!configs.length) {
      return modulesAcc;
    }

    const reduce = (list, prop) => {
      return list.reduce((acc, cur) => ({
        ...acc,
        ...cur[prop] || {}
      }), {});
    };

    const extensionsOptions = configs.reduce((acc, { extensionsOptions = {} }) => {
      return [
        ...acc,
        extensionsOptions
      ];
    }, []);

    return {
      extensions: {
        ...modulesAcc.extensions,
        ...reduce(configs, 'extensions')
      },
      extensionsOptions: [
        ...modulesAcc.extensionsOptions,
        ...extensionsOptions
      ],
      bundles: {
        ...modulesAcc.bundles,
        ...reduce(configs, 'bundles')
      }
    };
  }, {
    extensions: {},
    extensionsOptions: [],
    bundles: {}
  });

  console.log('extensionsOptions ===> ', require('util').inspect(extensionsOptions, {
    colors: true,
    depth: 2
  }));

  return {
    extensions: fillExtensionsOptions(extensions, extensionsOptions),
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
      ...jsFileExists && { jsPath },
      ...scssFileExists && { scssPath }
    };
  });

  const bundlesPaths = await Promise.all(checkPathsPromises);

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

      const {
        bundles = {}, extensions = {}, extensionsOptions = {}
      } = config;

      return {
        extensions,
        extensionsOptions,
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

function fillExtensionsOptions (exts, extensionsOptions) {
  const options = formatExtensionsOptions(extensionsOptions);

  const isObject = (val) => val &&
    typeof val === 'object' && !Array.isArray(val);

  const extensions = Object.entries(exts).reduce((acc, [ name, config ]) => {
    if (isObject(config)) {
      return {
        ...acc,
        [name]: config
      };
    }

    if (typeof config !== 'function') {
      return acc;
    }

    return acc;
  }, {});

  return extensions;
}

function formatExtensionsOptions (options) {
  const obj = {};
  options.forEach((opt) => {
    Object.entries(opt).forEach(([ name, config ]) => {
      obj[name] = [
        ...obj[name] || [],
        config
      ];
    });
  });

  const formatted = options.reduce((acc, opt) => {

    const conf = Object.entries(opt).reduce((acc, cur) => {
      console.log('cur ===> ', require('util').inspect(cur, {
        colors: true,
        depth: 2
      }));
    }, {});

  }, {});

  return obj;
}
