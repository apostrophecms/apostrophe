var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var path = require('path');


module.exports = function(self, options) {

  // Accept a file as submitted by an HTTP file upload.
  // req is checked for permissions. The callback receives an error if any
  // followed by a file object.
  //
  // "file" should be an object with "name" and "path" properties.
  // "name" must be the name the user claims for the file, while "path"
  // must be the actual full path to the file on disk and need not have
  // any file extension necessarily.
  //
  // (Note that when using Express to handle file uploads,
  // req.files['yourfieldname'] will be such an object as long as you
  // configure jquery fileupload to submit one per request.)

  self.accept = function(req, file, callback) {
    var extension = path.extname(file.name);
    if (extension && extension.length) {
      extension = extension.substr(1);
    }
    extension = extension.toLowerCase();
    // Do we accept this file extension?
    var accepted = [];
    var group = _.find(self.fileGroups, function(group) {
      accepted.push(group.extensions);
      var candidate = group.extensionMaps[extension] || extension;
      if (_.contains(group.extensions, candidate)) {
        return true;
      }
    });
    if (!group) {
      return callback("File extension not accepted. Acceptable extensions: " + accepted.join(", "));
    }
    var image = group.image;
    var info = {
      id: self.apos.utils.generateId(),
      length: file.length,
      group: group.name,
      createdAt: new Date(),
      name: self.apos.utils.slugify(path.basename(file.name, path.extname(file.name))),
      title: self.apos.utils.sortify(path.basename(file.name, path.extname(file.name))),
      extension: extension
    };

    function permissions(callback) {
      // TODO port permissions
      return callback(self.apos.permissions.can(req, 'edit-file') ? null : 'forbidden');
    }

    function md5(callback) {
      return self.md5(file.path, function(err, md5) {
        if (err) {
          return callback(err);
        }
        info.md5 = md5;
        return callback(null);
      });
    }

    function upload(callback) {
      if (image) {
        // For images we correct automatically for common file extension mistakes
        return self.uploadfs.copyImageIn(file.path, '/attachments/' + info.id + '-' + info.name, function(err, result) {
          if (err) {
            return callback(err);
          }
          info.extension = result.extension;
          info.width = result.width;
          info.height = result.height;
          info.ownerId = req.user && req.user._id;
          info.searchText = self.searchText(info);
          if (info.width > info.height) {
            info.landscape = true;
          } else {
            info.portrait = true;
          }
          return callback(null);
        });
      } else {
        // For non-image files we have to trust the file extension
        // (but we only serve it as that content type, so this should
        // be reasonably safe)
        return self.uploadfs.copyIn(file.path, '/attachments/' + info.id + '-' + info.name + '.' + info.extension, callback);
      }
    }

    function cache(callback) {
      // TODO port permissions
      info.ownerId = self.apos.permissions.getEffectiveUserId(req);
      return self.cache.set(info.id, info, 60 * 60 * 24, callback);
    }

    return async.series([ permissions, md5, upload, cache ], function(err) {
      return callback(err, info);
    });
  };

  self.md5 = function(filename, callback) {
    var fs = require('fs');

    var md5 = crypto.createHash('md5');

    var s = fs.ReadStream(filename);

    s.on('data', function(d) {
      md5.update(d);
    });

    s.on('error', function(err) {
      return callback(err);
    });

    s.on('end', function() {
      var d = md5.digest('hex');
      return callback(null, d);
    });
  };

}