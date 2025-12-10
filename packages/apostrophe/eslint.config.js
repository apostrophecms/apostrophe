const apostrophe = require('eslint-config-apostrophe').default;
const { defineConfig, globalIgnores } = require('eslint/config');

module.exports = defineConfig([
  globalIgnores([
    '**/vendor/**/*.js',
    '**/blueimp/**/*.js',
    'test/public',
    'test/apos-build',
    'coverage'
  ]),
  apostrophe
]);
