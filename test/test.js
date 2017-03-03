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

  // Removes some non-determinism of tasks timing out when running on travis
  this.timeout(5000);
  
  require('./base-module.js');
  
  require('./utils.js');
  
  require('./urls.js');
  
  require('./db.js');
  
  require('./caches.js');
  
  require('./locks.js');
  
  require('./express.js');
  
  require('./templates.js');

  require('./push.js');
  
  require('./launder.js');
  
  require('./permissions.js');
  
  require('./areas.js');
  
  require('./attachments.js');
  
  require('./schemas.js');
  
  require('./schemaFilters.js');
  
  require('./docs.js');
  
  require('./pages.js');
  
  require('./custom-pages.js');
  
  require('./pieces.js');
  
  require('./pieces-pages.js');
  
  require('./pieces-widgets.js');
  
  require('./search.js');
  
  require('./tags.js');
  
  require('./users.js');
  
  require('./login.js');
  
  require('./versions.js');
  
  require('./images.js');
  
  require('./oembed.js');
  
  require('./admin-bar.js');

});
