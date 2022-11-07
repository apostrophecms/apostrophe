const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const Promise = require('bluebird');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

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

  async init(self) {
    // For convenience and bc
    self.uploadfs = self.apos.uploadfs;
    // uploadfs expects an array
    self.imageSizes = Object.keys(self.imageSizes).map(name => ({
      name,
      ...self.imageSizes[name]
    }));
    self.name = 'attachment';
    self.fileGroups = self.options.fileGroups || [
      {
        name: 'images',
        label: 'apostrophe:images',
        extensions: [
          'gif',
          'jpg',
          'png',
          'svg',
          'webp'
        ],
        extensionMaps: { jpeg: 'jpg' },
        // uploadfs should treat this as an image and create scaled versions
        image: true
      },
      {
        name: 'office',
        label: 'apostrophe:office',
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

    if (self.options.addFileGroups) {
      self.options.addFileGroups.forEach(newGroup => {
        self.addFileGroup(newGroup);
      });
    };

    // Do NOT add keys here unless they have the value `true`
    self.croppable = {
      gif: true,
      jpg: true,
      png: true,
      webp: true
    };

    // Do NOT add keys here unless they have the value `true`
    self.sized = {
      gif: true,
      jpg: true,
      png: true,
      webp: true
    };

    self.sizeAvailableInArchive = self.options.sizeAvailableInArchive || 'one-sixth';

    self.rescaleTask = require('./lib/tasks/rescale.js')(self);
    self.addFieldType();
    self.enableBrowserData();

    self.db = await self.apos.db.collection('aposAttachments');
    await self.db.createIndex({ docIds: 1 });
    await self.db.createIndex({ archivedDocIds: 1 });
    self.addLegacyMigrations();
    self.addSvgSanitizationMigration();
  },

  tasks(self) {
    return {
      rescale: {
        usage: 'Usage: node app @apostrophecms/attachment:rescale\n\nRegenerate all sizes of all image attachments. Useful after a new size\nis added to the configuration. Takes a long time!',
        task: self.rescaleTask
      },
      'migrate-to-disabled-file-key': {
        usage: 'Usage: node app @apostrophecms/attachment:migrate-to-disabled-file-key\n\nThis task should be run after adding the disabledFileKey option to uploadfs\nfor the first time. It should only be relevant for storage backends where\nthat option is not mandatory, i.e. only local storage as of this writing.',
        task: self.migrateToDisabledFileKeyTask
      },
      'migrate-from-disabled-file-key': {
        usage: 'Usage: node app @apostrophecms/attachment:migrate-from-disabled-file-key\n\nThis task should be run after removing the disabledFileKey option from uploadfs.\nIt should only be relevant for storage backends where\n' + 'that option is not mandatory, i.e. only local storage as of this writing.',
        task: self.migrateFromDisabledFileKeyTask
      },
      'recompute-all-doc-references': {
        usage: 'Recompute mapping between attachments and docs,\nshould only be needed for rare repair situations',
        task: self.recomputeAllDocReferences
      }
    };
  },

  // TODO RESTify where possible
  apiRoutes(self) {
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
              const file = Object.values(req.files || {})[0];

              if (!file) {
                throw self.apos.error('invalid');
              }

              const attachment = await self.insert(req, file);
              self.all({ attachment }, { annotate: true });

              return attachment;
            } finally {
              for (const file of (Object.values(req.files || {}))) {
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
            const { crop } = req.body;

            if (!_id || !crop || typeof crop !== 'object' || Array.isArray(crop)) {
              throw self.apos.error('invalid');
            }

            const sanitizedCrop = self.sanitizeCrop(crop);

            if (!sanitizedCrop) {
              throw self.apos.error('invalid');
            }

            await self.crop(req, _id, sanitizedCrop);

            return true;
          }
        ]
      }
    };
  },
  handlers(self) {
    return {
      '@apostrophecms/doc-type:afterSave': {
        async updateDocReferencesAfterSave(req, doc, options) {
          return self.updateDocReferences(doc);
        }
      },
      '@apostrophecms/doc-type:afterArchive': {
        async updateDocReferencesAfterArchive(req, doc) {
          return self.updateDocReferences(doc);
        }
      },
      '@apostrophecms/doc-type:afterRescue': {
        async updateDocReferencesAfterRescue(req, doc) {
          return self.updateDocReferences(doc);
        }
      },
      '@apostrophecms/doc-type:afterDelete': {
        async updateDocReferencesAfterDelete(req, doc) {
          return self.updateDocReferences(doc, {
            deleted: true
          });
        }
      }
    };
  },
  methods(self) {
    return {
      addFieldType() {
        self.apos.schema.addFieldType({
          name: self.name,
          convert: self.convert,
          index: self.index,
          register: self.register
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

        // Check if the file type is acceptable
        const correctedExtensions = self.checkExtension(field, info);

        if (correctedExtensions) {
          const message = req.t('apostrophe:fileTypeNotAccepted', {
            // i18next has no built-in support for interpolating an array argument
            extensions: correctedExtensions.join(req.t('apostrophe:listJoiner'))
          });
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
      index(value, field, texts) {
        const silent = field.silent === undefined ? true : field.silent;
        texts.push({
          weight: field.weight || 15,
          text: (value && value.title) || '',
          silent: silent
        });
      },
      // When the field is registered in the schema,
      // canonicalize .group and .extensions and .extension
      // into .accept for convenience, as a comma-separated
      // list of dotted file extensions suitable to pass to
      // the "accept" HTML5 attribute, including mapped extensions
      // like jpeg. If none of these options are set, .accept is
      // set to an array of all accepted file extensions across
      // all groups
      register(metaType, type, field) {
        let fileGroups = self.fileGroups;
        if (field.fileGroups) {
          fileGroups = fileGroups.filter(group => field.fileGroups.includes(group.name));
        }
        if (field.fileGroup) {
          fileGroups = fileGroups.filter(group => group.name === field.fileGroup);
        }
        let extensions = [];
        fileGroups.forEach(group => {
          extensions = [ ...extensions, ...group.extensions ];
        });
        if (field.extensions) {
          extensions = extensions.filter(extension => field.extensions.includes(extension));
        }
        if (field.extension) {
          extensions = extensions.filter(extension => extension === field.extension);
        }
        fileGroups.forEach(group => {
          for (const [ from, to ] of Object.entries(group.extensionMaps || {})) {
            if (extensions.includes(to) && (!extensions.includes(from))) {
              extensions.push(from);
            }
          }
        });
        field.accept = extensions.map(extension => `.${extension}`).join(',');
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
          const accepted = _.union(_.map(self.fileGroups, 'extensions')).flat();
          throw self.apos.error('invalid', req.t('apostrophe:fileTypeNotAccepted', {
            extensions: accepted.join(req.t('apostrophe:listJoiner'))
          }));
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
          archivedDocIds: []
        };
        if (!(options.permissions === false)) {
          if (!self.apos.permission.can(req, 'upload-attachment')) {
            throw self.apos.error('forbidden');
          }
        }
        info.length = await self.apos.util.fileLength(file.path);
        info.md5 = await self.apos.util.md5File(file.path);
        if (info.extension === 'svg') {
          try {
            await self.sanitizeSvg(file.path);
          } catch (e) {
            // Currently DOMPurify passes invalid SVG content without comment as long
            // as it's not an SVG XSS attack vector, but make provision to report
            // a relevant error if that changes
            throw self.apos.error('invalid', req.t('apostrophe:fileInvalid'));
          }
        }
        if (self.isSized(extension)) {
          // For images we correct automatically for common file extension mistakes
          const result = await Promise.promisify(self.uploadfs.copyImageIn)(file.path, '/attachments/' + info._id + '-' + info.name, { sizes: self.imageSizes });
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
        info.createdAt = new Date();
        await self.db.insertOne(info);
        return info;
      },
      // Given a path to a local svg file, sanitize any XSS attack vectors that
      // may be present in the file. The caller is responsible for catching any
      // exception thrown and treating that as an invalid file but there is no
      // guarantee that invalid SVG files will be detected or cleaned up, only
      // XSS attacks.
      async sanitizeSvg(path) {
        const readFile = require('util').promisify(fs.readFile);
        const writeFile = require('util').promisify(fs.writeFile);
        const window = new JSDOM('').window;
        const DOMPurify = createDOMPurify(window);
        const dirty = await readFile(path);
        const clean = DOMPurify.sanitize(dirty);
        return writeFile(path, clean);
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
        const info = await self.db.findOne({ _id });

        if (!info) {
          throw self.apos.error('notfound');
        }

        if (!self.croppable[info.extension]) {
          throw self.apos.error('invalid', req.t('apostrophe:fileTypeCannotBeCropped', {
            extension: info.extension
          }));
        }
        const crops = info.crops || [];
        const existing = _.find(crops, crop);

        if (existing) {
          // We're done, this crop is already available
          return;
        }
        // Pull the original out of cloud storage to a temporary folder where
        // it can be cropped and popped back into uploadfs
        const originalFile = `/attachments/${info._id}-${info.name}.${info.extension}`;
        const tempFile = `${self.uploadfs.getTempPath()}/${self.apos.util.generateId()}.${info.extension}`;
        const croppedFile = `/attachments/${info._id}-${info.name}.${crop.left}.${crop.top}.${crop.width}.${crop.height}.${info.extension}`;

        await Promise.promisify(self.uploadfs.copyOut)(originalFile, tempFile);
        await Promise.promisify(self.uploadfs.copyImageIn)(tempFile, croppedFile, {
          crop: crop,
          sizes: self.imageSizes
        });

        await self.db.updateOne({
          _id: info._id
        }, {
          $set: {
            crops: [
              ...crops,
              crop
            ]
          }
        });
        await Promise.promisify(fs.unlink)(tempFile);
      },
      sanitizeCrop(crop) {
        const neededProps = [ 'top', 'left', 'width', 'height' ];
        const { integer: sanitizeInteger } = self.apos.launder;

        if (neededProps.some((prop) => !Object.keys(crop).includes(prop))) {
          return null;
        }

        return {
          top: sanitizeInteger(crop.top, 0, 0, 10000),
          left: sanitizeInteger(crop.left, 0, 0, 10000),
          width: sanitizeInteger(crop.width, 0, 0, 10000),
          height: sanitizeInteger(crop.height, 0, 0, 10000)
        };
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
      // For best performance be reasonably specific; don't pass an entire page
      // or piece object if you can pass piece.thumbnail to avoid an exhaustive
      // search, especially if the piece has many relationships.
      //
      // Returns an array of attachments, or an empty array if none are found.
      //
      // When available, the `description`, `credit`, `alt` and `creditUrl`
      // properties of the containing piece are returned as `_description`,
      // `_credit`, `_alt` and `_creditUrl`.
      //
      // For ease of use, a null or undefined `within` argument is accepted,
      // resulting in an empty array.
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
        const winners = [];
        if (!within) {
          return [];
        }
        self.apos.doc.walk(within, function (o, key, value, dotPath, ancestors) {
          if (test(value)) {
            if (o.credit) {
              value._credit = o.credit;
            }
            if (o.creditUrl) {
              value._creditUrl = o.creditUrl;
            }
            if (o.alt) {
              value._alt = o.alt;
            }

            value._isCroppable = self.isCroppable(value);

            o[key] = value;

            // If one of our ancestors has a relationship to the piece that
            // immediately contains us, provide that as the crop. This ensures
            // that cropping coordinates stored in an @apostrophecms/image widget
            // are passed through when we make a simple call to
            // apos.attachment.url with the returned object
            for (let i = ancestors.length - 1; i >= 0; i--) {
              const ancestor = ancestors[i];
              const ancestorFields = ancestor.attachment &&
                ancestor.attachment._id === value._id && ancestor._fields;

              if (ancestorFields) {
                value = _.clone(value);
                o.attachment = value;
                value._crop = ancestorFields.width ? _.pick(ancestorFields, 'width', 'height', 'top', 'left') : undefined;
                value._focalPoint = (typeof ancestorFields.x === 'number') ? _.pick(ancestorFields, 'x', 'y') : undefined;
                break;
              }
            }

            if (options.annotate) {
              // Add URLs
              value._urls = {};
              if (value._crop) {
                value._urls.uncropped = {};
              }
              if (value.group === 'images') {
                _.each(self.imageSizes, function (size) {
                  value._urls[size.name] = self.url(value, { size: size.name });
                  if (value._crop) {
                    value._urls.uncropped[size.name] = self.url(value, {
                      size: size.name,
                      crop: false
                    });
                  }
                });
                value._urls.original = self.url(value, { size: 'original' });
                if (value._crop) {
                  value._urls.uncropped.original = self.url(value, {
                    size: 'original',
                    crop: false
                  });
                }
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
          const docs = await self.db.find({
            ...(criteria || {}),
            _id: { $gt: lastId }
          }).limit(batchSize).sort({ _id: 1 }).toArray();
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
      // CSS syntax for `object-position`. No trailing `;` is returned.
      // The coordinates are in percentage terms.
      focalPointToObjectPosition(attachment) {
        if (!self.hasFocalPoint(attachment)) {
          return 'center center';
        }
        const point = self.getFocalPoint(attachment);
        return `${point.x}% ${point.y}%`;
      },
      // Returns the effective attachment width.
      getWidth(attachment) {
        return attachment._crop ? attachment._crop.width : attachment.width;
      },
      // Returns the effective attachment height.
      getHeight(attachment) {
        return attachment._crop ? attachment._crop.height : attachment.height;
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
        return (attachment &&
          self.croppable[self.resolveExtension(attachment.extension)]) ||
          false;
      },
      // Returns true if this type of attachment is sized,
      // i.e. uploadfs produces versions of it for each configured
      // size, as it does with GIF, JPEG and PNG files.
      //
      // Accepts either an entire attachment object or an extension.
      isSized(attachment) {
        if ((typeof attachment) === 'object') {
          return self.sized[self.resolveExtension(attachment.extension)];
        } else {
          return self.sized[self.resolveExtension(attachment)];
        }
      },
      // Resolve a file extension such as jpeg to its canonical form (jpg).
      // If no extension map is configured for this extension, return it as-is.
      resolveExtension(extension) {
        const group = self.getFileGroup(extension);
        if (group) {
          return group.extensionMaps[extension] || extension;
        }
        return extension;
      },
      // When the last doc that contains an attachment goes to the
      // archive, its permissions should change to reflect that so
      // it is no longer web-accessible to those who know the URL.
      //
      // If an attachment has no more archived *or* live docs associated
      // with it, truly delete the attachment.
      //
      // This method is invoked after any doc is inserted, updated, archived
      // or restored.
      //
      // If a document is truly deleted, call with the `{ deleted: true}` option.
      async updateDocReferences(doc, options = {
        deleted: false
      }) {
        const attachments = self.all(self.apos.util.clonePermanent(doc));
        const ids = _.uniq(_.map(attachments, '_id'));
        // Build an array of mongo commands to run. Each
        // entry in the array is a 2-element array. Element 0
        // is the criteria, element 1 is the command
        const commands = [];
        if (options.deleted) {
          commands.push([
            { _id: { $in: ids } },
            {
              $pull: {
                docIds: doc._id,
                archivedDocIds: doc._id
              }
            }
          ]);
        } else if (!doc.archived) {
          commands.push([
            { _id: { $in: ids } },
            { $addToSet: { docIds: doc._id } }
          ], [
            { _id: { $in: ids } },
            { $pull: { archivedDocIds: doc._id } }
          ]);
        } else {
          commands.push([
            { _id: { $in: ids } },
            { $addToSet: { archivedDocIds: doc._id } }
          ], [
            { _id: { $in: ids } },
            { $pull: { docIds: doc._id } }
          ]);
        }
        commands.push([
          {
            $or: [
              { archivedDocIds: { $in: [ doc._id ] } },
              { docIds: { $in: [ doc._id ] } }
            ],
            _id: { $nin: ids }
          },
          {
            $pull: {
              archivedDocIds: doc._id,
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
        await self.alterAttachments();
      },
      // Enable/disable access in uploadfs to all attachments
      // based on whether the documents containing them
      // are in the archive or not. Specifically, if an attachment
      // has been utilized at least once but no longer has
      // any entries in `docIds` and `archived` is not yet true,
      // it becomes web-inaccessible, `utilized` is set to false
      // and `archived` is set to true. Similarly, if an attachment
      // has entries in `docIds` but `archived` is true,
      // it becomes web-accessible and archived becomes false.
      //
      // This method is invoked at the end of `updateDocReferences`
      // and also at the end of the migration that adds `docIds`
      // to legacy sites. You should not need to invoke it yourself.
      //
      // This method also handles actually deleting attachments
      // if they have been utilized but are no longer associated
      // with any document, not even in the archive, as will occur
      // if the document is truly deleted.
      async alterAttachments() {
        await hide();
        await show();
        await _delete();
        async function hide() {
          const attachments = await self.db.find({
            utilized: true,
            'docIds.0': { $exists: 0 },
            archived: { $ne: true }
          }).toArray();
          for (const attachment of attachments) {
            await alterOne(attachment, 'disable');
          }
        }
        async function show() {
          const attachments = await self.db.find({
            utilized: true,
            'docIds.0': { $exists: 1 },
            archived: { $ne: false }
          }).toArray();
          for (const attachment of attachments) {
            await alterOne(attachment, 'enable');
          }
        }
        async function _delete() {
          const attachments = await self.db.find({
            utilized: true,
            'docIds.0': { $exists: 0 },
            'archivedDocIds.0': { $exists: 0 }
          }).toArray();
          for (const attachment of attachments) {
            await alterOne(attachment, 'remove');
          }
        }
        async function alterOne(attachment, action) {
          await self.alterAttachment(attachment, action);
          if (action === 'remove') {
            await self.db.removeOne({ _id: attachment._id });
          } else {
            await self.db.updateOne({
              _id: attachment._id
            }, {
              $set: {
                archived: (action === 'disable')
              }
            });
          }
        }
      },
      // Enable access, disable access, or truly remove the given attachment via uploadfs,
      // based on whether `action` is `enable`, `disable`, or `remove`. If the attachment
      // is an image, access to the size indicated by the `sizeAvailableInArchive` option
      // (usually `one-sixth`) remains available except when removing. This operation is carried
      // out across all sizes and crops.
      async alterAttachment(attachment, action) {
        let method = self.uploadfs[action];
        method = Promise.promisify(method);
        await original();
        await crops();
        // Handle the original image and its scaled versions
        // here ("original" means "not cropped")
        async function original() {
          if ((action === 'enable') && attachment.archived === undefined) {
            // Archive status not set at all yet means
            // it'll be a live file as of this point,
            // skip extra API calls
            return;
          }
          let sizes;
          if (![ 'gif', 'jpg', 'png', 'webp' ].includes(self.resolveExtension(attachment.extension))) {
            sizes = [ { name: 'original' } ];
          } else {
            sizes = self.imageSizes.concat([ { name: 'original' } ]);
          }
          for (const size of sizes) {
            if ((action !== 'remove') && (size.name === self.sizeAvailableInArchive)) {
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
              self.apos.util.warn(`Unable to ${action} ${path}, most likely already done`);
            }
          }
        }
        async function crops() {
          if ((action === 'enable') && (attachment.archived === undefined)) {
            // Archive status not set at all yet means
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
            if (size.name === self.sizeAvailableInArchive) {
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
              self.apos.util.warn(`Unable to ${action} ${path}, most likely already done`);
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
          // for bc
          uploadsUrl: self.uploadfs.getUrl(),
          croppable: self.croppable,
          sized: self.sized
        };
      },
      // Middleware method used when only those with attachment privileges should be allowed to do something
      canUpload(req, res, next) {
        if (!self.apos.permission.can(req, 'upload-attachment')) {
          res.statusCode = 403;
          return res.send({
            type: 'forbidden',
            message: req.t('apostrophe:uploadForbidden')
          });
        }
        next();
      },
      // Recompute the `docIds` and `archivedDocIds` arrays
      // from scratch. Should only be needed by the
      // one-time migration that fixes these for older
      // databases, but can be run at any time via the
      // `apostrophe-attachments:recompute-doc-references`
      // task.
      async recomputeAllDocReferences() {
        const attachmentUpdates = {};
        await self.apos.migration.eachDoc({}, 5, addAttachmentUpdates);
        await attachments();
        await self.alterAttachments();

        async function addAttachmentUpdates(doc) {
          const attachments = self.all(doc);
          const ids = _.uniq(_.map(attachments, '_id'));
          _.each(ids, function(id) {
            attachmentUpdates[id] = attachmentUpdates[id] || {
              $set: {
                docIds: [],
                archivedDocIds: []
              }
            };
            if (doc.archived) {
              attachmentUpdates[id].$set.archivedDocIds.push(doc._id);
            } else {
              attachmentUpdates[id].$set.docIds.push(doc._id);
            }
            attachmentUpdates[id].$set.utilized = true;
          });
        }

        async function attachments(callback) {
          const bulk = self.db.initializeUnorderedBulkOp();
          let count = 0;
          _.each(attachmentUpdates, function(updates, id) {
            const c = bulk.find({ _id: id });
            _.each(updates, function(update) {
              c.updateOne(attachmentUpdates[id]);
              count++;
            });
          });
          if (!count) {
            return;
          }
          return bulk.execute();
        }
      },
      async addSvgSanitizationMigration() {
        self.apos.migration.add('svg-sanitization', async () => {
          return self.each({
            extension: 'svg',
            sanitized: {
              $ne: true
            }
          }, 1, async attachment => {
            const tempFile = self.uploadfs.getTempPath() + '/' + self.apos.util.generateId() + '.' + attachment.extension;
            const copyIn = require('util').promisify(self.uploadfs.copyIn);
            const copyOut = require('util').promisify(self.uploadfs.copyOut);
            const uploadfsPath = self.url(attachment, { uploadfsPath: true });
            try {
              await copyOut(uploadfsPath, tempFile);
              await self.sanitizeSvg(tempFile);
              await copyIn(tempFile, uploadfsPath);
              await self.db.updateOne({
                _id: attachment._id
              }, {
                $set: {
                  sanitized: true
                }
              });
            } catch (e) {
              console.error(e);
              // This condition shouldn't occur, but do warn the operator if it does
              // (possibly on input that is not really an SVG file at all)
              self.apos.util.error(`Warning: unable to sanitize SVG file ${uploadfsPath}`);
            }
          });
        });
      },

      addFileGroup(newGroup) {
        if (self.fileGroups.some(existingGroup => existingGroup.name === newGroup.name)) {
          const existingGroup = self.fileGroups.find(existingGroup => existingGroup.name === newGroup.name);
          if (newGroup.extensions) {
            existingGroup.extensions = [ ...existingGroup.extensions, ...newGroup.extensions ];
          };
          if (newGroup.extensionMaps) {
            existingGroup.extensionMaps = {
              ...existingGroup.extensionMaps,
              ...newGroup.extensionMaps
            };
          }
        } else {
          self.fileGroups.push(newGroup);
        }
      },
      ...require('./lib/legacy-migrations')(self)
    };
  },
  helpers: [
    'url',
    'first',
    'all',
    'hasFocalPoint',
    'getFocalPoint',
    'focalPointToObjectPosition',
    'getWidth',
    'getHeight',
    'isCroppable'
  ]
};
