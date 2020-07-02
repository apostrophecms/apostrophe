const path = require('path');

module.exports = async ({ config, mode }) => {
  config.module.rules.push(
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: [
        {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        },
        'eslint-loader'
      ]
    },
    {
      test: /\.scss$/,
      loaders: [
        'style-loader',
        'css-loader',
        'sass-loader',
        {
          loader: 'sass-resources-loader',
          options: {
            resources: [
              path.resolve('lib/modules/@apostrophecms/ui/scss/imports.scss')
            ]
          }
        }
      ]
    }
  );

  return config;
};
