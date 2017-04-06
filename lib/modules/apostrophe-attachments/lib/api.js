var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');

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
    var group = self.getFileGroup(extension);
    if (!group) {
      var accepted = _.union(_.pluck(self.fileGroups, 'extensions'));
      return callback("File extension not accepted. Acceptable extensions: " + accepted.join(","));
    }
    var image = group.image;
    var info = {
      _id: self.apos.utils.generateId(),
      length: file.length,
      group: group.name,
      createdAt: new Date(),
      name: self.apos.utils.slugify(path.basename(file.name, path.extname(file.name))),
      title: self.apos.utils.sortify(path.basename(file.name, path.extname(file.name))),
      extension: extension,
      type: 'attachment'
    };

    function permissions(callback) {
      // TODO port permissions
      return callback(self.apos.permissions.can(req, 'edit-attachment') ? null : 'forbidden');
    }

    function md5(callback) {
      return self.apos.utils.md5File(file.path, function(err, md5) {
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
        return self.uploadfs.copyImageIn(file.path, '/attachments/' + info._id + '-' + info.name, function(err, result) {
          if (err) {
            return callback(err);
          }
          info.extension = result.extension;
          info.width = result.width;
          info.height = result.height;
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
        return self.uploadfs.copyIn(file.path, '/attachments/' + info._id + '-' + info.name + '.' + info.extension, callback);
      }
    }

    function remember(callback) {
      info.ownerId = self.apos.permissions.getEffectiveUserId(req);
      info.createdAt = new Date();
      return self.db.insert(info, callback);
    }

    return async.series([ permissions, md5, upload, remember ], function(err) {
      return callback(err, info);
    });
  };

  self.getFileGroup = function(extension) {
    return _.find(self.fileGroups, function(group) {
      var candidate = group.extensionMaps[extension] || extension;
      if (_.contains(group.extensions, candidate)) {
        return true;
      }
    });
  };

  self.crop = function(req, _id, crop, callback) {
    var info;
    return async.series([
      function(callback) {
        self.db.findOne({ _id: _id }, function(err, _info) {
          info = _info;
          return callback(err);
        });
      }
    ], function(err) {
      if (!info) {
        return callback('notfound');
      }
      info.crops = info.crops || [];
      var existing = _.find(info.crops, crop);
      if (existing) {
        // We're done, this crop is already available
        return callback(null);
      }
      // Pull the original out of cloud storage to a temporary folder where
      // it can be cropped and popped back into uploadfs
      var originalFile = '/attachments/' + info._id + '-' + info.name + '.' + info.extension;
      var tempFile = self.uploadfs.getTempPath() + '/' + self.apos.utils.generateId() + '.' + info.extension;
      var croppedFile = '/attachments/' + info._id + '-' + info.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + info.extension;

      return async.series([
        function(callback) {
          self.uploadfs.copyOut(originalFile, tempFile, callback);
        },
        function(callback) {
          self.uploadfs.copyImageIn(tempFile, croppedFile, { crop: crop }, callback);
        },
        function(callback) {
          info.crops.push(crop);
          self.db.update({ _id: info._id }, info, callback);
        }
      ], function(err) {
        // We're done with the temp file. We don't care if it was never created.
        fs.unlink(tempFile, function() { });
        return callback(err);
      });
    });
  };

  self.sanitizeCrop = function(crop) {
    crop = _.pick(crop, 'top', 'left', 'width', 'height');
    crop.top = self.apos.launder.integer(crop.top, 0, 0, 10000);
    crop.left = self.apos.launder.integer(crop.left, 0, 0, 10000);
    crop.width = self.apos.launder.integer(crop.width, 1, 1, 10000);
    crop.height = self.apos.launder.integer(crop.height, 1, 1, 10000);
    if (_.keys(crop).length < 4) {
      return undefined;
    }
    return crop;
  };

  // Clones a file
  self.clone = function(req, source, callback) {
    var originalFile = '/attachments/' + source._id + '-' + source.name + '.' + source.extension;
    var tempFile = self.uploadfs.getTempPath() + '/' + self.apos.utils.generateId() + '.' + source.extension;

    var target = {
      _id: self.apos.utils.generateId(),
      length: source.length,
      group: source.group,
      createdAt: new Date(),
      name: source.name,
      title: source.title,
      extension: source.extension
    };

    var copyIn;
    var group = _.find(self.fileGroups, 'name', source.group)

    if (group && group.image) {
      // TODO add clone capability for crops of an image
      // target.crops = source.crops;
      // target.crop = source.crop;
      target.width = source.width;
      target.height = source.height;
      target.landscape = source.landscape;
      target.portrait = source.portrait;

      copyIn = self.uploadfs.copyImageIn;
    } else {
      copyIn = self.uploadfs.copyIn;
    }

    var targetPath = '/attachments/' + target._id + '-' + target.name + '.' + target.extension;

    return async.series([
      function(callback) {
        // Get the source, place in tempfile
        return self.uploadfs.copyOut(originalFile, tempFile, callback);
      },
      function(callback) {
        // Copy tempfile to target
        return copyIn(tempFile, '/attachments/' + target._id + '-' + target.name + '.' + target.extension, callback);
      },
      function(callback) {
        // Update meta for target
        return self.db.insert(target, callback);
      }
    ], function(err) {
      fs.unlink(tempFile, function() { });
      return callback(err, target);
    })
  };

  // This method is available as a template helper: apos.attachments.url
  //
  // Given an attachment object,
  // return the URL. If options.size is set, return the URL for
  // that size (one-third, one-half, two-thirds, full). full is
  // "full width" (1140px), not the original. For the original, don't pass size.
  // If the "uploadfsPath" option is true, an
  // uploadfs path is returned instead of a URL.

  self.url = function(attachment, options) {
    options = options || {};

    var path = '/attachments/' + attachment._id + '-' + attachment.name;
    if (!options.uploadfsPath) {
      path = self.uploadfs.getUrl() + path;
    }
    // Attachments can have "one true crop," or a crop can be passed with the options.
    // For convenience, be tolerant if options.crop is passed but doesn't
    // actually have valid cropping properties
    var c;
    if (options.crop !== false) {
      c = options.crop || attachment._crop || attachment.crop;
      if (c && c.width) {
        path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
      }
    }
    var effectiveSize;
    if ((attachment.group !== 'images') || (options.size === 'original')) {
      effectiveSize = false;
    } else {
      effectiveSize = options.size || 'full';
    }
    if (effectiveSize) {
      path += '.' + effectiveSize;
    }
    return path + '.' + attachment.extension;
  };

  // This method is available as a template helper: apos.attachments.first
  //
  // Find the first attachment referenced within any object with
  // attachments as possible properties or sub-properties.
  //
  // For best performance be reasonably specific; don't pass an entire page or piece
  // object if you can pass page.thumbnail to avoid an exhaustive search, especially
  // if the page has many joins.
  //
  // Returns the first attachment matching the criteria.
  //
  // For ease of use, a null or undefined `within` argument is accepted.
  //
  // Examples:
  //
  // 1. In the body please
  //
  // apos.attachments.first(page.body)
  //
  // 2. Must be a PDF
  //
  // apos.attachments.first(page.body, { extension: 'pdf' })
  //
  // 3. May be any office-oriented file type
  //
  // apos.attachments.first(page.body, { group: 'office' })
  //
  // apos.images.first is a convenience wrapper for fetching only images.
  //
  // OPTIONS:
  //
  // You may specify `extension`, `extensions` (an array of extensions)
  // or `group` to filter the results.

  self.first = function(within, options) {
    options = options ? _.clone(options) : {};
    options.limit = 1;
    return self.all(within, options)[0];
  };

  // This method is available as a template helper: apos.attachments.all
  //
  // Find all attachments referenced within an object, whether they are
  // properties or sub-properties (via joins, etc).
  //
  // For best performance be reasonably specific; don't pass an entire page or piece
  // object if you can pass piece.thumbnail to avoid an exhaustive search, especially
  // if the piece has many joins.
  //
  // Returns an array of attachments, or an empty array if none are found.
  //
  // For ease of use, a null or undefined `within` argument is accepted.
  //
  // Examples:
  //
  // 1. In the body please
  //
  // apos.attachments.all(page.body)
  //
  // 2. Must be a PDF
  //
  // apos.attachments.all(page.body, { extension: 'pdf' })
  //
  // 3. May be any office-oriented file type
  //
  // apos.attachments.all(page.body, { group: 'office' })
  //
  // apos.images.all is a convenience wrapper for fetching only images.
  //
  // OPTIONS:
  //
  // You may specify `extension`, `extensions` (an array of extensions)
  // or `group` to filter the results.

  self.all = function(within, options) {
    options = options || {};

    function test(attachment) {
      if ((!attachment) || (typeof(attachment) !== 'object')) {
        return false;
      }
      if (attachment.type !== 'attachment') {
        return false;
      }
      if (options.extension) {
        if (attachment.extension !== options.extension) {
          return false;
        }
      }
      if (options.group) {
        if (attachment.group !== options.group) {
          return false;
        }
      }
      if (options.extensions) {
        if (!_.contains(options.extensions, attachment.extension)) {
          return false;
        }
      }
      return true;
    }

    var winners = [];
    if (!within) {
      return [];
    }
    self.apos.docs.walk(within, function(o, key, value, dotPath, ancestors) {
      if (test(value)) {
        // If one of our ancestors has a relationship to the piece that
        // immediately contains us, provide that as the crop. This ensures
        // that cropping coordinates stored in an apostrophe-images widget
        // are passed through when we make a simple call to
        // apos.attachments.url with the returned object
        var i;
        for (i = ancestors.length - 1; (i >= 0); i--) {
          var ancestor = ancestors[i];
          if (ancestor.relationships && ancestor.relationships[o._id]) {
            // Clone it so that if two things have crops of the same image, we
            // don't overwrite the value on subsequent calls
            value = _.clone(value);
            value._crop = ancestor.relationships[o._id];
            break;
          }
        }
        winners.push(value);
      }
    });
    return winners;
  };

  // Iterates over all of the attachments that exist, processing
  // up to `limit` attachments at any given time.
  //
  // If only 3 arguments are given the limit defaults to 1.
  //
  // For use only in command line tasks, migrations and other batch operations
  // in which permissions are a complete nonissue. NEVER use on the front end.

  self.each = function(criteria, limit, each, callback) {
    if (arguments.length === 3) {
      callback = each;
      each = limit;
      limit = 1;
    }

    // "Why do we fetch a bucket of attachments at a time?" File operations
    // can be very slow. This can lead to MongoDB cursor timeouts in
    // tasks like apostrophe-attachments:rescale. We need a robust solution that
    // does not require keeping a MongoDB cursor open too long. So we fetch
    // all of the IDs up front, then fetch buckets of "bucketSize" file objects
    // at a time and feed those through async.eachLimit. This is a
    // better compromise between RAM usage and reliability. -Tom

    var ids;
    var i = 0;
    var n = 0;
    var bucketSize = 100;
    return async.series({
      getIds: function(callback) {
        return self.db.find(criteria, { _id: 1 }).toArray(function(err, infos) {
          if (err) {
            return callback(err);
          }
          ids = _.pluck(infos, '_id');
          n = ids.length;
          return callback(null);
        });
      },
      processBuckets: function(callback) {
        return async.whilst(function() {
          return (i < n);
        }, function(callback) {
          var bucket = ids.slice(i, i + bucketSize);
          i += bucketSize;
          return self.db.find({ _id: { $in: bucket } }).toArray(function(err, files) {
            if (err) {
              return callback(err);
            }
            return async.eachLimit(files, limit, each, callback);
          });
        }, callback);
      }
    }, callback);
  };

  self.middleware = {
    canUpload: function(req, res, next) {
      if (!self.apos.permissions.can(req, 'edit-attachment')) {
        res.statusCode = 403;
        return res.send("forbidden");
      }
      next();
    }
  };

  self.addTypeMigration = function() {

    self.apos.migrations.add(self.__meta.name + '.addType', function(callback) {

      var needed;

      return async.series([ needed, attachments, docs ], callback);

      function needed(callback) {
        return self.db.findOne({ type: { $exists: 0 } }, function(err, found) {
          if (err) {
            return callback(err);
          }
          needed = !!found;
          return callback(null);
        });
      }

      function attachments(callback) {
        if (!needed) {
          return setImmediate(callback);
        }
        return self.db.update({}, { $set: { type: 'attachment' } }, { multi: true }, callback);
      }

      function docs(callback) {
        if (!needed) {
          return setImmediate(callback);
        }
        return self.apos.migrations.eachDoc({}, function(doc, callback) {
          var changed = false;
          self.apos.docs.walk(doc, function(o, key, value) {
            // Sniff out attachments in a database that predates the
            // type property for them
            if (value && (typeof(value) === 'object') && value.extension && value.md5 && value.group && value._id && value.group) {
              value.type = 'attachment';
              changed = true;
            }
          });
          if (!changed) {
            return setImmediate(callback);
          }
          self.apos.docs.db.update({ _id: doc._id }, doc, callback);
        }, callback);
      }
    }, {
      safe: true
    });

  };

}
