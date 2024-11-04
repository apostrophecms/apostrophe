const postcssViewportToContainerToggle = require('postcss-viewport-to-container-toggle');

module.exports = (options, apos) => {
  const postcssPlugins = [
    ...apos.asset.options.breakpointPreviewMode?.enable === true ? [
      postcssViewportToContainerToggle({
        modifierAttr: 'data-breakpoint-preview-mode',
        debug: apos.asset.options.breakpointPreviewMode?.debug === true,
        transform: apos.asset.options.breakpointPreviewMode?.transform || null
      })
    ] : [],
    'autoprefixer',
    {}
  ];

  return {
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            'vue-style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: true,
                postcssOptions: {
                  plugins: [ postcssPlugins ]
                }
              }
            }
          ]
        },
        {
          test: /\.s[ac]ss$/,
          use: [
            'vue-style-loader',
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
