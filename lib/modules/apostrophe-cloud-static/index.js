var Promise = require('bluebird');
var async = require('async');
var _ = require('lodash');

// Efficiently sync a local folder of static files to uploadfs,
// with the ability to remove the folder and its contents later.
// This ensures your application will still work if you move
// it to s3, azure blob storage, etc. via uploadfs.
//
// It is meant for delivering the output of tools like backstop,
// sitemap generators, etc. that generate output as HTML files
// and associated assets.
//
// As long as you use this module, you won't have to worry about
// making changes to those tools on the day you switch to S3.

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
    // properly configured. Note that your cloud storage might or might not
    // be configured to automatically serve `index.html` if that is not
    // present in the URL.
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
        return Promise.promisify(body)();
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
            return async.eachLimit(files, 5, (file, callback) => {
              return self.db.update(file, file, { upsert: true }, callback);
            }, err => {
              return callback(err);
            });
          });
        }
        function cleanup(callback) {
          return self.removeFolder(uploadfsPath, _.map(files, '_id'), callback);
        }
      }
    };

    // Recursively removes the contents of a folder previously synced up to the web
    // with the `syncFolder` method. Any files whose uploadfs paths are in the `except`
    // array are not removed. The `except` parameter may be completely omitted.
    //
    // This method is NOT guaranteed to work unless the folder was
    // originally synced up using `syncFolder`.
    //
    // If no callback is passed, a promise is returned.

    self.removeFolder = function(uploadfsPath, except, callback) {
      if (!Array.isArray(except)) {
        callback = except;
        except = [];
      }
      if (!callback) {
        return Promise.promisify(body)();
      } else {
        return body(callback);
      }

      function body(callback) {
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
          return async.eachLimit(files, 5, (file, callback) => {
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
      }
    };

    // Returns the public URL corresponding to an uploadfs path. Provided for
    // convenience.

    self.getUrl = function(uploadfsPath) {
      return self.apos.attachments.uploadfs.getUrl() + uploadfsPath;
    };
  }
};
