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

  // Clear out uploads after tests wrap up
  after(function() {
    deleteFolderRecursive(__dirname + '/public/uploads');

    function deleteFolderRecursive (path) {
      var files = [];
      if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
          var curPath = path + "/" + file;
          if(fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath);
          } else { // delete file
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(path);
      }
    };
  });

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
