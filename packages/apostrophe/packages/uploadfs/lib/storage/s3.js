/* jshint node:true */

// Amazon s3-based backend for uploadfs. See also
// local.js.

const fs = require('fs');
const {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectAclCommand
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const { extname } = require('path');
const { PassThrough } = require('stream');
const utils = require('../utils');

module.exports = function() {
  let contentTypes;
  let client;
  let cachingTime;
  let https;
  let bucket;
  let bucketObjectsACL;
  let disabledBucketObjectsACL;
  let endpoint;
  let defaultTypes;
  let noProtoEndpoint;
  let pathStyle = false;
  let noGzipContentTypes;
  let addNoGzipContentTypes;
  const self = {
    init: function (options, callback) {
      // knox bc
      endpoint = 's3.amazonaws.com';

      const clientConfig = {
        region: options.region
      };

      if (options.secret) {
        clientConfig.credentials = {
          accessKeyId: options.key,
          secretAccessKey: options.secret,
          ...(options.token && { sessionToken: options.token })
        };
      }

      bucket = options.bucket;
      bucketObjectsACL = options.bucketObjectsACL || 'public-read';
      disabledBucketObjectsACL = options.disabledBucketObjectsACL || 'private';
      noGzipContentTypes = options.noGzipContentTypes || require('./noGzipContentTypes');
      addNoGzipContentTypes = options.addNoGzipContentTypes || [];
      // bc for the `endpoint`, `secure` and `port` options
      if (options.endpoint) {
        endpoint = options.endpoint;
        if (!endpoint.match(/^https?:/)) {
          // Infer it like knox would
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
        clientConfig.endpoint = endpoint;
      }

      // this is to support the knox style attribute OR AWS forcePathStyle attribute
      if (options.style && (options.style === 'path')) {
        pathStyle = true;
        clientConfig.forcePathStyle = true;
      }

      if (options.agent) {
        clientConfig.requestHandler = new NodeHttpHandler({
          httpAgent: options.agent,
          httpsAgent: options.agent
        });
      }
      client = new S3Client(clientConfig);
      defaultTypes = require('./contentTypes.js');
      if (options.contentTypes) {
        contentTypes = {
          ...defaultTypes,
          ...options.contentTypes
        };
      } else {
        contentTypes = defaultTypes;
      }

      https = (options.https === undefined) ? true : options.https;
      cachingTime = options.cachingTime;
      self.options = options;
      return callback(null);
    },

    copyIn: function(localPath, path, options, callback) {
      let ext = extname(path);
      if (ext.length) {
        ext = ext.substr(1);
      }
      let contentType = contentTypes[ext];
      if (!contentType) {
        contentType = 'application/octet-stream';
      }

      const inputStream = fs.createReadStream(localPath);

      const params = {
        Bucket: bucket,
        ACL: bucketObjectsACL,
        Key: utils.removeLeadingSlash(self.options, path),
        Body: inputStream,
        ContentType: contentType
      };

      if (gzipAppropriate(contentType)) {
        params.ContentEncoding = 'gzip';
        const gzip = require('zlib').createGzip();
        inputStream.pipe(gzip);
        params.Body = gzip;
      }

      if (cachingTime) {
        params.CacheControl = 'public, max-age=' + cachingTime;
      }

      // Use @aws-sdk/lib-storage for multipart uploads
      const upload = new Upload({
        client,
        params
      });

      upload.done()
        .then(result => callback(null, result))
        .catch(err => callback(err));

      function gzipAppropriate(contentType) {
        return ![ ...noGzipContentTypes, ...addNoGzipContentTypes ].includes(contentType);
      }
    },

    streamOut: function(path, options) {
      const result = new PassThrough();
      const params = {
        Bucket: bucket,
        Key: utils.removeLeadingSlash(self.options, path)
      };

      const command = new GetObjectCommand(params);

      client.send(command)
        .then(response => {
          let inputStream = response.Body;

          // Errors do not automatically propagate with pipe()
          inputStream.on('error', e => {
            result.emit('error', e);
          });

          if (response.ContentEncoding === 'gzip') {
            const gunzip = require('zlib').createGunzip();
            gunzip.on('error', e => {
              result.emit('error', e);
            });
            inputStream.pipe(gunzip);
            inputStream = gunzip;
          }

          inputStream.pipe(result);
        })
        .catch(err => {
          result.emit('error', {
            ...err,
            ...err.$response
          });
        });

      return result;
    },

    copyOut: function(path, localPath, options, callback) {
      let finished = false;
      const outputStream = fs.createWriteStream(localPath);
      const inputStream = self.streamOut(path, options);
      inputStream.pipe(outputStream);
      inputStream.on('error', function(err) {
        // Watch out for any oddities in stream implementation
        if (finished) {
          return;
        }
        finished = true;
        return callback(err);
      });
      outputStream.on('error', function(err) {
        // Watch out for any oddities in stream implementation
        if (finished) {
          return;
        }
        finished = true;
        return callback(err);
      });
      outputStream.on('finish', function() {
        // Watch out for any oddities in stream implementation
        if (finished) {
          return;
        }
        finished = true;
        return callback(null);
      });
    },

    remove: function(path, callback) {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: utils.removeLeadingSlash(self.options, path)
      });

      client.send(command)
        .then(result => callback(null, result))
        .catch(err => callback(err));
    },

    enable: function(path, callback) {
      const command = new PutObjectAclCommand({
        Bucket: bucket,
        ACL: bucketObjectsACL,
        Key: utils.removeLeadingSlash(self.options, path)
      });

      client.send(command)
        .then(result => callback(null, result))
        .catch(err => callback(err));
    },

    disable: function(path, callback) {
      const command = new PutObjectAclCommand({
        Bucket: bucket,
        ACL: disabledBucketObjectsACL,
        Key: utils.removeLeadingSlash(self.options, path)
      });

      client.send(command)
        .then(result => callback(null, result))
        .catch(err => callback(err));
    },

    getUrl: function (path) {
      let url;
      noProtoEndpoint = endpoint.replace(/^https?:\/\//i, '');
      if (pathStyle) {
        url = (https ? 'https://' : 'http://') + noProtoEndpoint + '/' + bucket;
      } else {
        url = (https ? 'https://' : 'http://') + bucket + '.' + noProtoEndpoint;
      }
      return utils.addPathToUrl(self.options, url, path);
    },

    destroy: function(callback) {
      // No file descriptors or timeouts held
      return callback(null);
    }
  };
  return self;
};
