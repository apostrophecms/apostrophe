const path = require('path');

module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            'vue-style-loader',
            {
              loader: path.resolve(__dirname, '../media-to-container-loader.js')
            },
            'css-loader'
          ]
        },
        {
          test: /\.s[ac]ss$/,
          use: [
            'vue-style-loader',
            {
              loader: path.resolve(__dirname, '../media-to-container-loader.js')
            },
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: true,
                postcssOptions: {
                  plugins: [
                    [
                      'autoprefixer',
                      {}
                    ]
                  ]
                }
              }
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: false,
                // "use" rules must come first or sass throws an error
                additionalData: `
@use 'sass:math';
@import "Modules/@apostrophecms/ui/scss/mixins/import-all.scss";
              `
              }
            }
          ]
        }
      ]
    }
  };
};
