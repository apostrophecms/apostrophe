var _ = require('lodash');
var fs = require('fs');
var async = require('async');

module.exports = function (self, options) {

  var launder = self.apos.launder;

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

  self.route('post', 'upload', self.apos.middleware.files, function(req, res) {
    // Must use text/plain for file upload responses in IE <= 9,
    // doesn't hurt in other browsers. -Tom
    res.header("Content-Type", "text/plain");
    return self.accept(req, req.files.files, function(err, files) {
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
  self.route('post', 'crop', function(req, res) {
    var _id = req.body._id;
    var crop = req.body.crop;
    var file;
    async.series([
      function(callback) {
        return callback(self.apos.permissions.can(req, 'edit-file') ? null : 'forbidden');
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
          self.utils.pruneTemporaryProperties(file);
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
  // the get method for the available query parameters.

  self.route('get', 'browse', function(req, res) {
    if (!self.apos.permissions.can(req, 'edit-file', null)) {
      res.statusCode = 404;
      return res.send('not found');
    }
    return self.browse(req, req.query, function(err, result) {
      if (err) {
        res.statusCode = 500;
        return res.send('error');
      }

      if (!result.files.length) {
        res.statusCode = 404;
        return res.send('no more');
      }

      return res.send(self.render(req, 'index.html', result));
    });
  });

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

  self.route('post', 'annotate', function(req, res) {
    // make sure we have permission to edit files at all
    if (!self.apos.permissions.can(req, 'edit-file', null)) {
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
    if (!(req.user && req.user._permissions.admin)) {
      criteria.ownerId = self.apos.permissions.getEffectiveUserId(req);
    }
    var results = [];
    return self.get(req, { ids: _.pluck(req.body, '_id') }, function(err, result) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return async.eachSeries(result.files, function(file, callback) {
        if (!file._edit) {
          // get will give us files we can't edit, but it will also tell us which ones
          // we can edit, so implement a permissions check here
          return callback('notyours');
        }
        var annotation = _.find(req.body, function(item) {
          return item._id === file._id;
        });
        if (!annotation) {
          return callback('unexpected');
        }
        return self.apos.schemas.convert(req, self.schema, 'form', annotation, file, function(err) {
          file._owner = req.user;
          file.searchText = self.searchText(file);
          self.apos.utils.pruneTemporaryProperties(file);
          results.push(file);
          return self.files.update({ _id: file._id }, file, callback);
        });
      }, function(err) {
        if (err) {
          return res.send({ status: 'error' });
        }
        return res.send({ status: 'ok', files: results });
      });
    });
  });

  // Delete a previously uploaded file. The _id POST parameter
  // determines the file to be deleted. On success a JSON object
  // with a `status` property containing `ok` is sent, otherwise
  // status contains an error string.

  self.route('post', 'delete', function(req, res) {
    return self.updateTrash(req, req.body && req.body._id, true, function(err) {
      if (err){
        console.log(err);
      }
      return res.send({ 'status': err ? 'notfound' : 'ok' });
    });
  });

  // Rescue a previously deleted file, as specified by the _id POST parameter.
  // On success a JSON object with a `status` property containing `ok` is sent,
  // otherwise status contains an error string.

  self.route('post', 'rescue', function(req, res) {
    return self.updateTrash(req, req.body && req.body._id, false, function(err) {
      return res.send({ 'status': err ? 'notfound' : 'ok' });
    });
  });

  self.route('post', 'media-library', function(req, res) {
    var fileGroupChoices = [
      {
        label: res.__('All Media Types'),
        value: ''
      }
    ];
    _.each(self.fileGroups, function(group) {
      fileGroupChoices.push({
        label: res.__(group.label),
        value: group.name
      });
    });

    var fileTypeChoices = [
      {
        label: res.__('All Media Types'),
        value: ''
      }
    ];
    _.each(self.fileGroups, function(group) {
      _.each(group.extensions, function(type) {
        fileTypeChoices.push({
          label: type,
          value: type
        });
      });
    });

    var data = {
      fileGroupChoices: fileGroupChoices,
      fileTypeChoices: fileTypeChoices,
      browseByType: self.options.browseByType,
      browseByTag: self.options.browseByTag,
      action: self.action
    };

    return res.send(self.render(req, 'mediaLibrary', data));
  });

  self.route('post', 'normal-view', function(req, res) {

    if (!req.body.id) {
      // We want the default normal view
      return res.send(self.render(req, 'showNormalView.html', { file: {} }));
    }

    return self.getOne(req, { id: launder.id(req.body.id), browsing: true }, function(err, file) {
      if (err || (!file)) {
        res.statusCode = 404;
        return res.send('notfound');
      }
      return res.send(self.render(req, 'showNormalView.html', { file: file }));
    });
  });

  self.route('post', 'get-one', function(req, res) {
    return self.getOne(req, { id: launder.id(req.body.id), browsing: true }, function(err, file) {
      if (err || (!file) || (!file._edit)) {
        res.statusCode = 404;
        return res.send('notfound');
      }
      return res.send(file);
    });
  });

  // Returns tags that appear on files this user is allowed to browse

  self.route('post', 'tags', function(req, res) {
    // We should refactor self.get so it doesn't get
    // the actual documents at all when we only care about
    // tags, but in the meantime...
    return self.get(req, { limit: 1, browsing: true }, function(err, result) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return res.send({ status: 'ok', tags: result.tags });
    });
  });
};
