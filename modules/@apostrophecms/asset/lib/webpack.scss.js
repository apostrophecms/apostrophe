const StyleLintPlugin = require('stylelint-webpack-plugin');

module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [ 'vue-style-loader', 'css-loader' ]
        },
        {
          test: /\.s[ac]ss$/,
          use: [
            'vue-style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                plugins: () => [ require('autoprefixer') ]
              }
            },
            {
              loader: 'sass-loader',
              options: {
                additionalData: `
@import "Modules/@apostrophecms/ui/scss/imports.scss";
              `
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
