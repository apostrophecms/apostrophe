const apostrophe = require('eslint-config-apostrophe').default;
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  apostrophe,
  {
    // A command line program: the console is its user interface, not a
    // diagnostic channel.
    rules: {
      'no-console': 'off'
    }
  }
]);
