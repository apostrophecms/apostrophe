const path = require('path');

module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: `${__dirname}/vue-2-loader.js`,
          options: {
            sourceMap: true
          }
        }
      ]
    }
  };
};
