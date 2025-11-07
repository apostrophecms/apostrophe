const fs = require('fs-extra');
const path = require('path');

module.exports = {
  checkModulesWebpackConfig(modules, t) {
    const allowedProperties = [ 'extensions', 'extensionOptions', 'bundles' ];

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

  formatRebundleConfig,
  verifyRebundleConfig,
  verifyBundlesEntryPoints,
  formatExtensionsOptions,
  fillExtensionsOptions,
  flattenBundles,

  transformRebundledFor,

  async getWebpackExtensions ({
    getMetadata, modulesToInstantiate, rebundleModulesConfig = {}
  }) {
    const modulesMeta = [];
    // NOTE: this is important, it must be sequential due to getMetadata side
    // effects
    for (const name of modulesToInstantiate) {
      modulesMeta.push(await getMetadata(name));
    }

    const rebundleModules = formatRebundleConfig(rebundleModulesConfig);

    const {
      extensions, extensionOptions, foundBundles
    } = getModulesWebpackConfigs(
      modulesMeta,
      rebundleModules
    );

    const verifiedBundles = await verifyBundlesEntryPoints(foundBundles);

    return {
      extensions,
      extensionOptions,
      verifiedBundles,
      rebundleModules
    };
  },

  fillExtraBundles (verifiedBundles = {}) {

    const res = Object.entries(verifiedBundles).reduce(
      (acc, [ bundleName, entry ]) => {
        const {
          js, scss, main
        } = entry;
        if (main) {
          return acc;
        }
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
    return res;
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

function getModulesWebpackConfigs (modulesMeta, rebundleModules) {
  const {
    extensions, extensionOptions, bundles
  } = modulesMeta.reduce((modulesAcc, meta) => {
    const { webpack, __meta } = meta;

    const configs = formatConfigs(
      __meta.chain,
      webpack,
      rebundleModules
    );

    if (!configs.length) {
      return modulesAcc;
    }

    const reduce = (list, prop) => {
      return list.reduce((acc, cur) => ({
        ...acc,
        ...cur[prop] || {}
      }), {});
    };

    const extensionOptions = configs.reduce((acc, { extensionOptions = {} }) => {
      return [
        ...acc,
        extensionOptions
      ];
    }, []);

    return {
      extensions: {
        ...modulesAcc.extensions,
        ...reduce(configs, 'extensions')
      },
      extensionOptions: [
        ...modulesAcc.extensionOptions,
        ...extensionOptions
      ],
      bundles: {
        ...modulesAcc.bundles,
        ...reduce(configs, 'bundles')
      }
    };
  }, {
    extensions: {},
    extensionOptions: [],
    bundles: {}
  });

  const formattedOptions = formatExtensionsOptions(extensionOptions);

  const { exts, options } = fillExtensionsOptions(extensions, formattedOptions);

  return {
    extensions: exts,
    extensionOptions: options,
    foundBundles: flattenBundles(bundles)
  };
};

async function verifyBundlesEntryPoints (bundles) {
  const checkPathsPromises = bundles.map(async ({
    bundleName, modulePath, bundleRemapping
  }) => {
    const jsPath = `${modulePath}/ui/src/${bundleName}.js`;
    const scssPath = `${modulePath}/ui/src/${bundleName}.scss`;
    const jsIndexPath = `${modulePath}/ui/src/index.js`;
    const scssIndexPath = `${modulePath}/ui/src/index.scss`;
    let main = false;
    let withIndex;

    const jsFileExists = await fs.pathExists(jsPath);
    const scssFileExists = await fs.pathExists(scssPath);

    for (const remapping of bundleRemapping) {
      main = remapping.main;
      // - catch all to "main" or new bundle name,
      // already verified it's unique for the given module
      if (!remapping.source) {
        // Bundle name for "main" "doesn't matter - it will be ignored and
        // never built, we want to achieve a free from collision name. What
        // matters is main = true. Target is 'main' by convention:
        // `main.bundleName`
        bundleName = `${remapping.target}.${bundleName}`;
        if (!remapping.main) {
          // move "ui/src/index.*" to the bundle,
          // verify existence later, better performance
          withIndex = {
            jsPath: jsIndexPath,
            scssPath: scssIndexPath
          };
          bundleName = remapping.target;
        }

        break;
      }
      // - not a catch-all statement from this point on
      // - "main" for a concrete bunbdle
      if (remapping.main && remapping.source === bundleName) {
        bundleName = `${remapping.target}.${bundleName}`;
        break;
      }
      // - not "main", concrete bundle remapping
      if (remapping.source === bundleName) {
        bundleName = remapping.target;
        break;
      }
    }

    return {
      bundleName,
      modulePath,
      main,
      withIndex,
      ...jsFileExists && { jsPath },
      ...scssFileExists && { scssPath }
    };
  });

  const bundlesPaths = await Promise.all(checkPathsPromises);

  // Verify and squash withIndex data
  const seen = {};
  const bundlesPathsWithIndex = [];
  for (const entry of bundlesPaths) {
    if (!entry.withIndex) {
      bundlesPathsWithIndex.push(entry);
      continue;
    }
    if (seen[entry.bundleName]) {
      delete entry.withIndex;
      bundlesPathsWithIndex.push(entry);
      continue;
    }
    seen[entry.bundleName] = true;
    const { jsPath, scssPath } = entry.withIndex;
    const jsFileExists = await fs.pathExists(jsPath);
    const scssFileExists = await fs.pathExists(scssPath);
    if (!jsFileExists && !scssFileExists) {
      delete entry.withIndex;
      bundlesPathsWithIndex.push(entry);
      continue;
    }
    bundlesPathsWithIndex.push({
      ...entry,
      withIndex: {
        ...jsFileExists && { jsPath },
        ...scssFileExists && { scssPath }
      }
    });
  }

  const packedFilesByBundle = bundlesPathsWithIndex.reduce((acc, {
    bundleName, modulePath, jsPath, scssPath, main, withIndex
  }) => {
    if (!jsPath && !scssPath) {
      return acc;
    }

    return {
      ...acc,
      [bundleName]: {
        main,
        // Boolean indicating if the "main" index.js is included
        // caused by a remapping. It's not yet used anywhere but
        // it's an useful information that we keep.
        withIndex: !!withIndex || acc[bundleName]?.withIndex || false,
        modulePath,
        js: [
          ...withIndex?.jsPath ? [ withIndex?.jsPath ] : [],
          ...acc[bundleName] ? acc[bundleName].js : [],
          ...jsPath ? [ jsPath ] : []
        ],
        scss: [
          ...withIndex?.scssPath ? [ withIndex?.scssPath ] : [],
          ...acc[bundleName] ? acc[bundleName].scss : [],
          ...scssPath ? [ scssPath ] : []
        ]
      }
    };
  }, {});

  return packedFilesByBundle;
};

// Normalize config:
// - from { moduleName: 'main' }
//    to [{ main: true, name: 'moduleName', target: 'main' }]
// - from { moduleName: bundleName }
//    to [{ main: false, name: 'moduleName', target: bundleName }]
// - from { 'moduleName:sourceBundle': 'main' }
// to [{ main: true, name: 'moduleName', source: 'sourceBundle', target: 'main'
// }] - from { 'moduleName:sourceBundle': targetBundle } to [{ main: false,
// name: 'moduleName', source: 'sourceBundle', target: targetBundle }]
function formatRebundleConfig(mappingConfig = {}) {
  const result = Object.keys(mappingConfig).reduce((transformed, key) => {
    const main = mappingConfig[key] === 'main';
    const [ moduleName, sourceBundle ] = key.split(':');
    return [
      ...transformed,
      {
        name: moduleName,
        source: sourceBundle,
        target: mappingConfig[key],
        main
      }
    ];
  }, []);
  // Better panic than sorry!
  verifyRebundleConfig(result);
  return result;
}

// This function is used to detect re-bundled and moved to the main build
// bundles. It returns filtered configuration containing the proper bundle
// names. See usage in `template/lib/bundlesLoader.js` and
// `widget-type/index.js`. Expected arguments: - moduleName: the module owning
// the bundleConfig - bundleConfig: the bundle configuration ({ bundles: {...}
// }) - rebundleConfigs: the normalized output of
// `formatRebundleConfig(asset.options.rebundleModules)`
function transformRebundledFor(moduleName, bundleConfigs, rebundleConfigs) {
  const rebundle = rebundleConfigs
    .filter(entry => entry.name === moduleName);
  let result = { ...bundleConfigs };

  for (const entry of rebundle) {
    // 1. CatchAll to "main", already bundled in the main build - skip.
    if (!entry.source && entry.main) {
      result = {};
      break;
    }
    // 2. CatchAll to a new bundle name, preserve merged options.
    if (!entry.source && !entry.main) {
      const options = Object.values(bundleConfigs)
        .reduce((all, opts) => ({
          ...all,
          ...opts
        }), {});
      result = { [entry.target]: options };
      break;
    }
    // 3. Rename a single bundle.
    if (entry.source) {
      // 3.1. ... but it's sent to the main build
      if (entry.main) {
        delete result[entry.source];
        continue;
      }
      // 3.2. rename it, preserve the options
      if (bundleConfigs[entry.source]) {
        result[entry.target] = { ...bundleConfigs[entry.source] };
        delete result[entry.source];
      }
    }
  }

  return result;
}

// Expects formatted by formatRebundleConfig() `asset.options.rebundleModules`
function verifyRebundleConfig(config = []) {
  const targeted = [];
  const catchAllModules = {};
  for (const entry of config) {
    if (!entry.source) {
      catchAllModules[entry.name] = `${entry.name}: ${entry.target}`;
    } else {
      targeted.push(entry);
    }
  }
  for (const entry of targeted) {
    if (catchAllModules[entry.name]) {
      const conflicting = `${entry.name}${entry.source ? `:${entry.source}` : ''}: ${entry.target}`;
      throw new Error(
        'Invalid apos.asset.options.rebundleModules: ' +
        `"${catchAllModules[entry.name]}" conflicts with ` +
        `"${conflicting}"`
      );
    }
  }
}

// Gather and transform all available webpack configs
function formatConfigs (chain, webpackConfigs, rebundleModules) {
  return Object.entries(webpackConfigs)
    .map(([ name, config ], i) => {

      if (!config) {
        return null;
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

      return {
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
      };
    }).filter((config) => config);
}

function flattenBundles (bundles) {
  return Object.values(bundles)
    .reduce((acc, {
      bundleNames, modulePath, bundleRemapping
    }) => {
      return [
        ...acc,
        ...bundleNames.map((bundleName) => ({
          bundleName,
          bundleRemapping,
          modulePath
        }))
      ];
    }, []);
}

function fillExtensionsOptions (extensions, options) {
  const isObject = (val) => val &&
    typeof val === 'object' && !Array.isArray(val);

  return Object.entries(extensions).reduce((acc, [ name, config ]) => {
    if (isObject(config)) {
      return {
        ...acc,
        exts: {
          ...acc.exts,
          [name]: config
        }
      };
    }

    if (typeof config !== 'function') {
      return acc;
    }

    const computedOptions = computeOptions(options[name] || [], isObject);

    return {
      exts: {
        ...acc.exts,
        [name]: config(computedOptions)
      },
      options: {
        ...acc.options,
        [name]: computedOptions
      }
    };
  }, {
    exts: {},
    options: {}
  });

  function computeOptions (options, isObject) {
    return options.reduce((acc, option) => {
      if (!isObject(option) && typeof option !== 'function') {
        return acc;
      }

      return {
        ...acc,
        ...isObject(option) ? option : option(acc)
      };
    }, {});
  }
}

function formatExtensionsOptions (options) {
  return options.reduce(
    (acc, current) => {
      return {
        ...acc,
        ...Object.fromEntries(Object.entries(current)
          .map(([ ext, option ]) => [ ext, [ option, ...(acc[ext] || []) ] ]))
      };
    },
    {}
  );
}
