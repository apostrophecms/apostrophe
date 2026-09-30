const apostrophe = require('eslint-config-apostrophe').default;
const { defineConfig, globalIgnores } = require('eslint/config');

module.exports = defineConfig([
  globalIgnores([
    '**/vendor/**/*.js',
    '**/blueimp/**/*.js',
    'test/public',
    'test/apos-build',
    'test/modules/jsx-mixed-test/views/syntax-error.jsx',
    'coverage',
    'claude-tools'
  ]),
  apostrophe
]);
