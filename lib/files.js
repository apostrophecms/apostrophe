var hash_file = require('hash_file');
var _ = require('underscore');
var fs = require('fs');
var async = require('async');
var path = require('path');
var extend = require('extend');

/**
 * files
 * @augments Augments the apos object with methods, routes and
 * properties supporting the management of media files (images, PDFs, etc.)
 * uploaded by users.
 * @see static
 */

module.exports = function(self) {
  self.fileGroups = [
    {
      name: 'images',
      label: 'Images',
      extensions: [ 'gif', 'jpg', 'png' ],
      extensionMaps: {
        jpeg: 'jpg'
      },
      // uploadfs should treat this as an image and create scaled versions
      image: true
    },
    {
      name: 'office',
      label: 'Office',
      extensions: [ 'txt', 'rtf', 'pdf', 'xls', 'ppt', 'doc', 'pptx', 'sldx', 'ppsx', 'potx', 'xlsx', 'xltx', 'docx', 'dotx' ],
      extensionMaps: {},
      // uploadfs should just accept this file as-is
      image: false
    },
  ];

  self.areaFindFile = function(options) {
    if (!options) {
      options = {};
    }
    var area = options.area;
    var winningFile;
    if (!(area && area.items)) {
      return false;
    }
    _.some(area.items, function(item) {
      // The slideshow, files and similar widgets use an 'items' array
      // to store files. Let's look there, and also allow for '_items' to
      // support future widgets that pull in files dynamically. However
      // we also must make sure the items are actually files by making
      // sure they have an `extension` property. (TODO: this is a hack,
      // think about having widgets register to participate in this.)
      if (!item._items) {
        return false;
      }
      var file = _.find(item._items, function(file) {
        if (file.extension === undefined) {
          return false;
        }
        if (options.extension) {
          if (file.extension !== options.extension) {
            return false;
          }
        }
        if (options.group) {
          if (file.group !== options.group) {
            return false;
          }
        }
        if (options.extensions) {
          if (!_.contains(options.extensions, file.extension)) {
            return false;
          }
        }
        return true;
      });
      if (file) {
        winningFile = file;
      }
    });
    return winningFile;
  };

  // Upload files
  self.app.post('/apos/upload-files', function(req, res) {
    var newFiles = req.files.files;
    if (!(newFiles instanceof Array)) {
      newFiles = [ newFiles ];
    }
    var infos = [];
    async.map(newFiles, function(file, callback) {
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
        _id: self.generateId(),
        length: file.length,
        group: group.name,
        createdAt: new Date(),
        name: self.slugify(path.basename(file.name, path.extname(file.name))),
        title: self.sortify(path.basename(file.name, path.extname(file.name))),
        extension: extension
      };

      function permissions(callback) {
        self.permissions(req, 'edit-media', null, callback);
      }

      function md5(callback) {
        return self.md5File(file.path, function(err, md5) {
          if (err) {
            return callback(err);
          }
          info.md5 = md5;
          return callback(null);
        });
      }

      // If a duplicate file is uploaded, quietly reuse the old one to
      // avoid filling the hard drive
      //
      // This has been quietly removed for now. It could be an option
      // later, but at the moment on rare occasions people will need
      // two copies in order to have two titles. TODO: address that
      // more gracefully.
      //
      // function reuseOrUpload(callback) {
      //   return files.findOne({ md5: info.md5 }, function(err, existing) {
      //     if (err) {
      //       return callback(err);
      //     }
      //     if (existing) {
      //       infos.push(existing);
      //       return callback(null);
      //     } else {
      //       async.series([upload, db], callback);
      //     }
      //   });
      // }

      function upload(callback) {
        if (image) {
          // For images we correct automatically for common file extension mistakes
          return self.uploadfs.copyImageIn(file.path, '/files/' + info._id + '-' + info.name, function(err, result) {
            if (err) {
              return callback(err);
            }
            info.extension = result.extension;
            info.width = result.width;
            info.height = result.height;
            info.searchText = self.fileSearchText(info);
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
          return self.uploadfs.copyIn(file.path, '/files/' + info._id + '-' + info.name + '.' + info.extension, callback);
        }
      }

      function db(callback) {
        info.ownerId = req.user && req.user._id;
        self.files.insert(info, { safe: true }, function(err, docs) {
          if (!err) {
            infos.push(docs[0]);
          }
          return callback(err);
        });
      }

      async.series([ permissions, md5, upload, db ], callback);

    }, function(err) {
      return res.send({ files: infos, status: 'ok' });
    });
  });

  // Replace one file. TODO: reduce redundancy with
  // /apos/upload-files

  self.app.post('/apos/replace-file', function(req, res) {
    var id = req.query.id;
    return self.files.findOne({ _id: id }, function(err, file) {
      if (err || (!file)) {
        return self.fail(req, res);
      }
      // Permissions: if you're not an admin you must own the file
      if (!req.user.permissions.admin) {
        if (file.ownerId !== req.user._id) {
          return self.fail(req, res);
        }
      }
      var newFiles = req.files.files;
      if (!(newFiles instanceof Array)) {
        newFiles = [ newFiles ];
      }
      if (!newFiles.length) {
        return self.fail(req, res);
      }
      // The last file is the one we're interested in if they
      // somehow send more than one
      var upload = newFiles.pop();
      var extension = path.extname(upload.name);
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
        res.statusCode = 400;
        return res.send("File extension not accepted. Acceptable extensions: " + accepted.join(", "));
      }
      // Don't mess with previously edited metadata, but do allow
      // the actual filename, extension, etc. to be updated
      var image = group.image;
      extend(file, {
        length: file.length,
        group: group.name,
        createdAt: new Date(),
        name: self.slugify(path.basename(upload.name, path.extname(upload.name))),
        extension: extension
      });

      function permissions(callback) {
        self.permissions(req, 'edit-media', null, callback);
      }

      function md5(callback) {
        return self.md5File(upload.path, function(err, md5) {
          if (err) {
            return callback(err);
          }
          file.md5 = md5;
          return callback(null);
        });
      }

      // If a duplicate file is uploaded, quietly reuse the old one to
      // avoid filling the hard drive
      //
      // Quietly removed for now due to issues with the occasional need
      // for two copies to allow two titles. Now that we have a good
      // media library automatic duplicate prevention is less urgent.
      //
      // function reuseOrUpload(callback) {
      //   return files.findOne({ md5: info.md5 }, function(err, existing) {
      //     if (err) {
      //       return callback(err);
      //     }
      //     if (existing) {
      //       infos.push(existing);
      //       return callback(null);
      //     } else {
      //       async.series([upload, db], callback);
      //     }
      //   });
      // }

      function copyIn(callback) {
        if (image) {
          // For images we correct automatically for common file extension mistakes
          return self.uploadfs.copyImageIn(upload.path, '/files/' + file._id + '-' + file.name, function(err, result) {
            if (err) {
              return callback(err);
            }
            file.extension = result.extension;
            file.width = result.width;
            file.height = result.height;
            file.searchText = self.fileSearchText(file);
            if (file.width > file.height) {
              file.landscape = true;
            } else {
              file.portrait = true;
            }
            return callback(null);
          });
        } else {
          // For non-image files we have to trust the file extension
          // (but we only serve it as that content type, so this should
          // be reasonably safe)
          return self.uploadfs.copyIn(upload.path, '/files/' + file._id + '-' + file.name + '.' + file.extension, callback);
        }
      }

      function db(callback) {
        self.files.update({ _id: file._id }, file, function(err, count) {
          return callback(err);
        });
      }

      async.series([ permissions, md5, copyIn, db ], function(err) {
        if (err) {
          return self.fail(req, res);
        }
        return res.send({ file: file, status: 'ok' });
      });
    });
  });

  // Crop a previously uploaded image. This uploads a new, cropped version of
  // it to uploadfs, named /files/ID-NAME.top.left.width.height.extension
  self.app.post('/apos/crop', function(req, res) {
    var _id = req.body._id;
    var crop = req.body.crop;
    var file;
    async.series([
      function(callback) {
        return self.permissions(req, 'edit-media', null, callback);
      },
      function(callback) {
        self.files.findOne({ _id: _id }, function(err, fileArg) {
          file = fileArg;
          return callback(err);
        });
      }
    ], function(err) {
      if (!file) {
        console.log(err);
        return self.fail(req, res);
      }
      file.crops = file.crops || [];
      var existing = _.find(file.crops, function(iCrop) {
        if (_.isEqual(crop, iCrop)) {
          return true;
        }
      });
      if (existing) {
        // We're done, this crop is already available
        return res.send('OK');
      }
      // Pull the original out of cloud storage to a temporary folder where
      // it can be cropped and popped back into uploadfs
      var originalFile = '/files/' + file._id + '-' + file.name + '.' + file.extension;
      var tempFile = self.uploadfs.getTempPath() + '/' + self.generateId() + '.' + file.extension;
      var croppedFile = '/files/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;

      async.series([
        function(callback) {
          self.uploadfs.copyOut(originalFile, tempFile, callback);
        },
        function(callback) {
          self.uploadfs.copyImageIn(tempFile, croppedFile, { crop: crop }, callback);
        },
        function(callback) {
          file.crops.push(crop);
          self.files.update({ _id: file._id }, file, callback);
        }
      ], function(err) {
        // We're done with the temp file. We don't care if it was never created.
        fs.unlink(tempFile, function() { });
        if (err) {
          res.statusCode = 404;
          return res.send('Not Found');
        } else {
          return res.send('OK');
        }
      });
    });
  });

  self.app.get('/apos/browse-files', function(req, res) {
    return self.permissions(req, 'edit-media', null, function(err) {
      if (err) {
        res.statusCode = 404;
        return res.send('not found');
      }
      return self.getFilesSanitized(req, req.query, function(err, result) {
        if (err) {
          res.statusCode = 500;
          return res.send('error');
        }
        return res.send(result);
      });
    });
  });

  self.getFilesSanitized = function(req, options, callback) {
    var newOptions = {};
    if (options.group) {
      newOptions.group = self.sanitizeString(options.group);
    }
    if (options.extension) {
      newOptions.extension = self.sanitizeString(options.extension);
    }
    if (options.ids) {
      newOptions.ids = [];
      _.each(Array.isArray(options.ids) || [], function(id) {
        newOptions.ids.push(self.sanitizeString(id));
      });
    }
    if (options.q) {
      newOptions.q = self.sanitizeString(options.q);
    }
    if (options.limit) {
      newOptions.limit = self.sanitizeInteger(options.limit, 0, 0);
    }
    if (options.skip) {
      newOptions.skip = self.sanitizeInteger(options.skip, 0, 0);
    }
    if (options.minSize) {
      newOptions.minSize = [
        options.sanitizeInteger(options.minSize[0], 0, 0),
        options.sanitizeInteger(options.minSize[1], 0, 0)
      ];
    }
    // trash is always sanitized in getFiles
    return self.getFiles(req, options, callback);
  };

  // Options are:
  //
  // group, extension, trash, skip, limit, q, minSize, ids
  //
  // The minSize option should be an array: [width, height]
  //
  // req is present to check view permissions (not yet needed, but
  // required for compatibility).
  //
  // Options must be pre-sanitized. See self.getFilesSanitized
  // for a wrapper that sanitizes the options so you can pass req.query.
  // For performance we don't want to sanitize on every page render that
  // just needs to join with previously chosen files.

  self.getFiles = function(req, options, callback) {
    var criteria = {};
    var limit = 10;
    var skip = 0;
    var q;
    if (options.group) {
      criteria.group = options.group;
    }
    if (options.extension) {
      criteria.extension = options.extension;
    }
    if (options.ids) {
      criteria._id = { $in: options.ids };
    }
    self.convertBooleanFilterCriteria('trash', options, criteria, '0');
    if (options.minSize) {
      criteria.width = { $gte: options.minSize[0] };
      criteria.height = { $gte: options.minSize[1] };
    }
    skip = self.sanitizeInteger(options.skip, 0, 0);
    limit = self.sanitizeInteger(options.limit, 0, 0, 100);
    if (options.q) {
      criteria.searchText = self.searchify(options.q);
    }
    var result = {};
    async.series([
      function(callback) {
        return self.files.count(criteria, function(err, count) {
          result.total = count;
          return callback(err);
        });
      },
      function(callback) {
        return self.files.find(criteria).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(function(err, files) {
          result.files = files;
          return callback(err);
        });
      }
    ], function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, result);
    });
  };

  // Annotate previously uploaded files
  self.app.post('/apos/annotate-files', function(req, res) {
    // make sure we have permission to edit files at all
    return self.permissions(req, 'edit-media', null, function(err) {
      if (err) {
        res.statusCode = 400;
        return res.send('invalid');
      }
      if (!Array.isArray(req.body)) {
        res.statusCode = 400;
        return res.send('invalid');
      }
      var criteria = { _id: { $in: _.pluck(req.body, '_id') } };
      // Verify permission to edit this particular file. TODO: this
      // should not be hardcoded here, but it does need to remain an
      // efficient query. Classic Apostrophe media permissions: if you
      // put it here, you can edit it. If you're an admin, you can edit it.
      if (!req.user.permissions.admin) {
        criteria.ownerId = req.user._id;
      }
      var results = [];
      return self.files.find(criteria).toArray(function(err, files) {
        return async.eachSeries(files, function(file, callback) {
          var annotation = _.find(req.body, function(item) {
            return item._id === file._id;
          });
          if (!annotation) {
            return callback('unexpected');
          }
          file.title = self.sanitizeString(annotation.title);
          file.description = self.sanitizeString(annotation.description);
          file.credit = self.sanitizeString(annotation.credit);
          file.tags = self.sanitizeTags(annotation.tags);
          results.push(file);
          return self.files.update({ _id: file._id }, file, callback);
        }, function(err) {
          if (err) {
            res.statusCode = 500;
            return res.send('error');
          }
          return res.send(results);
        });
      });
    });
  });

  // Delete previously uploaded file
  self.app.post('/apos/delete-file', function(req, res) {
    // make sure we have permission to edit files at all
    return self.permissions(req, 'edit-media', null, function(err) {
      if (err) {
        res.statusCode = 400;
        return res.send('invalid');
      }
      if (typeof(req.body) !== 'object') {
        res.statusCode = 400;
        return res.send('invalid');
      }
      var criteria = { _id: req.body._id };
      // Verify permission to edit this particular file. TODO: this
      // should not be hardcoded here, but it does need to remain an
      // efficient query. Classic Apostrophe media permissions: if you
      // put it here, you can edit it. If you're an admin, you can edit it.
      if (!req.user.permissions.admin) {
        criteria.ownerId = req.user._id;
      }
      var results = [];
      return self.files.update(criteria, { $set: { trash: true } }, function(err, count) {
        if (err || (!count)) {
          res.statusCode = 404;
          return res.send('not found');
        } else {
          return res.send({ 'status': 'deleted' });
        }
      });
    });
  });

  // Undelete previously uploaded file TODO refactor these two methods
  // to use the same implementation
  self.app.post('/apos/rescue-file', function(req, res) {
    // make sure we have permission to edit files at all
    return self.permissions(req, 'edit-media', null, function(err) {
      if (err) {
        res.statusCode = 400;
        return res.send('invalid');
      }
      if (typeof(req.body) !== 'object') {
        res.statusCode = 400;
        return res.send('invalid');
      }
      var criteria = { _id: req.body._id };
      // Verify permission to edit this particular file. TODO: this
      // should not be hardcoded here, but it does need to remain an
      // efficient query. Classic Apostrophe media permissions: if you
      // put it here, you can edit it. If you're an admin, you can edit it.
      if (!req.user.permissions.admin) {
        criteria.ownerId = req.user._id;
      }
      var results = [];
      return self.files.update(criteria, { $unset: { trash: true } }, function(err, count) {
        if (err || (!count)) {
          res.statusCode = 404;
          return res.send('not found');
        } else {
          return res.send({ 'status': 'rescued' });
        }
      });
    });
  });

  self.filePermissions = function(req, action, file, callback) {
    if (action === 'view-file') {
      return callback(null);
    }
    // Assume everything else is an editing operation
    // Note that self.permissions already let it through if
    // the user is an admin
    if (req.user && (file.ownerId === req.user._id)) {
      return callback(null);
    }
    return callback('Forbidden');
  };


  // Determine search text based on a file object
  self.fileSearchText = function(file) {
    var s = file.name.replace(/\-/g, ' ') + ' ' + file.extension + ' ' + file.group;
    if (file.extension === 'jpg') {
      s += ' jpeg';
    }
    return s;
  };
};
