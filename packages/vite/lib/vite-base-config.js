module.exports = ({
  mode, base, root, cacheDir, manifestRelPath, sourceMaps
}) => {
  /** @type {import('vite').UserConfig} */
  const config = {
    mode,
    // We might need to utilize the advanced asset settings here.
    // https://vite.dev/guide/build.html#advanced-base-options
    // For now we just use the (real) asset base URL.
    base,
    root,
    appType: 'custom',
    publicDir: false,
    cacheDir,
    clearScreen: false,
    // Breaks symlinked modules if not enabled
    resolve: {
      preserveSymlinks: true
    },
    css: {
      preprocessorOptions: {
        scss: {
          // https://vite.dev/guide/migration#sass-now-uses-modern-api-by-default
          // Vite v6 uses the modern API by default, keeping this
          // here for future reference.
          // api: 'modern-compiler',
          silenceDeprecations: [ 'import' ]
        }
      }
    },
    plugins: [],
    build: {
      outDir: 'dist',
      cssCodeSplit: true,
      manifest: manifestRelPath,
      sourcemap: sourceMaps,
      emptyOutDir: false,
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          entryFileNames: '[name]-build.js',
          assetFileNames
        }
      }
    }
  };

  return config;
};

// Assets that come from a module's `public/` folder (e.g. fonts referenced
// from CSS via `url('/modules/...')`) are emitted at their original path,
// without a content hash. This way `apos.asset.url('/modules/...')` in a
// template matches the URL the built CSS requests, e.g. for preloading.
// Cache busting is already provided by the release directory, just like
// for the unhashed `[name]-build.js` entry files.
function assetFileNames({ names = [], originalFileNames = [] }) {
  const original = originalFileNames[0]?.replaceAll('\\', '/');
  const isCss = names.some((name) => name.endsWith('.css'));
  if (!isCss && original?.startsWith('modules/')) {
    return original;
  }
  return 'assets/[name]-[hash][extname]';
}
