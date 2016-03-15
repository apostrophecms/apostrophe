/* jshint node:true */
var async = require('async');
var broadband = require('broadband');
var _ = require('lodash');

module.exports = function(apos, argv, callback) {
  // files and pages are removed separately,
  // special cases abound
  var collectionsToEmpty = [ apos.videos ];
  // Listeners can push more collection objects on this
  apos.emit('emptyTrashCollections', collectionsToEmpty);
  return async.series({
    collections: function(callback) {
      return async.eachSeries(collectionsToEmpty, function(collection, callback) {
        return collection.remove({ trash: true }, callback);
      }, callback);
    },
    pages: function(callback) {
      // Don't whack the trash can itself
      return apos.pages.remove({ trash: true, type: { $ne: 'trash' } }, callback);
    },
    files: function(callback) {
      return broadband(apos.files.find({ trash: true }), argv.parallel || 1, function(file, callback) {
        return async.series({
          removeFiles: function(callback) {
            var paths = [ apos.filePath(file, { uploadfsPath: true }) ];
            _.each(apos.uploadfs.getImageSizes(), function(size) {
              paths.push(apos.filePath(file, { size: size.name, uploadfsPath: true }));
            });
            // Also permanently remove old versions of replaced files
            paths = paths.concat(file.oldVersions || []);
            return async.eachSeries(paths, function(path, callback) {
              return async.series({
                restore: function(callback) {
                  return apos.uploadfs.enable(path, function(err) {
                    if (err) {
                      console.error('WARNING: the file ' + path + ' may have been deleted already:');
                      console.error(err);
                    }
                    return callback(null);
                  });
                },
                remove: function(callback) {
                  // The file not existing is not
                  // a fatal error
                  return apos.uploadfs.remove(path, function(err) {
                    if (err) {
                      console.error('WARNING: the file ' + path + ' may have been deleted already:');
                      console.error(err);
                    }
                    return callback(null);
                  });
                }
              }, callback);
            }, callback);
          },
          removeObject: function(callback) {
            return apos.files.remove({ _id: file._id }, callback);
          }
        }, callback);
      }, callback);
    },
  }, callback);
};
