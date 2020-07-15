module.exports = {
  stories: "STORIES",
  addons: [
    '@storybook/addon-knobs',
    '@storybook/addon-a11y/register',
    '@storybook/addon-contexts/register',
    {
      name: '@storybook/addon-storysource',
      options: {
        loaderOptions: {
          prettierConfig: {
            printWidth: 80,
            singleQuote: false
          }
        }
      }
    }
  ],
  webpackFinal: async (config) => {
    return require('./webpack.js')(config);
  }
};
