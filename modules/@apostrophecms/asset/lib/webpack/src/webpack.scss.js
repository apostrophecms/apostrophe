const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.s[ac]ss$/,
          use: [
            // Instead of style-loader, to avoid FOUC
            MiniCssExtractPlugin.loader,
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
        filename: options.outputFilename.replace('.js', '.css')
      })
    ]
  };
};
