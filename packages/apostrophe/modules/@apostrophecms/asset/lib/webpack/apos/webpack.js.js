module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.(m)?js$/i,
          resolve: {
            byDependency: {
              esm: {
                // Be tolerant of imports like lodash/debounce that
                // should really be lodash/debounce.js, as dependencies
                // like tiptap are not fully on board with that rule yet
                fullySpecified: false
              }
            }
          }
        }
      ]
    }
  };
};
