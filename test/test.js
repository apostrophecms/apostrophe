var assert = require('assert'),
    _ = require('lodash'),
    fs = require('fs'),
    async = require('async');

if (!fs.existsSync(__dirname +'/node_modules')) {
  fs.mkdirSync(__dirname + '/node_modules');
  fs.symlinkSync(__dirname + '/..', __dirname +'/node_modules/apostrophe', 'dir');
}

// Global function to properly clean up an apostrophe instance and drop its
// database to create a sane environment for the next test

function destroy(apos, done) {
  if (!apos) {
    done();
    return;
  }
  return async.series([
    drop,
    destroy
  ], function(err) {
    assert(!err);
    return done();
  });
  function drop(callback) {
    return apos.db.dropDatabase(callback);
  }
  function destroy(callback) {
    return apos.destroy(callback);
  }
};

// To ease writing test files this is global.
//
// Use of global. anywhere in a normal project is a worst practice. -Tom

global.destroy = destroy;

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
