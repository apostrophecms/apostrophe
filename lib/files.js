var hash_file = require('hash_file');
var _ = require('underscore');
var fs = require('fs');
var async = require('async');
var path = require('path');
var extend = require('extend');
var crypto = require('crypto');

/**
 * files
 * @augments Augments the apos object with methods, routes and
 * properties supporting the management of media files (images, PDFs, etc.)
 * uploaded by users.
 */

module.exports = {
  /**
   * Augment apos object with resources necessary prior to init() call
   * @param  {Object} self  The apos object
   */
  construct: function(self) {
    // For convenience when configuring uploadfs. We recommend always configuring
    // these sizes and adding more if you wish
    self.defaultImageSizes = [
      {
        name: 'full',
        width: 1140,
        height: 1140
      },
      {
        name: 'two-thirds',
        width: 760,
        height: 760
      },
      {
        name: 'one-half',
        width: 570,
        height: 700
      },
      {
        name: 'one-third',
        width: 380,
        height: 700
      },
      // Handy for thumbnailing
      {
        name: 'one-sixth',
        width: 190,
        height: 350
      }
    ];

    // mediaLibrary.js would have to be patched to support changing this. -Tom
    self.trashImageSizes = [ 'one-sixth' ];

    // Default file type groupings
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
  },
  /**
   * Augment apos object with resources that cannot be added until the init call
   * @param  {Object} self  The apos object
   */
  init: function(self) {

    // Find an image referenced within an area, such as an image in a slideshow widget.
    // Returns the first image matching the criteria. Only GIF, JPEG and PNG images
    // will ever be returned.
    //
    // EASY SYNTAX:
    //
    // apos.areaImage(page, 'body')
    //
    // You may also add options, such as "extension" to force the results to
    // include JPEGs only:
    //
    // apos.areaImage(page, 'body', { extension: 'jpg' })
    //
    // (Note Apostrophe always uses .jpg for JPEGs.)
    //
    // CLASSIC SYNTAX (this is the hard way):
    //
    // apos.areaImage({ area: page.areas.body })
    //
    // OPTIONS:
    //
    // You may specify `extension` or `extensions` (an array of extensions)
    // to filter the results.

    self.areaImage = function(_options /* or page, name, options */) {
      var options = {};
      if (arguments.length > 1) {
        options.area = arguments[0] && arguments[0].areas && arguments[0].areas[arguments[1]];
        extend(true, options, arguments[2]);
      } else {
        extend(true, options, _options);
      }
      options.group = 'images';
      return self.areaFile(options);
    };

    // Find images referenced within an area, such as images in a slideshow widget.
    // Returns all the files matching the criteria unless the "limit" option is used.
    //
    // EASY SYNTAX:
    //
    // apos.areaImages(page, 'body')
    //
    // Now you can loop over them with "for".
    //
    // You may also add options:
    //
    // apos.areaImages(page, 'body', { extension: 'jpg', limit: 2 })
    //
    // Note that Apostrophe always uses three-letter lowercase extensions.
    //
    // CLASSIC SYNTAX:
    //
    // apos.areaImage({ area: page.areas.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, or `extensions` (an array of extensions).
    //
    // The `limit` option limits the number of results returned. Note that
    // `areaImage` is more convenient than `apos.areaImages` if limit is 1.
    //
    // See also apos.areaFiles.

    self.areaImages = function(_options /* or page, name, options */) {
      var options = {};
      if (arguments.length > 1) {

        options.area = arguments[0] && arguments[0].areas && arguments[0].areas[arguments[1]];
        extend(true, options, arguments[2]);
      } else {
        extend(true, options, _options);
      }
      options.group = 'images';
      return self.areaFiles(options);
    };

    // Find a file referenced within an area, such as an image in a slideshow widget,
    // or a PDF in a file widget.
    //
    // Returns the first file matching the criteria.
    //
    // EASY SYNTAX:
    //
    // apos.areaFile(page, 'body')
    //
    // You may also add options:
    //
    // apos.areaFile(page, 'body', { extension: 'jpg' })
    //
    // CLASSIC SYNTAX:
    //
    // apos.areaFile({ area: page.areas.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, `extensions` (an array of extensions)
    // or `group` to filter the results. By default the `images` and `office` groups
    // are available.
    //
    // If you are using `group: "images"` consider calling apos.areaImage instead.
    // This is convenient and protects you from accidentally getting a PDF file.

    self.areaFile = function(_options /* or page, name, options */) {
      var options = {};
      if (arguments.length > 1) {

        options.area = arguments[0] && arguments[0].areas && arguments[0].areas[arguments[1]];
        extend(true, options, arguments[2]);
      } else {
        extend(true, options, _options);
      }
      options.limit = 1;
      var files = self.areaFiles(options);
      return files[0];
    };

    // Find files referenced within an area, such as an image in a slideshow widget.
    // Returns all the files matching the criteria unless the "limit" option is used.
    //
    // EASY SYNTAX:
    //
    // apos.areaFiles(page, 'body')
    //
    // You may also add options:
    //
    // apos.areaFiles(page, 'body', { extension: 'jpg', limit: 2 })
    //
    // CLASSIC SYNTAX:
    //
    // apos.areaFile({ area: page.areas.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, `extensions` (an array of extensions)
    // or `group` to filter the results. By default the `images` and `office` groups
    // are available.
    //
    // The `limit` option limits the number of results returned. Note that
    // `areaFile` is more convenient than `apos.areaFiles`.

    self.areaFiles = function(_options /* or page, name, options */) {
      var options = {};
      if (arguments.length > 1) {

        options.area = arguments[0] && arguments[0].areas && arguments[0].areas[arguments[1]];
        extend(true, options, arguments[2]);
      } else {
        extend(true, options, _options);
      }

      function testFile(file) {
        if (file.extension === undefined) {
          // Probably not a file
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
      }

      if (!options) {
        options = {};
      }
      var area = options.area;
      var winningFiles = [];
      if (!(area && area.items)) {
        return [];
      }
      var i, j;
      for (i = 0; (i < area.items.length); i++) {
        var item = area.items[i];
        // The slideshow, files and similar widgets use an 'items' array
        // to store files. Let's look there, and also allow for '_items' to
        // support future widgets that pull in files dynamically. However
        // we also must make sure the items are actually files by making
        // sure they have an `extension` property. (TODO: this is a hack,
        // think about having widgets register to participate in this.)
        if (!item._items) {
          continue;
        }
        for (j = 0; (j < item._items.length); j++) {
          if ((options.limit !== undefined) && (winningFiles.length >= options.limit)) {
            return winningFiles;
          }
          var file = item._items[j];
          var good = testFile(file);

          if (good) {
            winningFiles.push(file);
          } else {
          }
        }
      }
      return winningFiles;
    };

    // bc wrapper, see areaFile. Use apply so that if areaFiles is
    // overridden we call the override
    self.areaFindFile = function() {
      return self.areaFile.apply(self, arguments);
    };

    // Upload files. Expects an HTTP file upload from an
    // `<input type="file" multiple />` element, accessed
    // via Express as `req.files.files`. Also accepts a
    // single-file upload under that same name. Files are
    // copied into UploadFS and metadata is stored in the
    // apos.files collection. Images are automatically
    // scaled to all configured sizes at upload time.
    // This route responds with a JSON object; if the
    // `status` property is `ok` you will find an array
    // of metadata objects about the uploaded files
    // in the `files` property. At this point you may assume
    // the files have been copied into uploadfs and all scaled
    // versions have been generated if appropriate. The user
    // must have the `edit-file` permission, which is
    // normally granted to all users in groups with the
    // `edit` or `admin` permission.

    // If you are  allowing for public image uploading into
    // the media library (perhaps using apostrophe-moderator),
    // IE9 and below do not react properly to the json content
    // type. Post images to '/apos/upload-files?html=1' and
    // the server will respond with text/html instead.

    self.app.post('/apos/upload-files', function(req, res) {
      return self.acceptFiles(req, req.files.files, function(err, files) {
        if (err) {
          console.error(err);
          return res.send({ files: [], status: 'err' });
        }
        if(req.query.html) {
          res.setHeader('Content-Type', 'text/html');
        }
        return res.send({ files: files, status: 'ok' });
      });
    });

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

    self.acceptFiles = function(req, files, callback) {
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
          _id: self.generateId(),
          length: file.length,
          group: group.name,
          createdAt: new Date(),
          name: self.slugify(path.basename(file.name, path.extname(file.name))),
          title: self.sortify(path.basename(file.name, path.extname(file.name))),
          extension: extension
        };

        function permissions(callback) {
          self.permissions(req, 'edit-file', null, callback);
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
          info.ownerId = self.getEffectiveUserId(req);
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

    // Replace one file. A single file upload is expected in the
    // input element with the name `files`. The id of the
    // existing file object must be in the `id` query parameter.

    self.app.post('/apos/replace-file', function(req, res) {
      // TODO: reduce redundancy with /apos/upload-files
      var id = req.query.id;
      return self.files.findOne({ _id: id }, function(err, file) {
        if (err || (!file)) {
          return self.fail(req, res);
        }
        // Permissions: if you're not an admin you must own the file
        if (!(req.user && req.user.permissions.admin)) {
          if (file.ownerId !== self.getEffectiveUserId(req)) {
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
          self.permissions(req, 'edit-file', null, callback);
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

    // Crop a previously uploaded image, based on the `_id` POST parameter
    // and the `crop` POST parameter. `_id` should refer to an existing
    // file object. `crop` should contain top, left, width and height
    // properties.
    //
    // This route uploads a new, cropped version of
    // the existing image fuke to uploadfs, named: /files/ID-NAME.top.left.width.height.extension
    //
    // The `crop` object is appended to the `crops` array property
    // of the file object.
    self.app.post('/apos/crop', function(req, res) {
      var _id = req.body._id;
      var crop = req.body.crop;
      var file;
      async.series([
        function(callback) {
          return self.permissions(req, 'edit-file', null, callback);
        },
        function(callback) {
          self.files.findOne({ _id: _id }, function(err, fileArg) {
            file = fileArg;
            return callback(err);
          });
        }
      ], function(err) {
        if (!file) {
          console.error(err);
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

    // API access to retrieve information about files. See
    // the getFiles method for the available query parameters.

    self.app.get('/apos/browse-files', function(req, res) {
      return self.permissions(req, 'edit-file', null, function(err) {
        if (err) {
          res.statusCode = 404;
          return res.send('not found');
        }
        return self.getFilesSanitized(req, req.query, function(err, result) {
          if (err) {
            res.statusCode = 500;
            return res.send('error');
          }
          if (!result.files.length) {
            res.statusCode = 404;
            return res.send('no more');
          }
          return res.send(result);
        });
      });
    });

    // Fetch files according to the parameters specified by the
    // `options` object: `group`, `owner`, `extension`, `ids`, `q`, `limit`,
    // `skip` and `minSize`. These properties are sanitized to ensure they
    // are in the proper format; that makes this method suitable for
    // use in the implementation of API routes. A wrapper for
    // `apos.getFiles`.

    self.getFilesSanitized = function(req, options, callback) {
      var newOptions = {};
      if (options.group) {
        newOptions.group = self.sanitizeString(options.group);
      }
      if (options.owner === 'user' || options.owner === 'all' ) {
        newOptions.owner = options.owner;
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
    // req is present to check identity and view permissions.
    //
    // Options must be pre-sanitized. See self.getFilesSanitized
    // for a wrapper that sanitizes the options so you can pass req.query.
    // For performance we don't want to sanitize on every page render that
    // just needs to join with previously chosen files.
    //
    // If the current user may edit a file it is given a ._edit = true property.

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
      if (options.owner === 'user') {
        criteria.ownerId = self.getEffectiveUserId(req);
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
      var possibleEditor = false;
      async.series([
        function(callback) {
          return self.permissions(req, 'edit-file', null, function(err) {
            possibleEditor = !err;
            return callback(null);
          });
        },
        function(callback) {
          return self.files.count(criteria, function(err, count) {
            result.total = count;
            return callback(err);
          });
        },
        function(callback) {
          return self.files.find(criteria).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(function(err, files) {
            result.files = files;
            _.each(result.files, function(file) {
              delete file._edit;
              if (possibleEditor) {
                if (req.user && req.user.permissions.admin) {
                  file._edit = true;
                } else if (file.ownerId === self.getEffectiveUserId(req)) {
                  file._edit = true;
                }
              }
            });
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

    // Annotate previously uploaded files. The POST body should contain
    // an array of objects with the following properties:
    //
    // `_id`: the id of the existing file object
    //
    // `title`, `description`, `credit`: strings
    // `tags`: array of strings
    //
    // On success the response will be a JSON array of objects that
    // were updated. On failure an appropriate HTTP status code is used.

    self.app.post('/apos/annotate-files', function(req, res) {
      // make sure we have permission to edit files at all
      return self.permissions(req, 'edit-file', null, function(err) {
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
        //
        // Anons can edit stuff for the lifetime of their session. This
        // allows for annotations and the possibility of a delete mechanism
        // when crafting submissions via apostrophe-moderator.
        if (!(req.user && req.user.permissions.admin)) {
          criteria.ownerId = self.getEffectiveUserId(req);
        }
        var results = [];
        return self.getFiles(req, { ids: _.pluck(req.body, '_id') }, function(err, result) {
          if (err) {
            console.error(err);
            res.statusCode = 500;
            return res.send('error');
          }
          return async.eachSeries(result.files, function(file, callback) {
            if (!file._edit) {
              // getFiles will give us files we can't edit, but it will also tell us which ones
              // we can edit, so implement a permissions check here
              return callback('notyours');
            }
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
            file.searchText = self.fileSearchText(file);
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

    // Delete a previously uploaded file. The _id POST parameter
    // determines the file to be deleted. On success a JSON object
    // with a `status` property containing `ok` is sent, otherwise
    // status contains an error string.

    self.app.post('/apos/delete-file', function(req, res) {
      return self.updateTrash(req, req.body && req.body._id, true, function(err) {
        return res.send({ 'status': err ? 'notfound' : 'ok' });
      });
    });

    // Rescue a previously deleted file, as specified by the _id POST parameter.
    // On success a JSON object with a `status` property containing `ok` is sent,
    // otherwise status contains an error string.

    self.app.post('/apos/rescue-file', function(req, res) {
      return self.updateTrash(req, req.body && req.body._id, false, function(err) {
        return res.send({ 'status': err ? 'notfound' : 'ok' });
      });
    });

    /**
     * Move the specified file in or out of the trash. If trash is true,
     * trash it, otherwise rescue it.
     * @param  {Request}   req      request object
     * @param  {string}   id       id of file
     * @param  {boolean}   trash    true for trash, false for rescue
     * @param  {Function} callback Receives error if any
     */
    self.updateTrash = function(req, id, trash, callback) {
      id = self.sanitizeString(id);
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
          return self.permissions(req, 'edit-file', info, callback);
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
              if (_.contains(self.trashImageSizes, size.name)) {
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

    // Check whether the user has permission to carry out an action
    // on a file. `view-file` permission is granted to everyone.
    // All other permissions are granted if the user owns the file.
    // This method is part of the implementation of apos.permissions,
    // which has already checked and allowed the user to do the action
    // if they have the admin permission. On success invokes its
    // callback with null; if permissions is not granted, invokes
    // the callback with `Forbidden`.
    //
    // For performance reasons the browse-files action duplicates
    // this check synchronously and the implementations must be
    // kept compatible.

    self.filePermissions = function(req, action, file, callback) {
      if (action === 'view-file') {
        return callback(null);
      }
      // Assume everything else is an editing operation
      // Note that self.permissions already let it through if
      // the user is an admin
      if (req.user && (file.ownerId === self.getEffectiveUserId(req))) {
        return callback(null);
      }
      return callback('Forbidden');
    };

    // Determine the search text for a file object, based on its
    // filename, title, credit, tags, description, extension and group
    // (images or office).
    self.fileSearchText = function(file) {
      var s = _.map([ file.name, file.title, file.credit ].concat(file.tags || []).concat([file.description, file.extension, file.group ]).concat((file.extension === 'jpg') ? [ 'jpeg '] : []), function(s) {
        return self.sortify(s);
      }).join(' ');
      return s;
    };

    // Perform an md5 checksum on a file. Returns hex string. Via:
    // http://nodejs.org/api/crypto.html
    self.md5File = function(filename, callback) {
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

    // Perform an md5 checksum on a string. Returns hex string.
    self.md5 = function(s) {
      var md5 = crypto.createHash('md5');
      md5.update(s);
      return md5.digest('hex');
    };
  }
};
