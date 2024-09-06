const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const devMode = process.env.NODE_ENV !== 'production';

module.exports = (options, apos, srcBuildNames) => {
  const plugins = [
    new MiniCssExtractPlugin({
      // Should be automatic but we wind up with main.css if we try to go with that
      filename: ({ chunk }) => {
        const contentHash = devMode ? '' : '.[contenthash]';

        return srcBuildNames.includes(chunk.name)
          ? `[name]${contentHash}.css`
          : `[name]-bundle${contentHash}.css`;
      },
      chunkFilename: devMode ? '[id].css' : '[id].[contenthash].css',
    })
    //new MediaToContainerQueryPlugin()
  ];
  if (devMode) {
    // only enable hot in development
    plugins.push(new webpack.HotModuleReplacementPlugin());
  }

  return {
    plugins,
    module: {
      rules: [
        {
          test: /\.s[ac]ss$/,
          use: [
            // Instead of style-loader, to avoid FOUC
            MiniCssExtractPlugin.loader,
            // Parses CSS imports and make css-loader ignore urls. Urls will still be handled by webpack
            {
              loader: path.resolve(__dirname, '../media-to-container-loader.js')
            },
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
    }
  };
};
