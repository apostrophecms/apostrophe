const fs = require('fs-extra');
const path = require('path');

if (!fs.existsSync(path.join(__dirname, '/../test/node_modules'))) {
  fs.mkdirSync(path.join(__dirname, '/../test/node_modules'));
  fs.symlinkSync(path.join(__dirname, '/..'), path.join(__dirname, '/../test/node_modules/apostrophe'), 'dir');
}

if (!fs.existsSync(path.join(__dirname, '/../test/package.json'))) {
  // Linking package.json file for the start up build task to find.
  fs.ensureSymlink(path.join(__dirname, '/../package.json'), path.join(__dirname, '/../test/package.json'));

}

module.exports = require('./util.js');
