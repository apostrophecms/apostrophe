const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const contentTypes = require('./contentTypes');
const extname = require('path').extname;
const fs = require('fs');
const zlib = require('zlib');
const async = require('async');
const utils = require('../utils.js');
const defaultGzipBlacklist = require('../../defaultGzipBlacklist');
const verbose = false;
const _ = require('lodash');

const DEFAULT_MAX_AGE_IN_SECONDS = 500;
const DEFAULT_MAX_CACHE = 2628000;

/**
 * @typedef {{ svc: BlobServiceClient, container: string }} BlobSvc
 *
 * @param {BlobSvc} blob
 * @param {string} src
 * @param {string} dst
 * @param {Function} callback
 */
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

function __log() {
  if (verbose) {
    console.error(arguments);
  }
}

/**
 * Set the main properties of the selected container.
 * @param {BlobSvc['svc']} blobSvc Azure service object
 * @param {Object} options Options passed to UploadFS library
 * @param {Object} result Service Properties
 * @param {Function} callback Callback to be called when operation is terminated
 * @return {any} Return the service which has been initialized
 */
function setContainerProperties(blobSvc, options, result, callback) {
  // Backward compatibility
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

/**
 * Initialize the container ACLs
 * @param {BlobSvc['svc']} blobSvc Azure Service object
 * @param {String} container Container name
 * @param {Object} options Options passed to UploadFS library
 * @param {Function} callback Callback to be called when operation is terminated
 * @return {any} Returns the result of `setContainerProperties`
 */
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

/**
 * Create an Azure Container
 * @param {Object} cluster Azure Cluster Info
 * @param {Object} options Options passed to UploadFS library
 * @param {Function} callback Callback to be called when operation is terminated
 * @return {any} Returns the initialized service
 */
function createContainer(cluster, options, callback) {
  let blobSvc;
  if (cluster.sas) {
    // https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/storage/storage-blob#with-sas-token
    blobSvc = new BlobServiceClient(
      `https://${cluster.account}.blob.core.windows.net?${cluster.key}`
    );
  } else {
    // https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/storage/storage-blob#with-storagesharedkeycredential
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

/**
 * Deletes a local file from its path
 * @param {String} path File path
 * @param {Function} callback Callback to be called when operation is terminated
 * @return Always null
 */
function removeLocalBlob(path, callback) {
  fs.unlink(path, function(error) {
    return callback(error);
  });
}

/**
 * Send a binary file to a specified container and a specified service
 * @param {BlobSvc} blob Azure Service info and container
 * @param {String} path Remote path
 * @param {String} localPath Local file path
 * @param {Function} callback Callback to be called when operation is terminated
 * @return {any} Result of the callback
 */
function createContainerBlob(blob, path, localPath, _gzip, callback) {
  // Draw the extension from uploadfs, where we know they will be using
  // reasonable extensions, not from what could be a temporary file
  // that came from the gzip code. -Tom
  const extension = extname(path).substring(1);
  const contentSettings = {
    cacheControl: `max-age=${DEFAULT_MAX_CACHE}, public`,
    // contentEncoding: _gzip ? 'gzip' : 'deflate',
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

/**
 * Remove remote container binary file
 * @param {BlobSvc} blob Azure Service info and container
 * @param {String} path Remote file path
 * @param {Function} callback Callback to be called when operation is terminated
 * @return {any} Result of the callback
 */
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

// If err is truthy, annotate it with the account and container name
// for the cluster or blobSvc passed, so that error messages can be
// used to effectively debug the right cluster in a replication scenario.
// 'all' can also be passed to indicate all replicas were tried.

function clusterError(cluster, err) {
  // Accept a blobSvc (which acts for a cluster) or a cluster config object,
  // for convenience
  cluster = (cluster.svc && cluster.svc.uploadfsInfo) || cluster;
  if (!err) {
    // Pass through if there is no error, makes this easier to use succinctly
    return err;
  }
  // Allow clusters to be distinguished in error messages. Also report
  // the case where everything was tried (copyOut)
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

    // Implementation detail. Used when stream-based copies fail.
    //
    // Cleans up the streams and temporary files (which can be null),
    // then delivers err to the callback unless something goes wrong in the cleanup itself
    // in which case that error is delivered.

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
      const fileExt = localPath.split('.').pop();
      const path = _path[0] === '/' ? _path.slice(1) : _path;
      const tmpFileName = Math.random().toString(36).substring(7);
      let tempPath = this.options.tempPath + '/' + tmpFileName;
      // options optional
      if (!callback) {
        callback = options;
      }

      if (self.shouldGzip(fileExt)) {
        return self.doGzip(localPath, path, tempPath, callback);
      } else {
        tempPath = localPath; // we don't have a temp path for non-gzipped files
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

    // Tries all replicas before giving up
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
        /** @type {BlobSvc} */
        const blob = self.blobSvcs[index++];
        path = path[0] === '/' ? path.slice(1) : path;
        // Temporary name until we know if it is gzipped.
        const initialPath = localPath + '.initial';

        return blob.svc.getContainerClient(blob.container)
          .getBlobClient(path)
          .downloadToFile(initialPath)
          .then((response) => {
            if (response.errorCode) {
              return attempt(response.errorCode);
            }
            // BC
            const returnVal = {
              result: response,
              response
            };
            if (response.contentEncoding === 'gzip') {
              // Now we know we need to unzip it.
              return gunzipBlob();
            } else {
              // Simple rename, because it was not gzipped after all.
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

    disable: function(path, callback) {
      if (!self.blobSvcs.length) {
        return callback(new Error('At least one valid container must be included in the replicateCluster configuration.'));
      }
      const dPath = utils.getDisabledPath(path, self.options.disabledFileKey);
      async.each(self.blobSvcs, function(blob, callback) {
        copyBlob(blob, path, dPath, function(e) {
          // if copy fails, abort
          if (e) {
            return callback(clusterError(blob, e));
          } else {
            // otherwise, remove original file (azure does not currently
            // support rename operations, so we dance)
            self.remove(path, callback);
          }
        });
      }, function(err) {
        callback(err);
      });
    },

    enable: function(path, callback) {
      if (!self.blobSvcs.length) {
        return callback(new Error('At least one valid container must be included in the replicateCluster configuration.'));
      }
      const dPath = utils.getDisabledPath(path, self.options.disabledFileKey);
      async.each(self.blobSvcs, function(blob, callback) {
        copyBlob(blob, dPath, path, function(e) {
          if (e) {
            return callback(clusterError(blob, e));
          } else {
            self.remove(dPath, callback);
          }
        });
      }, function(err) {
        callback(err);
      });
    },

    getUrl: function (path) {
      /** @type {BlobSvc} */
      const blob = self.blobSvcs[0];
      const baseUrl = blob.svc.getContainerClient(blob.container)
        .getBlobClient('')
        .url
        .replace(/\/$/, '');
      return utils.addPathToUrl(self.options, baseUrl, path);
    },

    destroy: function(callback) {
      // No file descriptors or timeouts held
      return callback(null);
    },

    /**
     * Use sane defaults and user config to get array of file extensions to avoid gzipping
     * @param gzipEncoding {Object} ex: {jpg: true, rando: false}
     * @retyrb {Array} An array of file extensions to ignore
     */
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

      // @NOTE - we REMOVE whitelisted types from the blacklist array
      const gzipBlacklist = defaultGzipBlacklist
        .concat(blacklist)
        .filter(el => whitelist.indexOf(el));

      return _.uniq(gzipBlacklist);
    }
  };

  return self;
};
