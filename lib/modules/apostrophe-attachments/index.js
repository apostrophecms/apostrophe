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

    self.uploadfsSettings = {};
    _.merge(self.uploadfsSettings, uploadfsDefaultSettings);
    _.merge(self.uploadfsSettings, options.uploadfs || {});

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
      self.addHelpers({
        url: self.url
      });
    }

    require('./lib/schemaField')(self, options);
    require('./lib/api')(self, options);
    require('./lib/routes')(self, options);
    require('./lib/browser')(self, options);

  }
};
