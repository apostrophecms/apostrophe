var _ = require('lodash');
var uploadfs = require('uploadfs');
var mkdirp = require('mkdirp');

module.exports = {

  alias: 'attachments',

  afterConstruct: function(self, callback) {
    self.initUploadfs(function() {
      self.setupCache();
      self.addFieldType();
      self.pushAssets();
      self.pushCreateSingleton();
      return callback();
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

    self.imageSizes = options.imageSizes || [
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

    mkdirp.sync(uploadfsSettings.uploadsPath);
    mkdirp.sync(uploadfsSettings.tempPath);

    self.uploadfs = uploadfs();

    self.initUploadfs = function(callback) {
      self.uploadfs.init(uploadfsSettings, callback);
    };

    self.setupCache = function() {
      self.cache = self.apos.caches.get(self.__meta.name);
    };

    require('./lib/schemaField')(self, options);
    require('./lib/api')(self, options);
    require('./lib/routes')(self, options);
    require('./lib/browser')(self, options);

  }
};
