var _ = require('lodash');
var uploadfs = require('uploadfs');
var async = require('async');

module.exports = {
  construct: function(self, options, callback) {
    self.defaultImageSizes = options.defaultImageSizes || [
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
    self.trashImageSizes = options.trashImageSizes || [ 'one-sixth' ];
    
    // Default file type groupings
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
        extensions: [ 'txt', 'rtf', 'pdf', 'xls', 'ppt', 'doc', 'pptx', 'sldx', 'ppsx', 'potx', 'xlsx', 'xltx', 'docx', 'dotx' ],
        extensionMaps: {},
        // uploadfs should just accept this file as-is
        image: false
      },
    ];

    var uploadfsDefaultSettings = {
      backend: 'local',
      uploadsPath: self.apos.rootDir + '/public/uploads',
      uploadsUrl: self.apos.prefix + '/uploads',
      tempPath: self.apos.rootDir + '/data/temp/uploadfs',
      // Register Apostrophe's standard image sizes. Notice you could
      // concatenate your own list of sizes if you had a need to
      imageSizes: self.imageSizes
    };
    uploadfsSettings = {};
    _.merge(uploadfsSettings, uploadfsDefaultSettings);
    _.merge(uploadfsSettings, options.uploadfs || {});

    self.uploadfs = uploadfs();

    // TODO figure this out
    // self.pushGlobalData({
    //   files: self.options.files || {}
    // });

    require('./lib/api')(self, options);
    require('./lib/findApi')(self, options);
    require('./lib/routes')(self, options);

    // Add the find files API to nunjucks locals
    self.apos.templates.addToApos({
      files: {
        find: self.find
      }
    });

    self.apos.files = self;

    if (options.browseByType) {
      options.browseByType = _.filter(mediaOptions.browseByType, function(byType) {
        return byType.value = byType.extensions.join(',');
      });
    }
    self.pushAsset('template', { name: 'mediaLibrary', when: 'user', data: options });

    return async.series(
      {
        initUploadfs: function(callback) {
          self.uploadfs.init(uploadfsSettings, callback);
        },
        initDb: function(callback) {
          self.apos.db.collection('aposFiles', function(err, collection) {
            self.files = collection;
            return callback(err);
          });
        }
      }, 
      function(err) {
        return callback(err);
      }
    );
  }
}
