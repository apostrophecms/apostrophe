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

    self.enableCollection = function(callback) {
      self.apos.db.collection('aposAttachments', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

    require('./lib/schemaField')(self, options);
    require('./lib/api')(self, options);
    require('./lib/routes')(self, options);
    require('./lib/browser')(self, options);

  }
};
