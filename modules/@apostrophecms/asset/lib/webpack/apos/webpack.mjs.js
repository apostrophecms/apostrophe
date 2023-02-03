module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.mjs$/i,
          resolve: {
            byDependency: {
              esm: {
                fullySpecified: false
              }
            }
          }
        }
      ]
    }
  };
};
