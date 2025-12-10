/* jshint node:true */

// Google Cloud Storage backend for uploadfs. See also
// local.js.

const storage = require('@google-cloud/storage');
const extname = require('path').extname;
const _ = require('lodash');
const utils = require('../utils');
const path = require('path');

module.exports = function() {
  let contentTypes;
  let client;
  let cachingTime;
  let https;
  let bucketName;
  let endpoint = 'storage.googleapis.com';
  let defaultTypes;
  let noProtoEndpoint;
  let validation = false;

  const self = {
    init: function (options, callback) {
      if (!(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        return callback('GOOGLE_APPLICATION_CREDENTIALS not set in env, cannot proceed');
      }
      if (options.validation) {
        validation = options.validation;
      }
      // Ultimately the result will look like https://storage.googleapis.com/[BUCKET_NAME]/[OBJECT_NAME]
      // The rest is based mostly on s3 knox surmises.
      if (options.endpoint) {
        endpoint = options.endpoint;
        if (!endpoint.match(/^https?:/)) {
          const defaultSecure = ((!options.port) || (options.port === 443));
          const secure = options.secure || defaultSecure;
          let port = options.port || 443;
          const protocol = secure ? 'https://' : 'http://';
          if (secure && (port === 443)) {
            port = '';
          } else if ((!secure) && (port === 80)) {
            port = '';
          } else {
            port = ':' + port;
          }
          endpoint = protocol + endpoint + port;
        }
      }
      // The storage client auth relies on the presence of the service account
      // file path expressed in the environment variable
      // GOOGLE_APPLICATION_CREDENTIALS and, of course, the presence of such file.
      //
      //
      // See https://cloud.google.com/docs/authentication/getting-started
      client = new storage.Storage();
      bucketName = options.bucket;
      defaultTypes = require(path.join(__dirname, '/contentTypes.js'));
      if (options.contentTypes) {
        _.extend(contentTypes, defaultTypes, options.contentTypes);
      } else {
        contentTypes = defaultTypes;
      }
      https = options.https;
      cachingTime = options.cachingTime;
      self.options = options;
      return callback(null);
    },

    copyIn: function(localPath, path, options, callback) {
      path = utils.removeLeadingSlash(self.options, path);
      let ext = extname(path);
      if (ext.length) {
        ext = ext.substr(1);
      }
      let contentType = contentTypes[ext];
      if (!contentType) {
        contentType = 'application/octet-stream';
      }

      let cacheControl = 'no-cache';
      if (cachingTime) {
        cacheControl = 'public, max-age=' + cachingTime;
      }
      const uploadOptions = {
        destination: path,
        gzip: true,
        public: true,
        validation,
        metadata: {
          cacheControl,
          ContentType: contentType
        }
      };
      const bucket = client.bucket(bucketName);
      return bucket.upload(localPath, uploadOptions, callback);
    },

    copyOut: function(path, localPath, options, callback) {
      path = utils.removeLeadingSlash(self.options, path);
      const mergedOptions = _.assign({
        destination: localPath,
        validation
      }, options);
      client.bucket(bucketName).file(path).download(mergedOptions, callback);
    },

    remove: function(path, callback) {
      path = utils.removeLeadingSlash(self.options, path);
      client.bucket(bucketName).file(path).delete({}, callback);
    },

    enable: function(path, callback) {
      path = utils.removeLeadingSlash(self.options, path);
      client.bucket(bucketName).file(path).makePublic(callback);
    },

    disable: function(path, callback) {
      path = utils.removeLeadingSlash(self.options, path);
      client.bucket(bucketName).file(path).makePrivate({}, callback);
    },

    getUrl: function (path) {
      noProtoEndpoint = endpoint.replace(/^https?:\/\//i, '');
      const url = (https ? 'https://' : 'http://') + bucketName + '.' + noProtoEndpoint;
      return utils.addPathToUrl(self.options, url, path);
    },

    destroy: function(callback) {
      // No file descriptors or timeouts held
      return callback(null);
    }
  };
  return self;
};
