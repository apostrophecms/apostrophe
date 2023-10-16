const { VueLoaderPlugin } = require('vue-loader');

module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: {
            sourceMap: true
          }
        }
      ]
    },
    plugins: [
      // make sure to include the plugin for the magic
      new VueLoaderPlugin()
    ]
  };
};
