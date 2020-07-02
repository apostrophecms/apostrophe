const path = require('path');
module.exports = {
  stories: [path.resolve('lib/modules/@apostrophecms/**/*.stories.js')],
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
  ]
};
