var _ = require('lodash');
var async = require('async');
var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');

module.exports = function(self, options) {

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
  // This method returns `attachment` where `attachment` is an attachment
  // object, suitable for passing to the `url` API and for use as the value
  // of a `type: 'attachment'` schema field.

  self.insert = async function(req, file, options) {

    options = options || {};

    let extension = path.extname(file.name);
    if (extension && extension.length) {
      extension = extension.substr(1);
    }
    extension = extension.toLowerCase();
    // Do we accept this file extension?
    var group = self.getFileGroup(extension);
    if (!group) {
      const accepted = _.union(_.map(self.fileGroups, 'extensions'));
      throw new Error("File extension not accepted. Acceptable extensions: " + accepted.join(","));
    }
    const info = {
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

    if (!(options.permissions === false)) {
      if (!self.apos.permissions.can(req, 'edit-attachment')) {
        throw 'forbidden';
      }
    }

    info.length = await self.apos.utils.fileLength(file.path);

    info.md5 = await self.apos.utils.md5File(file.path);

    if (self.isSized(extension)) {
      // For images we correct automatically for common file extension mistakes
      const result = await Promise.promisify(self.uploadfs.copyImageIn)(file.path, '/attachments/' + info._id + '-' + info.name);
      info.extension = result.extension;
      info.width = result.width;
      info.height = result.height;
      if (info.width > info.height) {
        info.landscape = true;
      } else {
        info.portrait = true;
      }
    } else {
      // For non-image files we have to trust the file extension
      // (but we only serve it as that content type, so this should
      // be reasonably safe)
      await Promise.promisify(self.uploadfs.copyIn)(file.path, '/attachments/' + info._id + '-' + info.name + '.' + info.extension);
    }

    if (options.permissions !== false) {
      info.ownerId = self.apos.permissions.getEffectiveUserId(req);
    }
    info.createdAt = new Date();
    return await self.db.insert(info);
  };

  self.getFileGroup = function(extension) {
    return _.find(self.fileGroups, function(group) {
      const candidate = group.extensionMaps[extension] || extension;
      if (_.includes(group.extensions, candidate)) {
        return true;
      }
    });
  };

  self.crop = async function(req, _id, crop) {
    const info = await self.db.findOne({ _id: _id });
    if (!info) {
      throw 'notfound';
    }
    if (!self.croppable[info.extension]) {
      throw new Error(info.extension + ' files cannot be cropped, do not present cropping UI for this type');
    }
    info.crops = info.crops || [];
    const existing = _.find(info.crops, crop);
    if (existing) {
      // We're done, this crop is already available
      return;
    }
    // Pull the original out of cloud storage to a temporary folder where
    // it can be cropped and popped back into uploadfs
    const originalFile = '/attachments/' + info._id + '-' + info.name + '.' + info.extension;
    const tempFile = self.uploadfs.getTempPath() + '/' + self.apos.utils.generateId() + '.' + info.extension;
    const croppedFile = '/attachments/' + info._id + '-' + info.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + info.extension;

    await Promise.promisify(self.uploadfs.copyOut)(originalFile, tempFile);
    await Promise.promisify(self.uploadfs.copyImageIn)(tempFile, croppedFile, { crop: crop });
    info.crops.push(crop);
    await self.db.update({ _id: info._id }, info);
    await Promise.promisify(fs.unlink)(tempFile);
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
  // When available, the `_description`, `_credit` and `_creditUrl` are
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
        if (!_.includes(options.extensions, attachment.extension)) {
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
            if (o.credit) {
              value._credit = o.credit;
            }
            if (o.creditUrl) {
              value._creditUrl = o.creditUrl;
            }
            if (o.description) {
              value._description = o.description;
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
  // If only 2 arguments are given the limit defaults to 1.
  //
  // For use only in command line tasks, migrations and other batch operations
  // in which permissions are a complete nonissue. NEVER use on the front end.
  //
  // This method will `await` when calling your `each` function,
  // which must return a promise (i.e. just use an `async` function).
  //
  // This method is designed to succeed even if `each` is a fairly slow
  // operation and there are many attachments. It does not rely on keeping
  // a single MongoDB cursor open for a long time.

  self.each = async function(criteria, limit, each) {

    if (!each) {
      each = limit;
      limit = 1;
    }

    // "Why do we fetch a bucket of attachments at a time?" File operations
    // can be very slow. This can lead to MongoDB cursor timeouts in
    // tasks like apostrophe-attachments:rescale. We need a robust solution that
    // does not require keeping a MongoDB cursor open too long. -Tom

    const batchSize = 100;
    let lastId = '';
    while (true) {
      const docs = await self.db.find({ _id: { $gt: lastId } }).limit(batchSize).sort({ _id: 1 }).toArray();
      if (!docs.length) {
        return;
      }
      await Promise.map(docs, each, { concurrency: limit });
      lastId = docs[docs.length - 1]._id;
      if (docs.length < batchSize) {
        // Don't waste an extra query
        break;
      }
    }

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
    return attachment && self.croppable[attachment.extension];
  };

  // Returns true if this type of attachment is sized,
  // i.e. uploadfs produces versions of it for each configured
  // size, as it does with GIF, JPEG and PNG files.
  //
  // Accepts either an entire attachment object or an extension.

  self.isSized = function(attachment) {
    if ((typeof attachment) === 'object') {
      return self.sized[attachment.extension];
    } else {
      return self.sized[attachment];
    }
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

  self.on('apostrophe-docs:afterSave', 'updateDocReferencesAfterSave', async function(options) {
    return self.updateDocReferences(doc);
  });

  self.on('apostrophe-docs:afterTrash', 'updateDocReferencesAfterTrash', async function() {
    return self.updateDocReferences(doc);
  });

  self.on('apostrophe-docs:afterRescue', 'updateDocReferencesAfterRescue', async function() {
    return self.updateDocReferences(doc);
  });

  // When the last doc that contains this attachment goes to the
  // trash, its permissions should change to reflect that so
  // it is no longer web-accessible to those who know the URL.
  //
  // This method is invoked after any doc is inserted, updated, trashed
  // or rescued.

  self.updateDocReferences = async function(doc) {

    var attachments = self.all(doc);
    var ids = _.uniq(_.map(attachments, '_id'));

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

    for (let command of commands) {
      await self.db.updateMany(command[0], command[1]);
    }

    await self.updatePermissions();

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

  self.updatePermissions = async function() {

    await hide();
    await show();

    async function hide() {
      const attachments = await self.db.find({
        utilized: true,
        'docIds.0': { $exists: 0 },
        trash: { $ne: true }
      }).toArray();
      for (let attachment of attachments) {
        await permissionsOne(attachment, true);
      }
    }

    async function show() {
      const attachments = await self.db.find({
        utilized: true,
        'docIds.0': { $exists: 1 },
        trash: { $ne: false }
      }).toArray();
      for (let attachment of attachments) {
        await permissionsOne(attachment, false);
      }
    }

    async function permissionsOne(attachment, trash) {
      await self.applyPermissions(attachment, trash);
      await self.db.updateOne({
        _id: attachment._id
      }, {
        $set: {
          trash: trash
        }
      });
    }

  };

  // Enable or disable access to the given attachment via uploadfs, based on whether
  // trash is true or false. If the attachment is an image, access
  // to the size indicated by the `sizeAvailableInTrash` option
  // (usually `one-sixth`) remains available. This operation is carried
  // out across all sizes and crops.

  self.applyPermissions = async function(attachment, trash) {

    let method = trash ? self.uploadfs.disable : self.uploadfs.enable;
    method = Promise.promisify(method);
    await original();
    await crops();

    // Handle the original image and its scaled versions
    // here ("original" means "not cropped")
    async function original() {
      if ((!trash) && (attachment.trash === undefined)) {
        // Trash status not set at all yet means
        // it'll be a live file as of this point,
        // skip extra API calls
        return;
      }
      let sizes;
      if (!_.includes([ 'gif', 'jpg', 'png' ], attachment.extension)) {
        sizes = [ { name: 'original' } ];
      } else {
        sizes = self.imageSizes.concat([ { name: 'original' } ]);
      }
      for (let size of sizes) {
        if (size.name === self.sizeAvailableInTrash) {
          // This size is always kept accessible for preview
          // in the media library
          continue;
        }
        const path = self.url(attachment, { uploadfsPath: true, size: size.name });
        try {
          await method(path);
        } catch (e) {
          // afterSave is not a good place for fatal errors
          self.apos.utils.warn('Unable to set permissions on ' + path + ', most likely already done');
        }
      }
    }

    async function crops() {
      if ((!trash) && (attachment.trash === undefined)) {
        // Trash status not set at all yet means
        // it'll be a live file as of this point,
        // skip extra API calls
        return;
      }
      for (let crop of attachment.crops) {
        await cropOne(crop);
      }
    }

    async function cropOne(crop) {
      for (let size of self.imageSizes.concat([ { name: 'original' } ])) {
        if (size.name === self.sizeAvailableInTrash) {
          // This size is always kept accessible for preview
          // in the media library
          continue;
        }
        const path = self.url(attachment, { crop: crop, uploadfsPath: true, size: size.name });
        try {
          await method(path);
        } catch (e) {
          // afterSave is not a good place for fatal errors
          self.apos.utils.warn('Unable to set permissions on ' + path + ', possibly it does not exist');
        }
      }
    }
  };

  self.migrateToDisabledFileKeyTask = async function(argv) {
    await Promise.promisify(self.uploadfs.migrateToDisabledFileKey)();
  };

  self.migrateFromDisabledFileKeyTask = async function(argv) {
    await Promise.promisify(self.uploadfs.migrateFromDisabledFileKey)();
  };

};
