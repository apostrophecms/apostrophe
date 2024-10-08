const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (options, apos, srcBuildNames) => {
  const mediaToContainerQueriesLoader = apos.asset.options.breakpointPreviewMode?.enable === true
    ? {
      loader: path.resolve(__dirname, '../media-to-container-queries-loader.js'),
      options: {
        debug: apos.asset.options.breakpointPreviewMode?.debug === true,
        transform: apos.asset.options.breakpointPreviewMode?.transform || null
      }
    }
    : '';

  return {
    module: {
      rules: [
        {
          test: /\.s[ac]ss$/,
          use: [
            // Instead of style-loader, to avoid FOUC
            MiniCssExtractPlugin.loader,
            mediaToContainerQueriesLoader,
            // Parses CSS imports and make css-loader ignore urls. Urls will still be handled by webpack
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
                  plugins: [
                    [
                      'autoprefixer',
                      {}
                    ]
                  ]
                }
              }
            },
            // Parses SASS imports
            'sass-loader'
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
