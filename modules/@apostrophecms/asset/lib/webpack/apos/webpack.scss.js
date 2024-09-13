const path = require('path');

module.exports = (options, apos) => {
  const mediaToContainerQueriesLoader = apos.asset.options.devicePreviewMode?.enable === true
    ? {
      loader: path.resolve(__dirname, '../media-to-container-queries-loader.js'),
      options: {
        debug: apos.asset.options.devicePreviewMode?.debug === true,
        transform: apos.asset.options.devicePreviewMode?.transform || null
      }
    }
    : '';

  return {
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            'vue-style-loader',
            mediaToContainerQueriesLoader,
            'css-loader'
          ]
        },
        {
          test: /\.s[ac]ss$/,
          use: [
            'vue-style-loader',
            mediaToContainerQueriesLoader,
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
