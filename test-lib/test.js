const fs = require('fs-extra');
const path = require('path');

fs.removeSync(path.join(__dirname, '/../test/node_modules'));
fs.mkdirSync(path.join(__dirname, '/../test/node_modules'));
fs.symlinkSync(path.join(__dirname, '/..'), path.join(__dirname, '/../test/node_modules/apostrophe'), 'dir');

// Need a "project level" package.json for functionality that checks
// whether packages in node_modules are project level or not

const packageJson = path.join(__dirname, '/../test/package.json');
// Remove it first, in case it's the old-style symlink to the main package.json,
// which would break
fs.removeSync(packageJson);
fs.writeFileSync(packageJson, `
{
  "name": "test",
  "dependencies": {
    "apostrophe": "^3.0.0"
  },
  "devDependencies": {
    "test-bundle": {}
    }
}`);

module.exports = require('./util.js');
