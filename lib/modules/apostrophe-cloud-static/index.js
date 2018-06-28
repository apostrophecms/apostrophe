var Promise = require('bluebird');
var async = require('async');

// Efficiently sync a local folder of static files to uploadfs,
// with the ability to remove the folder and its contents later.
// This ensures your application will still work if you move
// it to s3, azure blob storage, etc. via uploadfs.

module.exports = {

  alias: 'cloudStatic',

  afterConstruct: function(self, callback) {
    return self.initDb(callback);
  },

  construct: function(self, options) {

    self.initDb = function(callback) {
      return self.apos.db.collection('aposCloudStatic', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

    // Sync files from localFolder (on disk) to uploadfsPath (in uploadfs).
    // The url(uploadfsPath) method may then be used to get a URL at which
    // the folder can be viewed as if it were served as a static site, even
    // though the site may be in the cloud, as long as uploadfs has been
    // properly configured.
    //
    // Existing files at or below uploadfsPath that do not exist in localFolder
    // are REMOVED.
    //
    // If a file has not been modified since its last sync
    // according to the filesystem, it MAY not be copied again, for
    // performance reasons.
    //
    // This method is NOT guaranteed to clean up old content properly unless the previously
    // uploaded content was also uploaded with this method.
    //
    // If no callback is passed, a promise is returned.

    self.syncFolder = function(localFolder, uploadfsPath, callback) {
      var files;
      if (!callback) {
        return Promise.promisify(body);
      } else {
        return body(callback);
      }
      function body(callback) {
        return async.series([
          sync,
          cleanup
        ], callback);
        function sync(callback) {
          return self.apos.assets.syncToUploadfs(localFolder, uploadfsPath, function(err, copies) {
            if (err) {
              return callback(err);
            }
            files = copies.map(copy => {
              return {
                _id: copy.to
              };
            });
            return async.eachLimit(5, copies, copy => {
              return self.db.update(copy, copy, { upsert: true }, callback);
            }, callback);
          });
        }
        function cleanup(callback) {
          return self.removeFolder(uploadfsPath, _.map(files, '_id'), callback);
        }
      }
    };

    // Recursively removes the contents of a folder previously synced up to the web
    // with the `syncFolder` method. Any files whose uploadfs paths are in the `except`
    // array are not removed.
    //
    // This method is NOT guaranteed to work unless the folder was
    // originally synced up using `syncFolder`.
    //
    // If no callback is passed, a promise is returned.

    self.removeFolder = function(uploadfsPath, except, callback) {
      return self.db.find({
        $and: [
          {
            _id: new RegExp('^' + self.apos.utils.regExpQuote(uploadfsPath + '/'))
          }, {
            _id: { $nin: except }
          }
        ]
      }).toArray(function(err, files) {
        if (err) {
          return callback(err);
        }
        return async.eachLimit(5, files, file => {
          return async.series([
            fromUploadfs,
            fromDb
          ], callback);
          function fromUploadfs(callback) {
            return self.apos.attachments.uploadfs.remove(file._id, function(err) {
              if (err) {
                self.apos.utils.warn('File most likely already gone from uploadfs: ' + file._id);
              }
              return callback(null);
            });
          }
          function fromDb(callback) {
            return self.db.remove({ _id: file._id }, callback);
          }
        }, callback);
      });
    };

    // Returns the public URL corresponding to an uploadfs path. Provided for
    // convenience.

    self.url = function(uploadfsPath) {
      return self.apos.attachments.getUrl() + uploadfsPath;
    };
  }
};
