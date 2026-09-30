const apostrophe = require('eslint-config-apostrophe/strict').default;
const { defineConfig, globalIgnores } = require('eslint/config');

module.exports = defineConfig([
  globalIgnores([
    '/test/apos-build',
    '/test/public',
    '/test/locales'
  ]),
  apostrophe
]);
