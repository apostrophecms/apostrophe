const _ = require('lodash');
const uploadfs = require('uploadfs');
const mkdirp = require('mkdirp');
const Promise = require('bluebird');

module.exports = {
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

    _.merge(self.uploadfsSettings, self.options.uploadfs || {});

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
    await self.initUploadfs();
    // Like @apostrophecms/express or @apostrophecms/db, this module has no alias and instead
    // points to the service it provides because that is more useful
    self.apos.uploadfs = self.uploadfs;
  },

  methods(self) {
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
            if (!require('fs').existsSync(path)) {
              throw e;
            }
          }
        }
      }
    };
  },

  handlers(self) {
    return {
      'apostrophe:destroy': {
        async destroyUploadfs() {
          await Promise.promisify(self.apos.uploadfs.destroy)();
        }
      }
    };
  }
};
