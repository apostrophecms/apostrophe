var fs = require('fs');

if (!fs.existsSync(__dirname + '/../test/node_modules')) {
  fs.mkdirSync(__dirname + '/../test/node_modules');
  fs.symlinkSync(__dirname + '/..', __dirname + '/../test/node_modules/apostrophe', 'dir');
}

module.exports = require('./util.js');
