const { postcssTape } = require('@csstools/postcss-tape');
const plugin = require('../../modules/@apostrophecms/asset/lib/webpack/postcss-replace-viewport-units-plugin.js');

postcssTape(plugin)({
  'postcss/replace-viewport-units': {
    message: 'Replace viewport units with container query units'
  }
});
