var _ = require('@sailshq/lodash');
var async = require('async');
var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
const exif = require('jpeg-exif');

module.exports = function(self, options) {

  // For backwards compatibility. Equivalent to calling `insert` with
  // the same three arguments.

  self.accept = function(req, file, callback) {
    self.insert(req, file, { permissions: true }, callback);
  };

  // Insert a file as an Apostrophe attachment. The `file` object
  // should be an object with `name` and `path` properties.
  // `name` must be the name the user claims for the file, while `path`
  // must be the actual full path to the file on disk and need not have
  // any file extension necessarily.
  //
  // Note that when using Express to handle file uploads,
  // req.files['yourfieldname'] will be such an object as long as you
  // configure jquery fileupload to submit one per request.
  //
  // The `options` argument may be omitted completely.
  // If `options.permissions` is explicitly set to `false`,
  // permissions are not checked.
  //
  // `callback` is invoked with `(null, attachment)` where
  // `attachment` is an attachment object, suitable
  // for passing to the `url` API and for use as the value
  // of an `type: 'attachment'` schema field.
  //
  // If `callback` is omitted completely, a promise is returned.
  // The promise resolves to an attachment object.

  self.insert = function(req, file, options, callback) {

    if (typeof (arguments[2]) !== 'object') {
      callback = arguments[2];
      options = {};
    }

    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }

    function body(callback) {

      var extension = path.extname(file.name);
      if (extension && extension.length) {
        extension = extension.substr(1).toLowerCase();
      }
      // Do we accept this file extension?
      var group = self.getFileGroup(extension);
      if (!group) {
        var accepted = _.union(_.pluck(self.fileGroups, 'extensions'));
        return callback("File extension not accepted. Acceptable extensions: " + accepted.join(","));
      }
      var info = {
        _id: self.apos.utils.generateId(),
        group: group.name,
        createdAt: new Date(),
        name: self.apos.utils.slugify(path.basename(file.name, path.extname(file.name))),
        title: self.apos.utils.sortify(path.basename(file.name, path.extname(file.name))),
        extension: extension,
        type: 'attachment',
        docIds: [],
        trashDocIds: []
      };

      function permissions(callback) {
        if (options && (options.permissions === false)) {
          return callback(null);
        }
        return callback(self.apos.permissions.can(req, 'edit-attachment') ? null : 'forbidden');
      }

      function length(callback) {
        return self.apos.utils.fileLength(file.path, function(err, size) {
          if (err) {
            return callback(err);
          }
          info.length = size;
          return callback(null);
        });
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
        const targetPath = '/attachments/' + info._id + '-' + info.name;

        if (self.isSized(extension)) {
          // For images we correct automatically for common file extension mistakes
          return self.uploadfs.copyImageIn(file.path, targetPath, function(err, result) {
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

            if (info.extension === 'jpg') {
              return exif.parse(file.path, (err, exifData) => {
                if (err) {
                  self.apos.utils.error('jpeg-exif error:', err);
                  return callback(null);
                }

                const data = exifData;

                if (!data) { return callback(null); }

                info.description = data.ImageDescription ? data.ImageDescription.trim() : null;

                if (data.Make && data.Model) {
                  info.camera = data.Make.trim() + ' ' + data.Model.trim();
                } else if (data.Model) {
                  info.camera = data.Model.trim();
                }

                info.captureDate = data.DateTime ? data.DateTime : null;
                info.credit = data.Copyright ? data.Copyright.trim() : null;

                return callback(null);
              });
            } else {
              return callback(null);
            }
          });
        } else {
          // For non-image files we have to trust the file extension
          // (but we only serve it as that content type, so this should
          // be reasonably safe)
          return self.uploadfs.copyIn(file.path, targetPath + '.' + info.extension, callback);
        }
      }

      function remember(callback) {
        if ((!options) || (options.permissions !== false)) {
          info.ownerId = self.apos.permissions.getEffectiveUserId(req);
        }
        info.createdAt = new Date();
        return self.db.insert(info, callback);
      }

      return async.series([ permissions, length, md5, upload, remember ], function(err) {
        return callback(err, info);
      });
    }

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
      if (err) {
        return callback(err);
      }
      if (!info) {
        return callback('notfound');
      }
      if (!self.croppable[info.extension]) {
        return callback(new Error(info.extension + ' files cannot be cropped, do not present cropping UI for this type'));
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
    var group = _.find(self.fileGroups, 'name', source.group);

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
    });
  };

  // This method return a default icon url if an attachment is missing
  // to avoid template errors

  self.getMissingAttachmentUrl = function() {
    var defaultIconUrl = '/modules/apostrophe-attachments/img/missing-icon.svg';
    self.apos.utils.warn('Template warning: Impossible to retrieve the attachment url since it is missing, a default icon has been set. Please fix this ASAP!');
    return defaultIconUrl;
  };

  // This method is available as a template helper: apos.attachments.url
  //
  // Given an attachment object,
  // return the URL. If options.size is set, return the URL for
  // that size (one-third, one-half, two-thirds, full). full is
  // "full width" (1140px), not the original. For the original,
  // pass `original`. If size is not specified, you will receive
  // the `full` size if an image, otherwise the original.
  //
  // If the "uploadfsPath" option is true, an
  // uploadfs path is returned instead of a URL.

  self.url = function(attachment, options) {
    options = options || {};

    if (!attachment) {
      return self.getMissingAttachmentUrl();
    }

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
    if ((!self.isSized(attachment)) || (options.size === 'original')) {
      effectiveSize = false;
    } else {
      effectiveSize = options.size || 'full';
    }
    if (effectiveSize) {
      path += '.' + effectiveSize;
    }
    // Do NOT use resolveExtension because we need to link to the actual
    // name of the file
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
  // When available, the `_description`, `_credit`, `_creditUrl`, and '_title' are
  // also returned as part of the object.
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
  //
  // If `options.annotate` is true, a `._urls` property is added to all
  // image attachments wherever they are found in `within`, with
  // subproperties for each image size name, including `original`.
  // For non-images, a `._url` property is set.

  self.all = function(within, options) {
    options = options || {};

    function test(attachment) {
      if ((!attachment) || (typeof (attachment) !== 'object')) {
        return false;
      }
      if (attachment.type !== 'attachment') {
        return false;
      }
      if (options.extension) {
        if (self.resolveExtension(attachment.extension) !== options.extension) {
          return false;
        }
      }
      if (options.group) {
        if (attachment.group !== options.group) {
          return false;
        }
      }
      if (options.extensions) {
        if (!_.contains(options.extensions, self.resolveExtension(attachment.extension))) {
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
            value._crop = _.pick(ancestor.relationships[o._id], 'top', 'left', 'width', 'height');
            value._focalPoint = _.pick(ancestor.relationships[o._id], 'x', 'y');

            // If the crop has changed the image orientation, update related
            // values.
            if (value.portrait && value._crop.width > value._crop.height) {
              value.landscape = true;
              value.portrait = false;
            } else if (value.landscape && value._crop.height > value._crop.width) {
              value.portrait = true;
              value.landscape = false;
            }

            if (o.credit) {
              value._credit = o.credit;
            }
            if (o.creditUrl) {
              value._creditUrl = o.creditUrl;
            }
            if (o.description) {
              value._description = o.description;
            }
            if (o.title) {
              value._title = o.title;
            }
            break;
          }
        }
        if (options.annotate) {
          // Because it may have changed above due to cloning
          o[key] = value;
          // Add URLs
          value._urls = {};
          if (value.group === 'images') {
            _.each(self.imageSizes, function(size) {
              value._urls[size.name] = self.url(value, { size: size.name });
            });
            value._urls.original = self.url(value, { size: 'original' });
          } else {
            value._url = self.url(value);
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
        return self.db.findWithProjection(criteria, { _id: 1 }).toArray(function(err, infos) {
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
          return self.db.findWithProjection({ _id: { $in: bucket } }).toArray(function(err, files) {
            if (err) {
              return callback(err);
            }
            return async.eachLimit(files, limit, each, callback);
          });
        }, callback);
      }
    }, callback);
  };

  // Returns true if, based on the provided attachment object,
  // a valid focal point has been specified. Useful to avoid
  // the default of `background-position: center center` if
  // not desired.

  self.hasFocalPoint = function(attachment) {
    // No attachment object; tolerate for nunjucks friendliness
    if (!attachment) {
      return false;
    }
    // Specified directly on the attachment (it's not a join situation)
    if (typeof (attachment.x) === 'number') {
      return true;
    }
    // Specified on a `_focalPoint` property hoisted via a join
    return attachment._focalPoint && (typeof (attachment._focalPoint.x) === 'number');
  };

  // If a focal point is present on the attachment, convert it to
  // CSS syntax for `background-position`. No trailing `;` is returned.
  // The coordinates are in percentage terms.

  self.focalPointToBackgroundPosition = function(attachment) {
    if (!self.hasFocalPoint(attachment)) {
      return 'center center';
    }
    var point = self.getFocalPoint(attachment);
    return point.x + '% ' + point.y + '%';
  };

  // Returns an object with `x` and `y` properties containing the
  // focal point chosen by the user, as percentages. If there is no
  // focal point, null is returned.

  self.getFocalPoint = function(attachment) {
    if (!self.hasFocalPoint(attachment)) {
      return null;
    }
    var x = attachment._focalPoint ? attachment._focalPoint.x : attachment.x;
    var y = attachment._focalPoint ? attachment._focalPoint.y : attachment.y;
    return {
      x: x,
      y: y
    };
  };

  // Returns true if this type of attachment is croppable.
  // Available as a template helper.

  self.isCroppable = function(attachment) {
    return attachment && self.croppable[self.resolveExtension(attachment.extension)];
  };

  // Returns true if this type of attachment is sized,
  // i.e. uploadfs produces versions of it for each configured
  // size, as it does with GIF, JPEG and PNG files.
  //
  // Accepts either an entire attachment object or an extension.
  //
  // Can accept `jpeg` or `jpg`, because it is needed prior to the
  // imagemagick code that resolves that difference.

  self.isSized = function(attachment) {
    if ((typeof attachment) === 'object') {
      return self.sized[self.resolveExtension(attachment.extension)];
    } else {
      return self.sized[self.resolveExtension(attachment)];
    }
  };

  // Resolve a file extension such as jpeg to its canonical form (jpg).
  // If no extension map is configured for this extension, return it as-is.

  self.resolveExtension = function(extension) {
    var group = self.getFileGroup(extension);
    if (group) {
      return group.extensionMaps[extension] || extension;
    }
    return extension;
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

      return async.series([ checkNeeded, attachments, docs ], callback);

      function checkNeeded(callback) {
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
            if (value && (typeof (value) === 'object') && value.extension && value.md5 && value.group && value._id && value.group) {
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

  self.addDocReferencesMigration = function() {

    // This migration is needed because formerly,
    // docs that only referenced this attachment via
    // a join were counted as "owning" it, which is
    // incorrect and leads to failure to make it
    // unavailable at the proper time. The name was
    // changed to ensure this migration would run
    // again after that bug was discovered and fixed.

    self.apos.migrations.add(self.__meta.name + '.docReferencesContained', function(callback) {
      return self.recomputeAllDocReferences(callback);
    }, {
      safe: true
    });
  };

  self.addRecomputeAllDocReferencesTask = function() {
    self.addTask('recompute-all-doc-references', 'Recompute mapping between attachments and docs,\nshould only be needed for rare repair situations', function(apos, argv, callback) {
      return self.recomputeAllDocReferences(callback);
    });
  };

  // Recompute the `docIds` and `trashDocIds` arrays
  // from scratch. Should only be needed by the
  // one-time migration that fixes these for older
  // databases, but can be run at any time via the
  // `apostrophe-attachments:recompute-doc-references`
  // task, just in case the need arises or your site
  // was affected by the very brief availability of 2.77.0
  // which effectively marked all attachments as
  // not in use.

  self.recomputeAllDocReferences = function(callback) {

    var attachmentUpdates = {};

    return async.series([ docs, attachments, self.updatePermissions ], callback);

    function docs(callback) {
      return self.apos.migrations.eachDoc({}, 5, addAttachmentUpdates, callback);
    }

    function addAttachmentUpdates(doc, callback) {
      var attachments = self.all(doc);
      var ids = _.uniq(_.pluck(attachments, '_id'));
      _.each(ids, function(id) {
        attachmentUpdates[id] = attachmentUpdates[id] || {
          $set: {
            docIds: [],
            trashDocIds: []
          }
        };
        if (doc.trash) {
          attachmentUpdates[id].$set.trashDocIds.push(doc._id);
        } else {
          attachmentUpdates[id].$set.docIds.push(doc._id);
        }
        attachmentUpdates[id].$set.utilized = true;
      });
      return setImmediate(callback);
    }

    function attachments(callback) {
      var bulk = self.db.initializeUnorderedBulkOp();
      var count = 0;
      _.each(attachmentUpdates, function(updates, id) {
        const c = bulk.find({ _id: id });
        _.each(updates, function(update) {
          c.updateOne(attachmentUpdates[id]);
          count++;
        });
      });
      if (!count) {
        // bulk.execute will throw an error if there are no updates
        return callback(null);
      }
      return bulk.execute(callback);
    }

  };

  self.addFixPermissionsMigration = function() {
    self.apos.migrations.add(self.__meta.name + '.fixPermissions', function(callback) {
      return self.apos.migrations.each(self.db, { group: 'images', trash: true }, 5, function(attachment, callback) {
        return self.applyPermissions(attachment, true, callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        self.apos.utils.warn('^^^ WARNINGS ABOVE ARE OK. This migration fixes a scenario in which SOME permissions were not set.');
        return callback(null);
      });
    }, {
      safe: true
    });
  };

  self.addResetUploadfsPermissionsTask = function() {
    self.addTask('reset-uploadfs-permissions', 'Reset the permissions of files in uploadfs to match the trash flag of each attachment', function(apos, argv, callback) {
      return self.resetUploadfsPermissions(callback);
    });
  };

  self.resetUploadfsPermissions = function(callback) {
    return self.apos.migrations.each(self.db, {}, 5, function(attachment, callback) {
      return self.applyPermissions(attachment, attachment.trash, callback);
    }, function(err) {
      if (err) {
        return callback(err);
      }
      self.apos.utils.warn('^^^ WARNINGS ABOVE ARE OK. You may see some in cases where the permissions are\nalready correct and cannot be set the same way twice in a row.');
      return callback(null);
    });
  };

  self.docAfterSave = function(req, doc, options, callback) {
    return self.updateDocReferences(doc, callback);
  };

  self.docAfterTrash = function(req, doc, callback) {
    return self.updateDocReferences(doc, callback);
  };

  self.docAfterRescue = function(req, doc, callback) {
    return self.updateDocReferences(doc, callback);
  };

  // When the last doc that contains this attachment goes to the
  // trash, its permissions should change to reflect that so
  // it is no longer web-accessible to those who know the URL.
  //
  // This method is invoked after any doc is inserted, updated, trashed
  // or rescued.

  self.updateDocReferences = function(doc, callback) {

    // We "own" only the attachments that are permanent properties
    // of the doc, drop any joins first
    doc = self.apos.utils.clonePermanent(doc);

    var attachments = self.all(self.apos.utils.clonePermanent(doc));

    var ids = _.uniq(_.pluck(attachments, '_id'));

    // Build an array of mongo commands to run. Each
    // entry in the array is a 2-element array. Element 0
    // is the criteria, element 1 is the command

    var commands = [];

    if (!doc.trash) {
      commands.push([
        {
          _id: { $in: ids }
        },
        {
          $addToSet: { docIds: doc._id }
        }
      ],
      [
        {
          _id: { $in: ids }
        },
        {
          $pull: { trashDocIds: doc._id }
        }
      ]);
    } else {
      commands.push([
        {
          _id: { $in: ids }
        },
        {
          $addToSet: { trashDocIds: doc._id }
        }
      ],
      [
        {
          _id: { $in: ids }
        },
        {
          $pull: { docIds: doc._id }
        }
      ]);
    }

    commands.push([
      {
        $or: [
          {
            trashDocIds: { $in: [ doc._id ] }
          },
          {
            docIds: { $in: [ doc._id ] }
          }
        ],
        _id: { $nin: ids }
      },
      {
        $pull: {
          trashDocIds: doc._id,
          docIds: doc._id
        }
      }
    ], [
      {
        _id: { $in: ids }
      },
      {
        $set: {
          utilized: true
        }
      }
    ]);

    return async.series([
      updateCounts,
      self.updatePermissions
    ], callback);

    function updateCounts(callback) {
      return async.eachSeries(commands, function(command, callback) {
        return self.db.update(command[0], command[1], callback);
      }, callback);
    }

  };

  // Update the permissions in uploadfs of all attachments
  // based on whether the documents containing them
  // are in the trash or not. Specifically, if an attachment
  // has been utilized at least once but no longer has
  // any entries in `docIds` and `trash` is not yet true,
  // it becomes web-inaccessible, `utilized` is set to false
  // and `trash` is set to true. Similarly, if an attachment
  // has entries in `docIds` but `trash` is true,
  // it becomes web-accessible and trash becomes false.
  //
  // This method is invoked at the end of `updateDocReferences`
  // and also at the end of the migration that adds `docIds`
  // to legacy sites. You should not need to invoke it yourself.

  self.updatePermissions = function(callback) {

    return async.series([
      hide,
      show
    ], callback);

    function hide(callback) {
      return self.db.findWithProjection({
        utilized: true,
        'docIds.0': { $exists: 0 },
        trash: { $ne: true }
      }).toArray(function(err, attachments) {
        if (err) {
          return callback(err);
        }
        return async.eachSeries(attachments, hideOne, callback);
      });
    }

    function show(callback) {
      return self.db.findWithProjection({
        utilized: true,
        'docIds.0': { $exists: 1 },
        trash: { $ne: false }
      }).toArray(function(err, attachments) {
        if (err) {
          return callback(err);
        }
        return async.eachSeries(attachments, showOne, callback);
      });
    }

    function hideOne(attachment, callback) {
      return permissionsOne(attachment, true, callback);
    }

    function showOne(attachment, callback) {
      return permissionsOne(attachment, false, callback);
    }

    function permissionsOne(attachment, trash, callback) {
      return self.applyPermissions(attachment, trash, function(err) {
        if (err) {
          return callback(err);
        }
        return update(callback);
      });
      function update(callback) {
        return self.db.update({
          _id: attachment._id
        }, {
          $set: {
            trash: trash
          }
        }, callback);
      }
    }

  };

  // Enable or disable access to the given attachment via uploadfs, based on whether
  // trash is true or false. If the attachment is an image, access
  // to the size indicated by the `sizeAvailableInTrash` option
  // (usually `one-sixth`) remains available. This operation is carried
  // out across all sizes and crops.

  self.applyPermissions = function(attachment, trash, callback) {
    var method = trash ? self.uploadfs.disable : self.uploadfs.enable;
    return async.series([
      original,
      crops
    ], callback);

    // Handle the original image and its scaled versions
    // here ("original" means "not cropped")
    function original(callback) {
      if ((!trash) && (attachment.trash === undefined)) {
        // Trash status not set at all yet means
        // it'll be a live file as of this point,
        // skip extra API calls
        return callback(null);
      }
      var sizes;
      if (!_.contains([ 'gif', 'jpg', 'png' ], self.resolveExtension(attachment.extension))) {
        sizes = [ { name: 'original' } ];
      } else {
        sizes = self.imageSizes.concat([ { name: 'original' } ]);
      }
      return async.eachSeries(sizes, function(size, callback) {
        if (size.name === self.sizeAvailableInTrash) {
          // This size is always kept accessible for preview
          // in the media library
          return callback(null);
        }
        var path = self.url(attachment, { uploadfsPath: true, size: size.name });
        return method(path, function(err) {
          if (err) {
            // afterSave is not a good place for fatal errors
            self.apos.utils.warn('Unable to set permissions on ' + path + ', most likely already done');
          }
          return callback(null);
        });
      }, callback);
    }

    function crops(callback) {
      if ((!trash) && (attachment.trash === undefined)) {
        // Trash status not set at all yet means
        // it'll be a live file as of this point,
        // skip extra API calls
        return callback(null);
      }
      return async.eachSeries(attachment.crops || [], cropOne, callback);
    }

    function cropOne(crop, callback) {
      return async.eachSeries(self.imageSizes.concat([ { name: 'original' } ]), function(size, callback) {
        if (size.name === self.sizeAvailableInTrash) {
          // This size is always kept accessible for preview
          // in the media library
          return callback(null);
        }
        var path = self.url(attachment, { crop: crop, uploadfsPath: true, size: size.name });
        return method(path, function(err) {
          if (err) {
            // afterSave is not a good place for fatal errors
            self.apos.utils.warn('Unable to set permissions on ' + path + ', possibly it does not exist');
          }
          return callback(null);
        });
      }, callback);
    }
  };

  self.migrateToDisabledFileKeyTask = function(argv, callback) {
    if (!self.uploadfs.migrateToDisabledFileKey) {
      throw 'Version of uploadfs is too old. npm update your project.';
    }
    return self.uploadfs.migrateToDisabledFileKey(callback);
  };

  self.migrateFromDisabledFileKeyTask = function(argv, callback) {
    if (!self.uploadfs.migrateFromDisabledFileKey) {
      throw 'Version of uploadfs is too old. npm update your project.';
    }
    return self.uploadfs.migrateFromDisabledFileKey(callback);
  };

  self.urlsTask = function(callback) {
    var uploadfsPath = !!self.apos.argv['uploadfs-path'] || !!self.apos.argv['uploads-url'];
    var seen = {};
    return self.apos.migrations.each(self.db, {}, 1, function(attachment, callback) {
      url(attachment);
      _.each(self.imageSizes, function(size) {
        url(attachment, { size: size.name });
      });
      _.each(attachment.crops, function(crop) {
        url(attachment, { crop: crop });
        _.each(self.imageSizes, function(size) {
          url(attachment, { crop: crop, size: size.name });
        });
      });
      return setImmediate(callback);
    }, callback);
    function url(attachment, options) {
      options = options || {};
      options.uploadfsPath = uploadfsPath;
      var url = self.url(attachment, options);
      if (self.apos.argv['uploads-url']) {
        url = self.apos.argv['uploads-url'] + url;
      }
      if (seen[url]) {
        return;
      }
      // eslint-disable-next-line
      console.log(url);
      seen[url] = true;
    }
  };

};
