module.exports = {
  stories: "STORIES", // NOTE: This must use double quotes for the build.
  addons: [
    '@storybook/addon-knobs/register',
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
