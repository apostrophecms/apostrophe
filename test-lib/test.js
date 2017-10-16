var fs = require('fs');
var async = require('async');

if (!fs.existsSync(__dirname + '/../test/node_modules')) {
  fs.mkdirSync(__dirname + '/../test/node_modules');
  fs.symlinkSync(__dirname + '/..', __dirname +'/../test/node_modules/apostrophe', 'dir');
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
    if (err) {
      console.error(err);
      process.exit(1);
    }
    return done();
  });
  function drop(callback) {
    return apos.db.collections(function(err, _collections) {
      if (err) {
        return callback(err);
      }
      collections = _collections;

      //drop the collections
      return async.eachSeries(collections, function(collection, callback) {
        if(!collection.collectionName.match(/^system\./)){
          return collection.drop(callback);
        }
        return setImmediate(callback);
      }, callback );
    });
  }
  function destroy(callback) {
    return apos.destroy(callback);
  }
};

module.exports = {
  destroy: destroy,
  timeout: (process.env.TEST_TIMEOUT && parseInt(process.env.TEST_TIMEOUT)) || 5000
};
