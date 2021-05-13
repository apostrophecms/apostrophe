const _ = require('lodash');
const uploadfs = require('uploadfs');
const mkdirp = require('mkdirp');
const Promise = require('bluebird');

module.exports = {
  async init(self) {
    self.uploadfs = await self.getInstance(self.options.uploadfs || {});
    // Like @apostrophecms/express or @apostrophecms/db, this module has no alias and instead
    // points to the service it provides because that is more useful
    self.apos.uploadfs = self.uploadfs;
  },

  methods(self) {
    return {
      // Initializes and returns a new instance of uploadfs, applying the appropriate defaults
      // and environment variables where not overridden by the given options object
      async getInstance(options = {}) {
        const uploadfsDefaultSettings = {
          backend: 'local',
          uploadsPath: self.apos.rootDir + '/public/uploads',
          uploadsUrl: (self.apos.baseUrl || '') + self.apos.prefix + '/uploads',
          tempPath: self.apos.rootDir + '/data/temp/uploadfs'
        };
        const uploadfsSettings = {};
        _.merge(uploadfsSettings, uploadfsDefaultSettings);
        _.merge(uploadfsSettings, options);
        if (process.env.APOS_S3_BUCKET) {
          _.merge(uploadfsSettings, {
            backend: 's3',
            endpoint: process.env.APOS_S3_ENDPOINT,
            secret: process.env.APOS_S3_SECRET,
            key: process.env.APOS_S3_KEY,
            bucket: process.env.APOS_S3_BUCKET,
            region: process.env.APOS_S3_REGION
          });
        }
        safeMkdirp(uploadfsSettings.uploadsPath);
        safeMkdirp(uploadfsSettings.tempPath);
        const instance = uploadfs();
        await Promise.promisify(instance.init)(uploadfsSettings);
        return instance;
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
          if (self.apos.uploadfs) {
            await Promise.promisify(self.apos.uploadfs.destroy)();
          }
        }
      }
    };
  }
};
