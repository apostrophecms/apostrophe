const {
  postcssCopyViewportToContainerUnits,
  postcssMediaToContainerQueries
} = require('@apostrophecms/postcss');

module.exports = (options, apos) => {
  const postcssPlugins = [
    'autoprefixer',
    {}
  ];

  if (apos.asset.options.breakpointPreviewMode?.enable === true) {
    postcssPlugins.unshift(
      postcssCopyViewportToContainerUnits({
        selector: ':where(body[data-breakpoint-preview-mode])'
      }),
      postcssMediaToContainerQueries({
        selector: ':where(body:not([data-breakpoint-preview-mode]))'
      })
    );
  }

  return {
    module: {
      rules: [
        // TODO: Why no postcss plugin here while loader was here?
        {
          test: /\.css$/,
          use: [
            'vue-style-loader',
            'css-loader'
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
