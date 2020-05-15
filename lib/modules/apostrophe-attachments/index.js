// This module implements the
// [attachment](/reference/field-types/attachment.md) schema field type,
// which makes it straightforward to allow users to attach uploaded files to docs.
//
// ## Options
//
// ### `addImageSizes`
//
// Add an array of image sizes, in addition to Apostrophe's standard sizes. For example:
//
// ```javascript
// [
//   {
//      name: 'tiny',
//      width: 100,
//      height: 100
//   }
// ]
// ```
//
// The resulting image *will not exceeed* either dimension given, and will preserve its
// aspect ratio.
//
// These extra sizes are then available as the `size` option to `apostrophe-images` widgets
// and when calling `apos.attachments.url`.
//
// ### `imageSizes`
//
// Like `addImageSizes`, but Apostrophe's standard sizes are completely replaced. Bear in mind
// that certain sizes are used by Apostrophe's editing interface unless overridden. We recommend
// using `addImageSizes`.
//
// ### `fileGroups`
//
// Apostrophe will reject files that do not have extensions configured via `fileGroups`.
// the default setting is:
//
// ```
// [
//   {
//     name: 'images',
//     label: 'Images',
//     extensions: [ 'gif', 'jpg', 'png' ],
//     extensionMaps: {
//       jpeg: 'jpg'
//     },
//     // uploadfs should treat this as an image and create scaled versions
//     image: true
//   },
//   {
//     name: 'office',
//     label: 'Office',
//     extensions: [ 'txt', 'rtf', 'pdf', 'xls', 'ppt', 'doc', 'pptx', 'sldx', 'ppsx', 'potx', 'xlsx', 'xltx', 'csv', 'docx', 'dotx' ],
//     extensionMaps: {},
//     // uploadfs should just accept this file as-is
//     image: false
//   }
// ]
// ```
//
// NOTE: adding another extension for `images` will not make web browsers
// magically know how to show it or teach uploadfs how to scale it. So don't do that.
// However, see `svgImages` below.
//
// You may add extensions to the `office` fileGroup.
//
// ## `svgImages`
//
// If set to `true`, SVGs are permitted to be uploaded as "images" in Apostrophe. This
// means they may appear in any widget that uses images, such as the `apostrophe-images`
// widget. Since programmatically cropping SVGs across all possible SVG configurations is
// difficult if not impossible, manual cropping is not permitted, and autocropping does
// not take place either, even if an `aspectRatio` option is present for the widget.
// To help you account for this, the CSS class `apos-slideshow-item--svg` is added
// to the relevant item in the slideshow on the front end. And, the standard `widgetBase.html`
// for this module works together with styles provided in `always.less` to do something
// reasonable, presenting the svg with `background-size: contain`, which leverages the
// fact that most SVGs play very nicely with your background.
//
// If you have overridden `widget.html` for `apostrophe-images-widgets`, view recent commits
// on `widgetBase.html` to see how to implement this technique yourself.

var _ = require('@sailshq/lodash');
var uploadfs = require('uploadfs');
var mkdirp = require('mkdirp');
var async = require('async');

module.exports = {

  alias: 'attachments',

  singletonWarningIfNot: 'apostrophe-attachments',

  afterConstruct: function(self, callback) {
    return async.series({
      enableCollection: function(callback) {
        return self.enableCollection(callback);
      },
      initUploadfs: function(callback) {
        return self.initUploadfs(callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      self.on('apostrophe:migrate', 'ensureIndexesPromisified', function() {
        return require('bluebird').promisify(self.ensureIndexes)();
      });
      self.addFieldType();
      self.pushAssets();
      self.pushCreateSingleton();
      self.enableHelpers();
      self.addTypeMigration();
      self.addDocReferencesMigration();
      self.addFixPermissionsMigration();
      self.addPermissions();
      self.apos.tasks.add('apostrophe-attachments', 'rescale',
        'Usage: node app apostrophe-attachments:rescale\n\n' +
        'Regenerate all sizes of all image attachments. Useful after a new size\n' +
        'is added to the configuration. Takes a long time!',
        function(apos, argv, callback) {
          return self.rescaleTask(argv, callback);
        }
      );
      self.apos.tasks.add('apostrophe-attachments', 'migrate-to-disabled-file-key',
        'Usage: node app apostrophe-attachments:migrate-to-disabled-file-key\n\n' +
        'This task should be run after adding the disabledFileKey option to uploadfs\n' +
        'for the first time. It should only be relevant for storage backends where\n' +
        'that option is not mandatory, i.e. only local storage as of this writing.',
        function(apos, argv, callback) {
          return self.migrateToDisabledFileKeyTask(argv, callback);
        }
      );
      self.apos.tasks.add('apostrophe-attachments', 'migrate-from-disabled-file-key',
        'Usage: node app apostrophe-attachments:migrate-from-disabled-file-key\n\n' +
        'This task should be run after removing the disabledFileKey option from uploadfs.\n' +
        'It should only be relevant for storage backends where\n' +
        'that option is not mandatory, i.e. only local storage as of this writing.',
        function(apos, argv, callback) {
          return self.migrateFromDisabledFileKeyTask(argv, callback);
        }
      );
      self.apos.tasks.add('apostrophe-attachments', 'urls',
        'Usage: node app apostrophe_attachments:urls --uploadfs-path\n\n' +
        'This task prints the URLs of all attachments, including all cropped and scaled versions.\n' +
        'If --uploadfs-path is present, the uploadfs path is printed, not a complete URL.',
        function(apos, argv, callback) {
          return self.urlsTask(callback);
        }
      );
      self.addRecomputeAllDocReferencesTask();
      self.addResetUploadfsPermissionsTask();
      return callback(null);
    });

  },

  construct: function(self, options) {
    self.name = 'attachment';

    self.fileGroups = options.fileGroups || [
      {
        name: 'images',
        label: 'Images',
        extensions: [ 'gif', 'jpg', 'png' ].concat(options.svgImages ? [ 'svg' ] : []),
        extensionMaps: {
          jpeg: 'jpg'
        },
        // uploadfs should treat this as an image and create scaled versions
        image: true
      },
      {
        name: 'office',
        label: 'Office',
        extensions: [ 'txt', 'rtf', 'pdf', 'eps', 'xls', 'ppt', 'doc', 'pptx', 'sldx', 'ppsx', 'potx', 'xlsx', 'xltx', 'csv', 'docx', 'dotx' ],
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

    self.imageSizes = (options.imageSizes || [
      {
        name: 'max',
        width: 1600,
        height: 1600
      },
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
    ]).concat(options.addImageSizes || []);

    self.sizeAvailableInTrash = options.sizeAvailableInTrash || 'one-sixth';

    var uploadfsDefaultSettings = {
      backend: 'local',
      uploadsPath: self.apos.rootDir + '/public/uploads',
      uploadsUrl: (self.apos.baseUrl || '') + self.apos.prefix + '/uploads',
      tempPath: self.apos.rootDir + '/data/temp/uploadfs',
      // Register Apostrophe's standard image sizes. Notice you could
      // concatenate your own list of sizes if you had a need to
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

    self.initUploadfs = function(callback) {
      safeMkdirp(self.uploadfsSettings.uploadsPath);
      safeMkdirp(self.uploadfsSettings.tempPath);
      self.uploadfs = uploadfs();
      self.uploadfs.init(self.uploadfsSettings, callback);
      function safeMkdirp(path) {
        try {
          mkdirp.sync(path);
        } catch (e) {
          if (require('fs').existsSync(path)) {
            // race condition in mkdirp but all is well
          } else {
            throw e;
          }
        }
      }
    };

    self.apostropheDestroy = function(callback) {
      if (!self.uploadfs.destroy) {
        self.apos.utils.warn('uploadfs dependency is old, cannot clean up resources i.e. timers that will prevent exit');
        return callback(null);
      }
      return self.uploadfs.destroy(callback);
    };

    self.enableCollection = function(callback) {
      return self.apos.db.collection('aposAttachments', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

    self.ensureIndexes = function(callback) {
      return async.series([ indexDocIds, indexTrashDocIds ], callback);
      function indexDocIds(callback) {
        return self.db.ensureIndex({ docIds: 1 }, callback);
      }
      function indexTrashDocIds(callback) {
        return self.db.ensureIndex({ trashDocIds: 1 }, callback);
      }
    };

    self.enableHelpers = function() {
      self.addHelpers(_.pick(self, 'url', 'first', 'all', 'hasFocalPoint', 'getFocalPoint', 'focalPointToBackgroundPosition', 'isCroppable'));
    };

    self.addPermissions = function() {
      self.apos.permissions.add({
        value: 'edit-attachment',
        // We need the edit- prefix so those with the blanket editor permission
        // are good to go, but for a label we want to convey that this is
        // something almost everyone with editing privileges anywhere should be given
        label: 'Upload & Crop'
      });
    };

    self.rescaleTask = require('./lib/tasks/rescale.js')(self);

    require('./lib/schemaField')(self, options);
    require('./lib/api')(self, options);
    require('./lib/routes')(self, options);
    require('./lib/browser')(self, options);

  }
};
