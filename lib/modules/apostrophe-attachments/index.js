// This module implements the
// [attachment](../../tutorials/getting-started/schema-guide.html#attachment) schema field type,
// which makes it straightforward to allow users to attach uploaded files to docs. See
// the [schema guide](../../tutorials/getting-started/schema-guide.html#attachment) for
// more information.
//
// ## Options
//
// ### `addImageSizes`
//
// Add an array of image sizes, in addition to Apostrophe's standard sizes. For example:
//
//```javascript
// [
//   {
//      name: 'tiny',
//      width: 100,
//      height: 100
//   }
// ]
//```
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
//```
//
// NOTE: adding another extension for `images` will not make web browsers
// magically know how to show it or teach uploadfs how to scale it. Don't do that.
//
// You may add extensions to the `office` fileGroup.

var _ = require('lodash');
var uploadfs = require('uploadfs');
var mkdirp = require('mkdirp');
var async = require('async');

module.exports = {

  alias: 'attachments',

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
      self.addFieldType();
      self.pushAssets();
      self.pushCreateSingleton();
      self.enableHelpers();
      self.addTypeMigration();
      self.addPermissions();
      self.apos.tasks.add('apostrophe-attachments', 'rescale',
        'Usage: node app apostrophe-attachments:rescale\n\n' +
        'Regenerate all sizes of all image attachments. Useful after a new size\n' +
        'is added to the configuration. Takes a long time!',
        function(apos, argv, callback) {
          return self.rescaleTask(argv, callback);
        }
      );
      return callback(null);
    });

  },

  construct: function(self, options) {
    self.name = 'attachment';

    self.fileGroups = options.fileGroups || [
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
        extensions: [ 'txt', 'rtf', 'pdf', 'xls', 'ppt', 'doc', 'pptx', 'sldx', 'ppsx', 'potx', 'xlsx', 'xltx', 'csv', 'docx', 'dotx' ],
        extensionMaps: {},
        // uploadfs should just accept this file as-is
        image: false
      },
    ];

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
      mkdirp.sync(self.uploadfsSettings.uploadsPath);
      mkdirp.sync(self.uploadfsSettings.tempPath);

      self.uploadfs = uploadfs();
      self.uploadfs.init(self.uploadfsSettings, callback);
    };

    self.enableCollection = function(callback) {
      self.apos.db.collection('aposAttachments', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

    self.enableHelpers = function() {
      self.addHelpers(_.pick(self, 'url', 'first', 'all'));
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
