const { pathToFileURL } = require('node:url');

module.exports = async ({
  sourceRoot, input
}) => {
  const vue = await import('@vitejs/plugin-vue');
  const apos = await import('./vite-plugin-apostrophe-alias.mjs');

  /** @type {import('vite').UserConfig} */
  return {
    css: {
      preprocessorOptions: {
        scss: {
          // Hardcoded for now, we need to make it configurable in the future.
          //
          // Windows Node.js has no objection to / paths here, but it does object
          // to mixed paths, so normalize on /
          additionalData: `
@use 'sass:math';
@use 'sass:color';
@use 'sass:map';

@import "${pathToFileURL(sourceRoot.replaceAll('\\', '/'))}/@apostrophecms/ui/apos/scss/mixins/import-all.scss";
`
        }
      }
    },
    plugins: [
      apos.default({
        id: 'apos',
        sourceRoot
      }),
      vue.default()
    ],
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input
      }
    }
  };
};
