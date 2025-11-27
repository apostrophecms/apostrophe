const apostrophe = require('eslint-config-apostrophe').default;
const { defineConfig, globalIgnores } = require('eslint/config');

module.exports = defineConfig([
  globalIgnores([
    'dist'
  ]),
  apostrophe
]);
