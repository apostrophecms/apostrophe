module.exports = async ({
  sourceRoot, input
}) => {
  const apos = await import('./vite-plugin-apostrophe-alias.mjs');

  /** @type {import('vite').UserConfig} */
  return {
    plugins: [
      apos.default({
        id: 'src',
        sourceRoot
      })
    ],
    build: {
      rollupOptions: {
        input
      }
    }
  };
};
