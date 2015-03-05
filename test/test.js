var assert = require('assert'),
    _ = require('lodash'),
    fs = require('fs');

if (!fs.existsSync(__dirname +'/node_modules')) { 
  fs.mkdirSync(__dirname + '/node_modules');
  fs.symlinkSync(__dirname + '/..', __dirname +'/node_modules/apostrophe', 'dir');
}


require('./bootstraping.js');

// ------------------------------------------------------------------- //
// MODULES  ---------------------------------------------------------- //

describe('Modules', function(){

  //                   //
  //    BASE MODULE    //
  //                   //

  require('./base-module.js');

  //            //
  //    UTIL    //
  //            //

  require('./utils.js');

  //            //
  //     DB     //
  //            //

  require('./db.js');

  //             //
  //   CACHES    //
  //             //

  require('./caches.js');

  //               //
  //    EXPRESS    //
  //               //

  require('./express.js');

  //             //
  //             //
  //  TEMPLATES  //
  //             //
  //             //

  require('./templates.js');

  //             //
  //  LAUNDER    //
  //             //

  require('./launder.js');

  //             //
  //    FILES    //
  //             //

  require('./files.js');

  
});
