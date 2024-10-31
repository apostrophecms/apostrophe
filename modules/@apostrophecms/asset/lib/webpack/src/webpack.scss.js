const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const postcssViewportToContainerToggle = require('@apostrophecms/postcss');

module.exports = (options, apos, srcBuildNames) => {
  const postcssPlugins = [
    ...apos.asset.options.breakpointPreviewMode?.enable === true ? [
      postcssViewportToContainerToggle({
        modifierAttr: 'data-breakpoint-preview-mode'
      })
    ] : [],
    'autoprefixer',
    {}
  ];
  if (apos.asset.options.breakpointPreviewMode?.enable === true) {
    postcssPlugins.unshift(
      postcssViewportToContainerToggle({
        modifierAttr: 'data-breakpoint-preview-mode'
      })
    );
  }

  return {
    module: {
      rules: [
        {
          test: /\.s[ac]ss$/,
          use: [
            // Instead of style-loader, to avoid FOUC
            MiniCssExtractPlugin.loader,
            // Parses CSS imports and make css-loader ignore urls.
            // Urls will still be handled by webpack
            {
              loader: 'css-loader',
              options: { url: false }
            },
            // Provides autoprefixing
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: true,
                postcssOptions: {
                  plugins: [ postcssPlugins ]
                }
              }
            },
            // Parses SASS imports
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  silenceDeprecations: [ 'import' ]
                }
              }
            }
          ],
          // https://stackoverflow.com/a/60482491/389684
          sideEffects: true
        }
      ]
    },
    plugins: [
      new MiniCssExtractPlugin({
        // Should be automatic but we wind up with main.css if we try to go with that
        filename: ({ chunk }) => {
          return srcBuildNames.includes(chunk.name)
            ? '[name].css'
            : '[name]-bundle.css';
        }
      })
    ]
  };
};
