const apostrophe = require('eslint-config-apostrophe').default;
const { defineConfig, globalIgnores } = require('eslint/config');

module.exports = defineConfig([
  globalIgnores([
    'public/apos-frontend',
    'data/temp',
    'apos-build',
    'test/modules/**/ui/*'
  ]),
  apostrophe
]);
