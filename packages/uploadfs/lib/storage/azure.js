const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const contentTypes = require('./contentTypes');
const extname = require('path').extname;
const fs = require('fs');
const zlib = require('zlib');
const async = require('async');
const utils = require('../utils.js');
const defaultGzipBlacklist = require('../../defaultGzipBlacklist');
const createLogger = require('../logger.js');
const verbose = false;
const _ = require('lodash');
const disabledFileKey = require('./disabledFileKey.js');

let logger = createLogger();

const DEFAULT_MAX_AGE_IN_SECONDS = 500;
const DEFAULT_MAX_CACHE = 2628000;

function copyBlob(blob, src, dst, callback) {
  const srcClient = blob.svc.getContainerClient(blob.container).getBlobClient(src);
  const dstClient = blob.svc.getContainerClient(blob.container).getBlobClient(dst);
  dstClient.beginCopyFromURL(srcClient.url)
    .then((response) => {
      if (response.errorCode) {
        return callback(response.errorCode);
      }
      return callback(null, response);
    })
    .catch(callback);
}

function __log(...args) {
  if (verbose) {
    logger.error(...args);
  }
}

function setContainerProperties(blobSvc, options, result, callback) {
  function propToString(prop) {
    if (Array.isArray(prop)) {
      return prop.join(',');
    }
    return prop;
  }
  blobSvc.getProperties()
    .then((response) => {
      if (response.errorCode) {
        return callback(response.errorCode);
      }
      const serviceProperties = response;
      const allowedOrigins = propToString(options.allowedOrigins) || '*';
      const allowedMethods = propToString(options.allowedMethods) || 'GET,PUT,POST';
      const allowedHeaders = propToString(options.allowedHeaders) || '*';
      const exposedHeaders = propToString(options.exposedHeaders) || '*';
      const maxAgeInSeconds = options.maxAgeInSeconds || DEFAULT_MAX_AGE_IN_SECONDS;

      serviceProperties.cors = [
        {
          allowedOrigins,
          allowedMethods,
          allowedHeaders,
          exposedHeaders,
          maxAgeInSeconds
        }
      ];

      blobSvc.setProperties(serviceProperties)
        .then((response) => {
          if (response.errorCode) {
            return callback(response.errorCode);
          }
          return callback(null, blobSvc);
        })
        .catch(callback);
    })
    .catch(callback);
}

function initializeContainer(blobSvc, container, options, callback) {
  blobSvc.getContainerClient(container)
    .setAccessPolicy('blob')
    .then((response) => {
      if (response.errorCode) {
        return callback(response.errorCode);
      }
      return setContainerProperties(blobSvc, options, response, callback);
    })
    .catch(callback);
}

function createContainer(cluster, options, callback) {
  let blobSvc;
  if (cluster.sas) {
    blobSvc = new BlobServiceClient(
      `https://${cluster.account}.blob.core.windows.net?${cluster.key}`
    );
  } else {
    const sharedKeyCredential = new StorageSharedKeyCredential(
      cluster.account,
      cluster.key
    );
    blobSvc = new BlobServiceClient(
      `https://${cluster.account}.blob.core.windows.net`,
      sharedKeyCredential
    );
  }
  const container = cluster.container || options.container;
  blobSvc.uploadfsInfo = {
    account: cluster.account,
    container: options.container || cluster.container
  };
  blobSvc.getContainerClient(container)
    .createIfNotExists()
    .then((response) => {
      if (response.errorCode && response.errorCode !== 'ContainerAlreadyExists') {
        return callback(response.errorCode);
      }
      return initializeContainer(blobSvc, container, options, callback);
    })
    .catch(callback);
}

function removeLocalBlob(path, callback) {
  fs.unlink(path, function(error) {
    return callback(error);
  });
}

function createContainerBlob(blob, path, localPath, _gzip, callback) {
  const extension = extname(path).substring(1);
  const contentSettings = {
    cacheControl: `max-age=${DEFAULT_MAX_CACHE}, public`,
    contentType: contentTypes[extension] || 'application/octet-stream'
  };
  if (_gzip) {
    contentSettings.contentEncoding = 'gzip';
  }
  blob.svc.getContainerClient(blob.container)
    .getBlobClient(path)
    .getBlockBlobClient()
    .uploadFile(localPath, {
      blobHTTPHeaders: {
        blobCacheControl: contentSettings.cacheControl,
        blobContentType: contentSettings.contentType,
        blobContentEncoding: contentSettings.contentEncoding
      }
    })
    .then((response) => {
      if (response.errorCode) {
        return callback(response.errorCode);
      }
      return callback(null);
    })
    .catch(callback);
}

function removeContainerBlob(blob, path, callback) {
  blob.svc.getContainerClient(blob.container)
    .getBlobClient(path)
    .deleteIfExists()
    .then((response) => {
      if (response.errorCode && response.errorCode !== 'BlobNotFound') {
        __log('Cannot delete ' + path + 'on container ' + blob.container + ': ' + response.errorCode);
        return callback(response.errorCode);
      }
      return callback(null);
    })
    .catch(callback);
}

function clusterError(cluster, err) {
  cluster = (cluster.svc && cluster.svc.uploadfsInfo) || cluster;
  if (!err) {
    return err;
  }
  if (cluster === 'all') {
    err.account = 'ALL';
    err.container = 'ALL';
  } else {
    err.account = cluster.account;
    err.container = cluster.container;
  }
  return err;
}

module.exports = function() {

  const self = {
    blobSvcs: [],
    init: function(options, callback) {
      if (!options.disabledFileKey) {
        return callback(new Error('You must set the disabledFileKey option to a random string when using the azure storage backend.'));
      }
      this.options = options;
      logger = createLogger(options.logger);
      self.gzipBlacklist = self.getGzipBlacklist(options.gzipEncoding || {});

      if (!options.replicateClusters ||
        (!Array.isArray(options.replicateClusters)) || (!options.replicateClusters[0])
      ) {
        options.replicateClusters = [];
        options.replicateClusters.push({
          account: options.account,
          key: options.key,
          container: options.container
        });
      }
      async.each(options.replicateClusters, function(cluster, callback) {
        createContainer(cluster, options, function(err, svc) {
          if (err) {
            return callback(clusterError(cluster, err));
          }

          self.blobSvcs.push({
            svc,
            container: cluster.container || options.container
          });

          return callback();
        });
      }, callback);
    },

    cleanupStreams: function (
      inputStream, outputStream, tempPath, tempPath2, err, callback
    ) {
      async.parallel({
        unlink: function(callback) {
          if (!tempPath) {
            return callback(null);
          }
          removeLocalBlob(tempPath, callback);
        },

        unlink2: function(callback) {
          if (!tempPath2) {
            return callback(null);
          }
          removeLocalBlob(tempPath2, callback);
        },

        closeReadStream: function(callback) {
          inputStream.destroy();
          callback();
        },

        closeWriteStream: function(callback) {
          outputStream.destroy();
          callback();
        }
      }, cleanupError => {
        if (err) {
          return callback(err);
        }
        return callback(cleanupError);
      });
    },

    copyIn: function(localPath, _path, options, callback) {
      if (!self.blobSvcs.length) {
        return callback(new Error('At least one valid container must be included in the replicateCluster configuration.'));
      }
      const fileExt = extname(_path).substring(1);
      const path = _path[0] === '/' ? _path.slice(1) : _path;
      const tmpFileName = Math.random().toString(36).substring(7);
      let tempPath = this.options.tempPath + '/' + tmpFileName;
      if (!callback) {
        callback = options;
      }

      if (self.shouldGzip(fileExt)) {
        return self.doGzip(localPath, path, tempPath, callback);
      } else {
        tempPath = localPath;
        return self.createContainerBlobs(localPath, path, tempPath, false, callback);
      }
    },

    createContainerBlobs: function(localPath, path, tempPath, _gzip, callback) {
      async.each(self.blobSvcs, function(blobSvc, callback) {
        createContainerBlob(blobSvc, path, tempPath, _gzip, function(createBlobErr) {
          return callback(clusterError(blobSvc, createBlobErr));
        });
      }, function(err) {
        return callback(err);
      });
    },

    doGzip: function(localPath, path, tempPath, callback) {
      const inp = fs.createReadStream(localPath);
      const out = fs.createWriteStream(tempPath);
      let hasError = false;

      inp.on('error', function(inpErr) {
        __log('Error in read stream', inpErr);
        if (!hasError) {
          hasError = true;
          return self.cleanupStreams(inp, out, tempPath, null, inpErr, callback);
        }
      });

      out.on('error', function(outErr) {
        if (!hasError) {
          hasError = true;
          return self.cleanupStreams(inp, out, tempPath, null, outErr, callback);
        }
      });

      out.on('finish', function() {
        self.createContainerBlobs(localPath, path, tempPath, true, callback);
      });
      const gzip = zlib.createGzip();
      inp.pipe(gzip).pipe(out);
    },

    shouldGzip: function(ext) {
      return !self.gzipBlacklist.includes(ext);
    },

    copyOut: function(path, localPath, options, callback) {
      if (!self.blobSvcs.length) {
        return callback(new Error('At least one valid container must be included in the replicateCluster configuration.'));
      }
      let index = 0;
      return attempt();

      function attempt(lastErr) {
        if (index >= self.blobSvcs.length) {
          return callback(clusterError('all', lastErr));
        }
        const blob = self.blobSvcs[index++];
        path = path[0] === '/' ? path.slice(1) : path;
        const initialPath = localPath + '.initial';

        return blob.svc.getContainerClient(blob.container)
          .getBlobClient(path)
          .downloadToFile(initialPath)
          .then((response) => {
            if (response.errorCode) {
              return attempt(response.errorCode);
            }
            const returnVal = {
              result: response,
              response
            };
            if (response.contentEncoding === 'gzip') {
              return gunzipBlob();
            } else {
              fs.renameSync(initialPath, localPath);
              return callback(null, response);
            }

            function gunzipBlob() {
              const out = fs.createWriteStream(localPath);
              const inp = fs.createReadStream(initialPath);
              const gunzip = zlib.createGunzip();
              let errorSeen = false;
              inp.pipe(gunzip);
              gunzip.pipe(out);
              inp.on('error', function(e) {
                fail(e);
              });
              gunzip.on('error', function(e) {
                fail(e);
              });
              out.on('error', function(e) {
                fail(e);
              });
              out.on('finish', function() {
                fs.unlinkSync(initialPath);
                return callback(null, returnVal);
              });
              function fail(e) {
                if (errorSeen) {
                  return;
                }
                errorSeen = true;
                return self.cleanupStreams(inp, out, initialPath, localPath, e, callback);
              }
            }
          })
          .catch(attempt);
      }
    },

    remove: function(path, callback) {
      if (!self.blobSvcs.length) {
        return callback(new Error('At least one valid container must be included in the replicateCluster configuration.'));
      }
      path = path[0] === '/' ? path.slice(1) : path;

      async.each(self.blobSvcs, function(blobSvc, callback) {
        removeContainerBlob(blobSvc, path, callback);
      }, callback);
    },

    rename: function(from, to, callback) {
      if (!self.blobSvcs.length) {
        return callback(new Error('At least one valid container must be included in the replicateCluster configuration.'));
      }
      async.each(self.blobSvcs, function(blob, callback) {
        copyBlob(blob, from, to, function(e) {
          if (e) {
            return callback(clusterError(blob, e));
          } else {
            self.remove(from, callback);
          }
        });
      }, function(err) {
        callback(err);
      });
    },

    disable: function(path, callback) {
      return disabledFileKey.disable(self, path, callback);
    },

    enable: function(path, callback) {
      return disabledFileKey.enable(self, path, callback);
    },

    getUrl: function (path) {
      const blob = self.blobSvcs[0];
      const baseUrl = blob.svc.getContainerClient(blob.container)
        .getBlobClient('')
        .url
        .replace(/\/$/, '');
      return utils.addPathToUrl(self.options, baseUrl, path);
    },

    destroy: function(callback) {
      return callback(null);
    },

    getGzipBlacklist: function(gzipEncoding) {
      const gzipSettings = gzipEncoding || {};
      const { whitelist, blacklist } = Object.keys(gzipSettings).reduce((prev, key) => {
        if (gzipSettings[key]) {
          prev.whitelist.push(key);
        } else {
          prev.blacklist.push(key);
        }
        return prev;
      }, {
        whitelist: [],
        blacklist: []
      });

      const gzipBlacklist = defaultGzipBlacklist
        .concat(blacklist)
        .filter(el => whitelist.indexOf(el));

      return _.uniq(gzipBlacklist);
    }
  };

  return self;
};
