module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            {
              loader: 'vue-style-loader',
              options: {
                attributes: {
                  'data-apos-ui': '1'
                }
              }
            },
            // https://github.com/vuejs/vue-style-loader/issues/46#issuecomment-670624576
            {
              loader: 'css-loader',
              options: {
                esModule: false,
                sourceMap: true
              }
            }
          ]
        },
        // https://github.com/vuejs/vue-style-loader/issues/46#issuecomment-670624576
        {
          test: /\.s[ac]ss$/,
          use: [
            {
              loader: 'vue-style-loader',
              options: {
                attributes: {
                  'data-apos-ui': '1'
                }
              }
            },
            {
              loader: 'css-loader',
              options: {
                esModule: false,
                sourceMap: true
              }
            },
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
