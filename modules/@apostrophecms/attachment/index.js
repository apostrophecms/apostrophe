const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const Promise = require('bluebird');
const uploadfs = require('uploadfs');
const mkdirp = require('mkdirp');

module.exports = {
  options: { alias: 'attachment' },
  cascades: [ 'imageSizes' ],
  imageSizes: {
    add: {
      max: {
        width: 1600,
        height: 1600
      },
      full: {
        width: 1140,
        height: 1140
      },
      'two-thirds': {
        width: 760,
        height: 760
      },
      'one-half': {
        width: 570,
        height: 700
      },
      'one-third': {
        width: 380,
        height: 700
      },
      'one-sixth': {
        width: 190,
        height: 350
      }
    }
  },

  async init(self, options) {
    self.name = 'attachment';

    self.fileGroups = options.fileGroups || [
      {
        name: 'images',
        label: 'Images',
        extensions: [
          'gif',
          'jpg',
          'png'
        ].concat(options.svgImages ? [ 'svg' ] : []),
        extensionMaps: { jpeg: 'jpg' },
        // uploadfs should treat this as an image and create scaled versions
        image: true
      },
      {
        name: 'office',
        label: 'Office',
        extensions: [
          'txt',
          'rtf',
          'pdf',
          'xls',
          'ppt',
          'doc',
          'pptx',
          'sldx',
          'ppsx',
          'potx',
          'xlsx',
          'xltx',
          'csv',
          'docx',
          'dotx'
        ],
        extensionMaps: {},
        // uploadfs should just accept this file as-is
        image: false
      }
    ];

    // Do NOT add keys here unless they have the value `true`
    self.croppable = {
      gif: true,
      jpg: true,
      png: true
    };

    // Do NOT add keys here unless they have the value `true`
    self.sized = {
      gif: true,
      jpg: true,
      png: true
    };

    self.sizeAvailableInTrash = options.sizeAvailableInTrash || 'one-sixth';

    // uploadfs expects an array
    self.imageSizes = Object.keys(self.imageSizes).map(name => ({
      name,
      ...self.imageSizes[name]
    }));

    const uploadfsDefaultSettings = {
      backend: 'local',
      uploadsPath: self.apos.rootDir + '/public/uploads',
      uploadsUrl: (self.apos.baseUrl || '') + self.apos.prefix + '/uploads',
      tempPath: self.apos.rootDir + '/data/temp/uploadfs',
      imageSizes: self.imageSizes
    };

    self.uploadfsSettings = {};
    _.merge(self.uploadfsSettings, uploadfsDefaultSettings);

    _.merge(self.uploadfsSettings, options.uploadfs || {});

    if (process.env.APOS_S3_BUCKET) {
      _.merge(self.uploadfsSettings, {
        backend: 's3',
        endpoint: process.env.APOS_S3_ENDPOINT,
        secret: process.env.APOS_S3_SECRET,
        key: process.env.APOS_S3_KEY,
        bucket: process.env.APOS_S3_BUCKET,
        region: process.env.APOS_S3_REGION
      });
    }

    self.rescaleTask = require('./lib/tasks/rescale.js')(self);
    await self.enableCollection();
    await self.initUploadfs();
    self.addFieldType();
    self.addPermissions();
    self.enableBrowserData();
    self.apos.task.add('@apostrophecms/attachment', 'rescale', 'Usage: node app @apostrophecms/attachment:rescale\n\n' + 'Regenerate all sizes of all image attachments. Useful after a new size\n' + 'is added to the configuration. Takes a long time!', async function (apos, argv) {
      return self.rescaleTask(argv);
    });
    self.apos.task.add('@apostrophecms/attachment', 'migrate-to-disabled-file-key', 'Usage: node app @apostrophecms/attachment:migrate-to-disabled-file-key\n\n' + 'This task should be run after adding the disabledFileKey option to uploadfs\n' + 'for the first time. It should only be relevant for storage backends where\n' + 'that option is not mandatory, i.e. only local storage as of this writing.', async function (apos, argv) {
      return self.migrateToDisabledFileKeyTask(argv);
    });
    self.apos.task.add('@apostrophecms/attachment', 'migrate-from-disabled-file-key', 'Usage: node app @apostrophecms/attachment:migrate-from-disabled-file-key\n\n' + 'This task should be run after removing the disabledFileKey option from uploadfs.\n' + 'It should only be relevant for storage backends where\n' + 'that option is not mandatory, i.e. only local storage as of this writing.', async function (apos, argv) {
      return self.migrateFromDisabledFileKeyTask(argv);
    });
  },

  // TODO RESTify where possible
  apiRoutes(self, options) {
    // TODO this must be updated to employ the new useMiddleware format and that
    // section has to be implemented
    return {
      post: {
        upload: [
          self.canUpload,
          require('connect-multiparty')(),
          async function (req) {
            try {
              // The name attribute could be anything because of how fileupload
              // controls work; we don't really care.
              const file = _.values(req.files || [])[0];
              if (!file) {
                throw self.apos.error('notfound');
              }
              return await self.insert(req, file);
            } finally {
              for (const file of (Object.values(req.files) || {})) {
                try {
                  fs.unlinkSync(file.path);
                } catch (e) {
                  self.apos.util.warn(`Uploaded temporary file ${file.path} was already removed, this should have been the responsibility of the upload route`);
                }
              }
            }
          }
        ],
        // Crop a previously uploaded image, based on the `id` POST parameter
        // and the `crop` POST parameter. `id` should refer to an existing
        // file in /attachments. `crop` should contain top, left, width and height
        // properties.
        //
        // This route uploads a new, cropped version of
        // the existing image to uploadfs, named:
        //
        // /attachments/ID-NAME.top.left.width.height.extension
        //
        // The `crop` object is appended to the `crops` array property
        // of the file object.
        crop: [
          self.canUpload,
          async function (req) {
            const _id = self.apos.launder.id(req.body._id);
            let crop = req.body.crop;
            if (typeof crop !== 'object') {
              throw self.apos.error('invalid');
            }
            crop = self.sanitizeCrop(crop);
            if (!crop) {
              throw self.apos.error('invalid');
            }
            await self.crop(req, _id, crop);
            return true;
          }
        ]
      }
    };
  },
  handlers(self, options) {
    return {
      'apostrophe:destroy': {
        async destroyUploadfs() {
          await Promise.promisify(self.uploadfs.destroy)();
        }
      },
      '@apostrophecms/doc-type:afterSave': {
        async updateDocReferencesAfterSave(req, doc, options) {
          return self.updateDocReferences(doc);
        }
      },
      '@apostrophecms/doc-type:afterTrash': {
        async updateDocReferencesAfterTrash(req, doc) {
          return self.updateDocReferences(doc);
        }
      },
      '@apostrophecms/doc-type:afterRescue': {
        async updateDocReferencesAfterRescue(req, doc) {
          return self.updateDocReferences(doc);
        }
      }
    };
  },
  methods(self, options) {
    return {
      async initUploadfs() {
        safeMkdirp(self.uploadfsSettings.uploadsPath);
        safeMkdirp(self.uploadfsSettings.tempPath);
        self.uploadfs = uploadfs();
        await Promise.promisify(self.uploadfs.init)(self.uploadfsSettings);
        function safeMkdirp(path) {
          try {
            mkdirp.sync(path);
          } catch (e) {
            if (require('fs').existsSync(path)) {
            } else {
              throw e;
            }
          }
        }
      },

      async enableCollection() {
        self.db = await self.apos.db.collection('aposAttachments');
        await self.db.createIndex({ docIds: 1 });
        await self.db.createIndex({ trashDocIds: 1 });
      },

      addPermissions() {
        self.apos.permission.add({
          value: 'edit-attachment',
          // We need the edit- prefix so those with the blanket editor permission
          // are good to go, but for a label we want to convey that this is
          // something almost everyone with editing privileges anywhere should be given
          label: 'Upload & Crop'
        });
      },
      addFieldType() {
        self.apos.schema.addFieldType({
          name: self.name,
          partial: self.fieldTypePartial,
          convert: self.convert,
          index: self.index,
          vueComponent: 'AposAttachment'
        });
      },
      async convert(req, field, data, object) {
        let info = data[field.name];
        if (typeof info !== 'object') {
          info = {};
        }
        info = _.pick(info, '_id', 'crop');
        info._id = self.apos.launder.id(info._id);
        if (!info._id) {
          object[field.name] = null;
        }
        info.crop = info.crop ? self.sanitizeCrop(info.crop) : undefined;
        const dbInfo = await self.db.findOne({ _id: info._id });
        if (!dbInfo) {
          object[field.name] = null;
          return;
        }
        _.assign(info, _.omit(dbInfo, 'crop'));

        // Check if the file type is acceptable of if there are
        const correctedExtensions = self.checkExtension(field, info);

        if (correctedExtensions) {
          let message = req.__('File type was not accepted.');
          if (correctedExtensions.length) {
            message += ` ${req.__('Acceptable extensions:')} ${correctedExtensions.join(', ')}`;
          }
          throw self.apos.error('invalid', message);
        }

        if (info.crop) {
          if (!_.find(info.crops, info.crop)) {
            info.crop = null;
          }
        }
        info.used = true;
        await self.db.replaceOne({ _id: info._id }, info);
        object[field.name] = info;
      },
      fieldTypePartial(data) {
        return self.partial('attachment', data);
      },
      index(value, field, texts) {
        const silent = field.silent === undefined ? true : field.silent;
        texts.push({
          weight: field.weight || 15,
          text: value.title,
          silent: silent
        });
      },
      // Checked a given attachment's file extension against the extensions
      // allowed by a particular schema field. If the attachment's file
      // extension is allowed, `null` is returned. If the file extension is not
      // allowed, `checkExtension` returns an array of the file extensions that
      // _are_ allowed (or an empty array if the allowed extensions are
      // unknown).
      checkExtension(field, attachment) {
        const groups = field.fileGroups ||
          (field.fileGroup && [ field.fileGroup ]);
        let extensions;

        if (groups) {
          if (!_.includes(groups, attachment.group)) {
            extensions = [];
            _.each(groups, function (group) {
              const groupInfo = _.find(self.fileGroups, { name: group });
              if (!groupInfo) {
                return [];
              }
              extensions = extensions.concat(groupInfo.extensions);
            });
            return extensions;
          }
        }
        extensions = field.extensions ||
          (field.extension && [ field.extension ]);

        if (extensions) {
          if (!_.includes(extensions, attachment.extension)) {
            return extensions;
          }
        }
        return null;
      },
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
      async insert(req, file, options) {
        options = options || {};
        let extension = path.extname(file.name);
        if (extension && extension.length) {
          extension = extension.substr(1);
        }
        extension = extension.toLowerCase();
        // Do we *ever* accept this file extension?
        const group = self.getFileGroup(extension);

        if (!group) {
          // Uncomment the next line for all possibly acceptable file types.
          // const accepted = _.union(_.map(self.fileGroups, 'extensions'));

          throw self.apos.error('invalid', req.__('File type was not accepted'));
        }
        const info = {
          _id: self.apos.util.generateId(),
          group: group.name,
          createdAt: new Date(),
          name: self.apos.util.slugify(path.basename(file.name, path.extname(file.name))),
          title: self.apos.util.sortify(path.basename(file.name, path.extname(file.name))),
          extension: extension,
          type: 'attachment',
          docIds: [],
          trashDocIds: []
        };
        if (!(options.permissions === false)) {
          if (!self.apos.permission.can(req, 'edit-attachment')) {
            throw self.apos.error('forbidden');
          }
        }
        info.length = await self.apos.util.fileLength(file.path);
        info.md5 = await self.apos.util.md5File(file.path);
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
          info.ownerId = self.apos.permission.getEffectiveUserId(req);
        }
        info.createdAt = new Date();
        await self.db.insertOne(info);
        return info;
      },
      getFileGroup(extension) {
        return _.find(self.fileGroups, function (group) {
          const candidate = group.extensionMaps[extension] || extension;
          if (_.includes(group.extensions, candidate)) {
            return true;
          }
        });
      },
      async crop(req, _id, crop) {
        const info = await self.db.findOne({ _id: _id });
        if (!info) {
          throw self.apos.error('notfound');
        }
        if (!self.croppable[info.extension]) {
          throw new Error(info.extension + ' files cannot be cropped, do not present cropping UI for this type');
        }
        const crops = info.crops || [];
        const existing = _.find(crops, crop);
        if (existing) {
          // We're done, this crop is already available
          return;
        }
        // Pull the original out of cloud storage to a temporary folder where
        // it can be cropped and popped back into uploadfs
        const originalFile = '/attachments/' + info._id + '-' + info.name + '.' + info.extension;
        const tempFile = self.uploadfs.getTempPath() + '/' + self.apos.util.generateId() + '.' + info.extension;
        const croppedFile = '/attachments/' + info._id + '-' + info.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + info.extension;
        await Promise.promisify(self.uploadfs.copyOut)(originalFile, tempFile);
        await Promise.promisify(self.uploadfs.copyImageIn)(tempFile, croppedFile, { crop: crop });
        crops.push(crop);
        await self.db.updateOne({
          _id: info._id
        }, {
          $set: {
            crops
          }
        });
        await Promise.promisify(fs.unlink)(tempFile);
      },
      sanitizeCrop(crop) {
        crop = _.pick(crop, 'top', 'left', 'width', 'height');
        crop.top = self.apos.launder.integer(crop.top, 0, 0, 10000);
        crop.left = self.apos.launder.integer(crop.left, 0, 0, 10000);
        crop.width = self.apos.launder.integer(crop.width, 1, 1, 10000);
        crop.height = self.apos.launder.integer(crop.height, 1, 1, 10000);
        if (_.keys(crop).length < 4) {
          return undefined;
        }
        return crop;
      },
      // This method return a default icon url if an attachment is missing
      // to avoid template errors
      getMissingAttachmentUrl() {
        const defaultIconUrl = '/modules/@apostrophecms/attachment/img/missing-icon.svg';
        self.apos.util.warn('Template warning: Impossible to retrieve the attachment url since it is missing, a default icon has been set. Please fix this ASAP!');
        return defaultIconUrl;
      },
      // This method is available as a template helper: apos.attachment.url
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
      url(attachment, options) {
        options = options || {};
        if (!attachment) {
          return self.getMissingAttachmentUrl();
        }
        let path = '/attachments/' + attachment._id + '-' + attachment.name;
        if (!options.uploadfsPath) {
          path = self.uploadfs.getUrl() + path;
        }
        // Attachments can have "one true crop," or a crop can be passed with the options.
        // For convenience, be tolerant if options.crop is passed but doesn't
        // actually have valid cropping properties
        let c;
        if (options.crop !== false) {
          c = options.crop || attachment._crop || attachment.crop;
          if (c && c.width) {
            path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
          }
        }
        let effectiveSize;
        if (!self.isSized(attachment) || options.size === 'original') {
          effectiveSize = false;
        } else {
          effectiveSize = options.size || 'full';
        }
        if (effectiveSize) {
          path += '.' + effectiveSize;
        }
        return path + '.' + attachment.extension;
      },
      // This method is available as a template helper: apos.attachment.first
      //
      // Find the first attachment referenced within any object with
      // attachments as possible properties or sub-properties.
      //
      // For best performance be reasonably specific; don't pass an entire page or piece
      // object if you can pass page.thumbnail to avoid an exhaustive search, especially
      // if the page has many relationships.
      //
      // Returns the first attachment matching the criteria.
      //
      // For ease of use, a null or undefined `within` argument is accepted.
      //
      // Examples:
      //
      // 1. In the body please
      //
      // apos.attachment.first(page.body)
      //
      // 2. Must be a PDF
      //
      // apos.attachment.first(page.body, { extension: 'pdf' })
      //
      // 3. May be any office-oriented file type
      //
      // apos.attachment.first(page.body, { group: 'office' })
      //
      // apos.image.first is a convenience wrapper for fetching only images.
      //
      // OPTIONS:
      //
      // You may specify `extension`, `extensions` (an array of extensions)
      // or `group` to filter the results.
      first(within, options) {
        options = options ? _.clone(options) : {};
        options.limit = 1;
        return self.all(within, options)[0];
      },
      // This method is available as a template helper: apos.attachment.all
      //
      // Find all attachments referenced within an object, whether they are
      // properties or sub-properties (via relationships, etc).
      //
      // For best performance be reasonably specific; don't pass an entire page or piece
      // object if you can pass piece.thumbnail to avoid an exhaustive search, especially
      // if the piece has many relationships.
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
      // apos.attachment.all(page.body)
      //
      // 2. Must be a PDF
      //
      // apos.attachment.all(page.body, { extension: 'pdf' })
      //
      // 3. May be any office-oriented file type
      //
      // apos.attachment.all(page.body, { group: 'office' })
      //
      // apos.image.all is a convenience wrapper for fetching only images.
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
      all(within, options) {
        options = options || {};
        function test(attachment) {
          if (!attachment || typeof attachment !== 'object') {
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
        const winners = [];
        if (!within) {
          return [];
        }
        self.apos.doc.walk(within, function (o, key, value, dotPath, ancestors) {
          if (test(value)) {
            // If one of our ancestors has a relationship to the piece that
            // immediately contains us, provide that as the crop. This ensures
            // that cropping coordinates stored in an @apostrophecms/image widget
            // are passed through when we make a simple call to
            // apos.attachment.url with the returned object
            let i;
            for (i = ancestors.length - 1; i >= 0; i--) {
              const ancestor = ancestors[i];
              const fields = ancestor.imagesFields && ancestor.imagesFields[o._id];
              if (fields) {
                // Clone it so that if two things have crops of the same image, we
                // don't overwrite the value on subsequent calls
                value = _.clone(value);
                value._crop = _.pick(fields, 'top', 'left', 'width', 'height');
                value._focalPoint = _.pick(fields, 'x', 'y');
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
                _.each(self.imageSizes, function (size) {
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
      },
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
      async each(criteria, limit, each) {
        if (!each) {
          each = limit;
          limit = 1;
        }
        // "Why do we fetch a bucket of attachments at a time?" File operations
        // can be very slow. This can lead to MongoDB cursor timeouts in
        // tasks like @apostrophecms/attachment:rescale. We need a robust solution that
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
      },
      // Returns true if, based on the provided attachment object,
      // a valid focal point has been specified. Useful to avoid
      // the default of `background-position: center center` if
      // not desired.
      hasFocalPoint(attachment) {
        // No attachment object; tolerate for nunjucks friendliness
        if (!attachment) {
          return false;
        }
        // Specified directly on the attachment (it's not a relationship situation)
        if (typeof attachment.x === 'number') {
          return true;
        }
        // Specified on a `_focalPoint` property hoisted via a join
        return attachment._focalPoint && typeof attachment._focalPoint.x === 'number';
      },
      // If a focal point is present on the attachment, convert it to
      // CSS syntax for `background-position`. No trailing `;` is returned.
      // The coordinates are in percentage terms.
      focalPointToBackgroundPosition(attachment) {
        if (!self.hasFocalPoint(attachment)) {
          return 'center center';
        }
        const point = self.getFocalPoint(attachment);
        return point.x + '% ' + point.y + '%';
      },
      // Returns an object with `x` and `y` properties containing the
      // focal point chosen by the user, as percentages. If there is no
      // focal point, null is returned.
      getFocalPoint(attachment) {
        if (!self.hasFocalPoint(attachment)) {
          return null;
        }
        const x = attachment._focalPoint ? attachment._focalPoint.x : attachment.x;
        const y = attachment._focalPoint ? attachment._focalPoint.y : attachment.y;
        return {
          x: x,
          y: y
        };
      },
      // Returns true if this type of attachment is croppable.
      // Available as a template helper.
      isCroppable(attachment) {
        return attachment && self.croppable[attachment.extension];
      },
      // Returns true if this type of attachment is sized,
      // i.e. uploadfs produces versions of it for each configured
      // size, as it does with GIF, JPEG and PNG files.
      //
      // Accepts either an entire attachment object or an extension.
      isSized(attachment) {
        if (typeof attachment === 'object') {
          return self.sized[attachment.extension];
        } else {
          return self.sized[attachment];
        }
      },
      // When the last doc that contains this attachment goes to the
      // trash, its permissions should change to reflect that so
      // it is no longer web-accessible to those who know the URL.
      //
      // This method is invoked after any doc is inserted, updated, trashed
      // or rescued.
      async updateDocReferences(doc) {
        const attachments = self.all(doc);
        const ids = _.uniq(_.map(attachments, '_id'));
        // Build an array of mongo commands to run. Each
        // entry in the array is a 2-element array. Element 0
        // is the criteria, element 1 is the command
        const commands = [];
        if (!doc.trash) {
          commands.push([
            { _id: { $in: ids } },
            { $addToSet: { docIds: doc._id } }
          ], [
            { _id: { $in: ids } },
            { $pull: { trashDocIds: doc._id } }
          ]);
        } else {
          commands.push([
            { _id: { $in: ids } },
            { $addToSet: { trashDocIds: doc._id } }
          ], [
            { _id: { $in: ids } },
            { $pull: { docIds: doc._id } }
          ]);
        }
        commands.push([
          {
            $or: [
              { trashDocIds: { $in: [ doc._id ] } },
              { docIds: { $in: [ doc._id ] } }
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
          { _id: { $in: ids } },
          { $set: { utilized: true } }
        ]);
        for (const command of commands) {
          await self.db.updateMany(command[0], command[1]);
        }
        await self.updatePermissions();
      },
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
      async updatePermissions() {
        await hide();
        await show();
        async function hide() {
          const attachments = await self.db.find({
            utilized: true,
            'docIds.0': { $exists: 0 },
            trash: { $ne: true }
          }).toArray();
          for (const attachment of attachments) {
            await permissionsOne(attachment, true);
          }
        }
        async function show() {
          const attachments = await self.db.find({
            utilized: true,
            'docIds.0': { $exists: 1 },
            trash: { $ne: false }
          }).toArray();
          for (const attachment of attachments) {
            await permissionsOne(attachment, false);
          }
        }
        async function permissionsOne(attachment, trash) {
          await self.applyPermissions(attachment, trash);
          await self.db.updateOne({ _id: attachment._id }, { $set: { trash: trash } });
        }
      },
      // Enable or disable access to the given attachment via uploadfs, based on whether
      // trash is true or false. If the attachment is an image, access
      // to the size indicated by the `sizeAvailableInTrash` option
      // (usually `one-sixth`) remains available. This operation is carried
      // out across all sizes and crops.
      async applyPermissions(attachment, trash) {
        let method = trash ? self.uploadfs.disable : self.uploadfs.enable;
        method = Promise.promisify(method);
        await original();
        await crops();
        // Handle the original image and its scaled versions
        // here ("original" means "not cropped")
        async function original() {
          if (!trash && attachment.trash === undefined) {
            // Trash status not set at all yet means
            // it'll be a live file as of this point,
            // skip extra API calls
            return;
          }
          let sizes;
          if (!_.includes([
            'gif',
            'jpg',
            'png'
          ], attachment.extension)) {
            sizes = [ { name: 'original' } ];
          } else {
            sizes = self.imageSizes.concat([ { name: 'original' } ]);
          }
          for (const size of sizes) {
            if (size.name === self.sizeAvailableInTrash) {
              // This size is always kept accessible for preview
              // in the media library
              continue;
            }
            const path = self.url(attachment, {
              uploadfsPath: true,
              size: size.name
            });
            try {
              await method(path);
            } catch (e) {
              // afterSave is not a good place for fatal errors
              self.apos.util.warn('Unable to set permissions on ' + path + ', most likely already done');
            }
          }
        }
        async function crops() {
          if (!trash && attachment.trash === undefined) {
            // Trash status not set at all yet means
            // it'll be a live file as of this point,
            // skip extra API calls
            return;
          }
          for (const crop of attachment.crops || []) {
            await cropOne(crop);
          }
        }
        async function cropOne(crop) {
          for (const size of self.imageSizes.concat([ { name: 'original' } ])) {
            if (size.name === self.sizeAvailableInTrash) {
              // This size is always kept accessible for preview
              // in the media library
              continue;
            }
            const path = self.url(attachment, {
              crop: crop,
              uploadfsPath: true,
              size: size.name
            });
            try {
              await method(path);
            } catch (e) {
              // afterSave is not a good place for fatal errors
              self.apos.util.warn('Unable to set permissions on ' + path + ', possibly it does not exist');
            }
          }
        }
      },
      async migrateToDisabledFileKeyTask(argv) {
        await Promise.promisify(self.uploadfs.migrateToDisabledFileKey)();
      },
      async migrateFromDisabledFileKeyTask(argv) {
        await Promise.promisify(self.uploadfs.migrateFromDisabledFileKey)();
      },
      getBrowserData(req) {
        return {
          action: self.action,
          fileGroups: self.fileGroups,
          name: self.name,
          uploadsUrl: self.uploadfs.getUrl(),
          croppable: self.croppable,
          sized: self.sized
        };
      },
      // Middleware method used when only those with attachment privileges should be allowed to do something
      canUpload(req, res, next) {
        if (!self.apos.permission.can(req, 'edit-attachment')) {
          res.statusCode = 403;
          return res.send({
            type: 'forbidden',
            message: req.__('You do not have permission to upload a file')
          });
        }
        next();
      }
    };
  },
  helpers: [
    'url',
    'first',
    'all',
    'hasFocalPoint',
    'getFocalPoint',
    'focalPointToBackgroundPosition',
    'isCroppable'
  ]
};
