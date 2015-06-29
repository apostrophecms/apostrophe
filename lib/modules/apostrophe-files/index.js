var _ = require('lodash');
var uploadfs = require('uploadfs');
var async = require('async');
var mkdirp = require('mkdirp');

module.exports = {

  alias: 'files',

  afterConstruct: function(self, callback) {
    self.pushAssets();
    self.pushCreateSingleton();

    return async.series([self.initUploadfs, self.initDb], callback);
  },

  construct: function(self, options) {
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

    self.trashImageSize = options.trashImageSize || [ 'one-sixth' ];

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

    mkdirp.sync(uploadfsSettings.uploadsPath);
    mkdirp.sync(uploadfsSettings.tempPath);

    self.uploadfs = uploadfs();

    self.perPage = options.perPage || 20;

    self.options.addFields = [
      {
        type: 'string',
        name: 'title',
        label: 'Title'
      },
      {
        type: 'tags',
        name: 'tags',
        label: 'Tags'
      },
      {
        type: 'boolean',
        name: 'private',
        label: 'Private'
      },
      {
        type: 'string',
        name: 'description',
        textarea: true,
        label: 'Description'
      }
    ].concat(self.options.addFields || []);

    self.schema = self.apos.schemas.compose(self.options);

    // TODO figure this out
    // self.pushGlobalData({
    //   files: self.options.files || {}
    // });

    require('./lib/api')(self, options);
    require('./lib/findApi')(self, options);
    require('./lib/routes')(self, options);
    require('./lib/browser')(self, options);

    // Add the find files API to nunjucks
    self.addHelpers({
      find: self.find,
      url: self.url
    });

    self.initUploadfs = function(callback) {
      self.uploadfs.init(uploadfsSettings, callback);
    };

    self.initDb = function(callback) {
      self.apos.db.collection('aposFiles', function(err, collection) {
        self.files = collection;
        return callback(err);
      });
    };

  }
}
