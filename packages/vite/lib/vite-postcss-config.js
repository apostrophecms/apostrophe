module.exports = async ({ plugins }) => {
  return {
    css: {
      postcss: {
        plugins
      }
    }
  };
};
