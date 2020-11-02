const fs = require('fs');
const path = require('path');

if (!fs.existsSync(path.join(__dirname, '/../test/node_modules'))) {
  fs.mkdirSync(path.join(__dirname, '/../test/node_modules'));
  fs.symlinkSync(path.join(__dirname, '/..'), path.join(__dirname, '/../test/node_modules/apostrophe'), 'dir');
}

module.exports = require('./util.js');
