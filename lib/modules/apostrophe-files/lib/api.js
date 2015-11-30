var _ = require('lodash');
var fs = require('fs');
var async = require('async');
var path = require('path');
var crypto = require('crypto');
var joinr = require('joinr');

module.exports = function(self, options) {
  // Accept one or more files, as submitted by an HTTP file upload.
  // req is checked for permissions. The callback receives an error if any
  // followed by an array of new file objects as stored in aposFiles.
  //
  // "files" should be an array of objects with "name" and "path"
  // properties, or a single such object. "name" must be the name the
  // user claims for the file, while "path" must be the actual full path
  // to the file on disk and need not have any file extension necessarily.
  //
  // (Note that when using Express to handle file uploads,
  // req.files['yourfieldname'] will be such an array or object.)

  self.accept = function(req, files, callback) {
    var newFiles = files;
    if (!(newFiles instanceof Array)) {
      newFiles = [ newFiles ];
    }
    var infos = [];
    return async.map(newFiles, function(file, callback) {
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
        _id: self.apos.utils.generateId(),
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
            info._owner = req.user;
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
          return self.uploadfs.copyIn(file.path, '/files/' + info._id + '-' + info.name + '.' + info.extension, callback);
        }
      }

      function db(callback) {
        // TODO port permissions
        info.ownerId = self.apos.permissions.getEffectiveUserId(req);
        self.files.insert(info, { safe: true }, function(err, docs) {
          if (!err) {
            infos.push(docs[0]);
          }
          return callback(err);
        });
      }

      async.series([ permissions, md5, upload, db ], callback);

    }, function(err) {
      if (err) {
        return callback(err);
      } else {
        return callback(err, infos);
      }
    });
  };

  // Fetch files according to the parameters specified by the
  // `options` object: `owners`, `group`, `owner`, `extension`,
  // `ids`, `q`, `limit`, `skip` and `minSize`. These properties
  // are sanitized to ensure they are in the proper format; that makes
  // this method suitable for use in the implementation of API routes.
  // A wrapper for `apos.get` which always sets the
  // `browsing` option to restrict permissions to files
  // this user is allowed to browse even if they are not
  // already on a page.

  self.browse = function(req, options, callback) {
    var newOptions = {};
    if (options.group) {
      newOptions.group = self.apos.launder.string(options.group);
    }
    if (options.owner === 'user' || options.owner === 'all' ) {
      newOptions.owner = options.owner;
    }

    newOptions.owners = self.apos.launder.boolean(options.owners);

    if (options.ids) {
      newOptions.ids = self.apos.launder.ids(options.ids);
    }
    if (options.q) {
      newOptions.q = self.apos.launder.string(options.q);
    }
    if (options.extension) {
      if (Array.isArray(options.extension)) {
        newOptions.extension = _.filter(options.extension, function(extension) {
          return self.apos.launder.string(extension);
        });
      } else {
        newOptions.extension = self.apos.launder.string(options.extension);
        newOptions.extension = newOptions.extension.split(',');
      }
    }
    if (options.limit) {
      newOptions.limit = self.apos.launder.integer(options.limit, 0, 0);
    }
    if (options.skip) {
      newOptions.skip = self.apos.launder.integer(options.skip, 0, 0);
    }
    if (options.page) {
      var page = self.apos.launder.integer(options.page);
      newOptions.limit = self.perPage;
      newOptions.skip = (page - 1) * self.perPage;
    }
    if (options.minSize) {
      newOptions.minSize = [
        self.apos.launder.integer(options.minSize[0], 0, 0),
        self.apos.launder.integer(options.minSize[1], 0, 0)
      ];
    }
    if (options.ownerId) {
      newOptions.ownerId = self.apos.launder.id(options.ownerId);
    }
    if (options.tags) {
      newOptions.tags = self.apos.launder.tags(options.tags);
    }
    if (options.notTags) {
      newOptions.notTags = self.apos.launder.tags(options.notTags);
    }
    if (options.tag) {
      newOptions.tag = self.apos.launder.string(options.tag);
    }
    newOptions.browsing = true;
    newOptions.trash = options.trash;

    // trash is always sanitized in get
    return self.get(req, newOptions, callback);
  };

  // Options are:
  //
  // group, extension, trash, skip, limit, q, minSize, ids, browsing
  //
  // The minSize option should be an array: [width, height]
  //
  // req is present to check identity and view permissions.
  //
  // Options must be pre-sanitized. See self.browse
  // for a wrapper that sanitizes the options so you can pass req.query.
  // For performance we don't want to sanitize on every page render that
  // just needs to join with previously chosen files.
  //
  // If the current user may edit a file it is given a ._edit = true property.
  //
  // For performance reasons, the _owner property is populated only if
  // options.owners is true.
  //
  // If the `browsing` option is true, files marked private
  // are returned only if this user is an admin or the owner
  // of the file.

  self.get = function(req, options, callback) {
    var criteria = {};
    var limit = 10;
    var skip = 0;
    var q;
    if (options.group) {
      criteria.group = options.group;
    }
    if (options.ids) {
      criteria._id = { $in: options.ids };
    }
    if (options.owner === 'user') {
      criteria.ownerId = self.apos.permissions.getEffectiveUserId(req);
    }
    if (options.ownerId) {
      criteria.ownerId = options.ownerId;
    }
    if (options.tags || options.notTags) {
      criteria.tags = { };
      if (options.tags) {
        criteria.tags.$in = options.tags;
      }
      if (options.notTags) {
        criteria.tags.$nin = options.notTags;
      }
    }

    if (options.extension) {
      criteria.extension = { };
      if (options.extension) {
        criteria.extension.$in = options.extension;
      }
    }

    if (options.tag) {
      criteria.tags = { $in: [ options.tag ] };
    }
    self.apos.launder.addBooleanFilterToCriteria(options, 'trash', criteria, '0');
    if (options.minSize) {
      criteria.width = { $gte: options.minSize[0] };
      criteria.height = { $gte: options.minSize[1] };
    }

    if (options.browsing) {
      // Unless they are admin of all files, they
      // cannot browse a file unless (1) they own it
      // or (2) it is not private
      if (!self.apos.permissions.can(req, 'admin-file')) {
        criteria.$or = [
          {
            ownerId: self.apos.permissions.getEffectiveUserId(req)
          },
          {
            private: { $ne: true }
          }
        ];
      }
    }

    skip = self.apos.launder.integer(options.skip, 0, 0);
    limit = self.apos.launder.integer(options.limit, 0, 0, 100);
    if (options.q) {
      criteria.searchText = self.searchify(options.q);
    }
    var result = {};
    var possibleEditor = false;
    async.series({
      permissions: function(callback) {
        possibleEditor = self.apos.permissions.can(req, 'edit-file');
        return callback(null);
      },
      count: function(callback) {
        return self.files.count(criteria, function(err, count) {
          result.total = count;
          return callback(err);
        });
      },
      find: function(callback) {
        return self.files.find(criteria).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(function(err, files) {
          result.files = files;
          // For security's sake remove this stale data that should never
          // have been serialized to the database
          _.each(files, function(file) {
            delete file._owner;
          });
          self.apos.permissions.annotate(req, 'edit-file', result.files);
          return callback(err);
        });
      },
      tags: function(callback) {
        delete criteria.tags;
        return self.files.distinct('tags', criteria, function(err, _tags) {
          if (err) {
            return callback(err);
          }
          result.tags = _tags;
          result.tags.sort();
          return callback(null);
        });
      },
      join: function(callback) {
        if (!options.owners) {
          // Don't do slow things all the time
          return callback(null);
        }
        console.error('TODO: put back join with owners');
        return setImmediate(callback);
        // // Dynamically rebuild the ._owner properties
        // return joinr.byOne(result.files, 'ownerId', '_owner', function(ids, callback) {
        //   self.pages.find({ _id: { $in: ids } }).toArray(function(err, owners) {
        //     if (err) {
        //       return callback(err);
        //     }
        //     // For security reasons it's a terrible idea to return
        //     // an entire person object
        //     var newOwners = _.map(owners, function(owner) {
        //       return _.pick(owner, '_id', 'title');
        //     });
        //     return callback(null, newOwners);
        //   });
        // }, callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, result);
    });
  };

  // Exactly the same as apos.files.get, except that it
  // delivers (null, single object) to the callback. If there
  // is no result it delivers (null, null). "No matching
  // file" is NOT an error condition.

  self.getOne = function(req, options, callback) {
    return self.get(req, options, function(err, result) {
      if (err) {
        return callback(err);
      }
      return callback(null, result.files[0]);
    });
  };

  /**
   * Move the specified file in or out of the trash. If trash is true,
   * trash it, otherwise rescue it.
   * @param  {Request}   req      request object
   * @param  {string}   id       id of file
   * @param  {boolean}   trash    true for trash, false for rescue
   * @param  {Function} callback Receives error if any
   */
  self.updateTrash = function(req, id, trash, callback) {
    id = self.apos.launder.string(id);
    if (!id.length) {
      return callback('invalid');
    }
    var results = [];
    var info;

    var criteria = {
      _id: id
    };
    if (trash) {
      criteria.trash = { $ne: true };
    } else {
      criteria.trash = true;
    }

    return async.series({
      get: function(callback) {
        return self.files.findOne(criteria, function(err, _info) {
          info = _info;
          if (err) {
            return callback(err);
          }
          if (!info) {
            return callback('notfound');
          }
          return callback(null);
        });
      },
      permissions: function(callback) {
        return callback(self.apos.permissions.can(req, 'edit-file', info) ? null : 'forbidden');
      },
      update: function(callback) {
        var update;
        if (trash) {
          update = { $set: { trash: true } };
        } else {
          update = { $unset: { trash: 1 } };
        }
        return self.files.update(criteria,
          update, function(err, count) {
          if (err || (!count)) {
            return callback('notfound');
          } else {
            return callback(null);
          }
        });
      },
      uploadfs: function(callback) {
        return self.hideInUploadfs(info, trash, callback);
      }
    }, callback);
  };

  // Given a file object, hide it in uploadfs (if trash is true),
  // or make it web-accessible again (if trash is false). Normally
  // called only by apos.updateTrash but it is also invoked by the
  // apostrophe:hide-trash legacy migration task.

  self.hideInUploadfs = function(file, trash, callback) {
    var info = file;
    return async.series({
      disableOriginal: function(callback) {
        var name = '/files/' + info._id + '-' + info.name + '.' + info.extension;
        var method = trash ? self.uploadfs.disable : self.uploadfs.enable;
        return method(name, callback);
      },
      disableSizes: function(callback) {
        if (info.group !== 'images') {
          return callback(null);
        }
        return async.eachSeries(self.uploadfs.getImageSizes(),
          function(size, callback) {
            if (self.trashImageSize === size.name) {
              // We preserve this particular size for the sake of
              // the admin interface to the trash folder
              return callback(null);
            }
            var name = '/files/' + info._id + '-' + info.name + '.' + size.name + '.' + info.extension;
            var method = trash ? self.uploadfs.disable : self.uploadfs.enable;
            return method(name, callback);
          }, callback);
      }
    }, callback);
  };

  // Determine the search text for a file object, based on its
  // filename, title, credit, tags, description, extension, group
  // (images or office), and owner's name.
  //
  // The callback is optional. If it is provided, and
  // file._owner is not already set, the owner will be
  // fetched on the fly.

  self.searchText = function(file, callback) {

    function _fileSearchText(file) {
      return _.map([ file.name, file.title, file.credit ].concat(
          file.tags || []).concat(
          [file.description, file.extension, file.group ]).concat(
          (file.extension === 'jpg') ? [ 'jpeg '] : []).concat(
          (file._owner ? [ file._owner.title ] : [])),
        function(s) {
          return self.apos.utils.sortify(s);
        }
      ).join(' ');
    }

    if (arguments.length === 1) {
      return _fileSearchText(file);
    }
    var owner;
    var s;
    return async.series({
      getOwner: function(callback) {
        // A workaround for the hardcoded admin user
        if (file.ownerId === 'admin') {
          file._owner = { title: 'admin' };
        }
        // If already known we can skip the query
        if (file._owner) {
          return setImmediate(callback);
        }
        self.pages.findOne({ _id: file.ownerId }, function(err, _owner) {
          if (err) {
            return callback(err);
          }
          file._owner = _owner;
          return callback(null);
        });
      },
      searchText: function(callback) {
        s = _fileSearchText(file);
        return callback(null);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, s);
    });
  };

  // Perform an md5 checksum on a file. Returns hex string. Via:
  // http://nodejs.org/api/crypto.html
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

  // Given a file object (as found in a slideshow widget for instance),
  // return the file URL. If options.size is set, return the URL for
  // that size (one-third, one-half, two-thirds, full). full is
  // "full width" (1140px), not the original. For the original, don't pass size.
  // If the "uploadfsPath" option is true, an
  // uploadfs path is returned instead of a URL.

  self.url = function(file, options) {
    options = options || {};

    var path = '/files/' + file._id + '-' + file.name;
    if (!options.uploadfsPath) {
      path = self.uploadfs.getUrl() + path;
    }
    var c = options.crop || file.crop;
    if (c && c.left) {
      path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
    }
    if (options.size) {
      path += '.' + options.size;
    }
    return path + '.' + file.extension;
  };
};
