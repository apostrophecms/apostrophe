var assert = require('assert'),
    _ = require('lodash'),
    fs = require('fs');

if (!fs.existsSync(__dirname +'/node_modules')) {
  fs.mkdirSync(__dirname + '/node_modules');
  fs.symlinkSync(__dirname + '/..', __dirname +'/node_modules/apostrophe', 'dir');
}

require('./bootstrapping.js');

// ------------------------------------------------------------------- //
// MODULES  ---------------------------------------------------------- //

describe('Modules', function(){

  require('./base-module.js');

  require('./utils.js');

  require('./db.js');

  require('./caches.js');

  require('./express.js');

  require('./templates.js');

  require('./launder.js');

  require('./permissions.js');

  require('./files.js');

  require('./docs.js');

  require('./pages.js');  

  require('./custom-pages.js');  

  require('./pieces.js');  

  require('./pieces-pages.js');  

  require('./pieces-widgets.js');  

  require('./search.js');

  require('./tags.js');
});
