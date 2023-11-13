const { VueLoaderPlugin } = require('vue-loader');

module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: {
            sourceMap: true,
            compilerOptions: {
              compatConfig: {
                MODE: 2
              }
            }
          }
        }
      ]
    },
    resolve: {
      alias: {
        vue: '@vue/compat'
      }
    },
    plugins: [
      // make sure to include the plugin for the magic
      new VueLoaderPlugin()
    ]
  };
};
