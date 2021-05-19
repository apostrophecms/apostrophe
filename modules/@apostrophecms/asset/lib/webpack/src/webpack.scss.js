const StyleLintPlugin = require('stylelint-webpack-plugin');

module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
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
                // TODO this must go, but for now consistent
                // with the ui build
                implementation: require('node-sass')
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new StyleLintPlugin({
        files: [ './node_modules/apostrophe/modules/**/*.{scss,vue}' ]
      })
    ]
  };
};
