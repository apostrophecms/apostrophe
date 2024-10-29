const path = require('path');
const postcssCopyViewportToContainerUnits = require('postcss-copy-viewport-to-container-units');

module.exports = (options, apos) => {
  const postcssPlugins = [
    'autoprefixer',
    {}
  ];
  let mediaToContainerQueriesLoader = '';

  if (apos.asset.options.breakpointPreviewMode?.enable === true) {
    postcssPlugins.unshift(
      postcssCopyViewportToContainerUnits({
        selector: ':where(body[data-breakpoint-preview-mode])'
      })
    );
    mediaToContainerQueriesLoader = {
      loader: path.resolve(__dirname, '../media-to-container-queries-loader.js'),
      options: {
        debug: apos.asset.options.breakpointPreviewMode?.debug === true,
        transform: apos.asset.options.breakpointPreviewMode?.transform || null
      }
    };
  }

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
                  plugins: [ postcssPlugins ]
                }
              }
            },
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  silenceDeprecations: [ 'import' ]
                },
                sourceMap: false,
                // "use" rules must come first or sass throws an error
                additionalData: `
@use 'sass:math';
@use "sass:color";
@use "sass:map";

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
