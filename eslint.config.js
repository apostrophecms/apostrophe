const { defineConfig, globalIgnores } = require('eslint/config');
const apostrophe = require('eslint-config-apostrophe');

module.exports = defineConfig([
  globalIgnores([
    "**/vendor/**/*.js",
    "**/blueimp/**/*.js",
    "**/node_modules",
    "test/public",
    "test/apos-build",
    "coverage"
  ]),
	{
		files: ["**/*.js", "**/*.vue"],
		plugins: {
			apostrophe
		}
	}
]);
