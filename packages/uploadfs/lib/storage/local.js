/* jshint node:true */

// Local filesystem-based backend for uploadfs. See also
// s3.js. The main difference between this backend and just using
// the local filesystem directly is that it creates parent
// folders automatically when they are discovered to be missing,
// and it encourages you to write code that will still work
// when you switch to the s3 backend

const dirname = require('path').dirname;
const fs = require('fs');
const copyFile = require('../copyFile.js');
const async = require('async');
const utils = require('../utils.js');

module.exports = function() {
  let uploadsPath;
  let uploadsUrl;
  let removeCandidates = [];
  let timeout;

  const self = {
    init: function(options, callback) {
      self.options = options;
      uploadsPath = options.uploadsPath;
      if (!uploadsPath) {
        return callback('uploadsPath not set');
      }
      uploadsUrl = options.uploadsUrl;
      if (!uploadsUrl) {
        return callback('uploadsUrl not set');
      }
      // We use a timeout that we reinstall each time rather than
      // an interval to avoid pileups
      timeout = setTimeout(cleanup, 1000);
      return callback(null);

      function cleanup() {
        timeout = null;
        const list = removeCandidates;
        // Longest paths first, so we don't try to remove parents before children
        // and wind up never getting rid of the parent
        list.sort(function(a, b) {
          if (a.length > b.length) {
            return -1;
          } else if (a.length < b.length) {
            return 1;
          } else {
            return 0;
          }
        });
        // Building new list for next pass
        removeCandidates = [];
        // Parallelism here just removes things too soon preventing a parent from being removed
        // after a child
        return async.eachSeries(list, function(path, callback) {
          const uploadPath = uploadsPath + path;
          fs.rmdir(uploadPath, function(e) {
            // We're not fussy about the outcome, if it still has files in it we're
            // actually depending on this to fail
            if (!e) {
              // It worked, so try to remove the parent (which will fail if not empty, etc.)
              add(dirname(path));
            }
            return callback(null);
          });
        }, function() {
          // Try again in 1 second, typically removing another layer of parents if empty, etc.
          if (!self.destroyed) {
            timeout = setTimeout(cleanup, 1000);
          }
        });

        function add(path) {
          // Don't remove uploadfs itself
          if (path.length > 1) {
            removeCandidates.push(path);
          }
        }
      }
    },

    destroy: function(callback) {
      // node cannot exit if we still hold a timeout
      if (timeout) {
        clearTimeout(timeout);
      }
      self.destroyed = true;
      return callback(null);
    },

    copyIn: function(localPath, path, options, callback) {
      const uploadPath = uploadsPath + path;
      return copyFile(localPath, uploadPath, callback);
    },

    copyOut: function(path, localPath, options, callback) {
      const downloadPath = uploadsPath + path;
      return copyFile(downloadPath, localPath, callback);
    },

    streamOut: function(path, options) {
      return fs.createReadStream(uploadsPath + path);
    },

    remove: function(path, callback) {
      const uploadPath = uploadsPath + path;
      fs.unlink(uploadPath, callback);
      if (dirname(path).length > 1) {
        removeCandidates.push(dirname(path));
      }
    },

    enable: function(path, callback) {
      if (self.options.disabledFileKey) {
        return fs.rename(uploadsPath + utils.getDisabledPath(path, self.options.disabledFileKey), uploadsPath + path, callback);
      } else {
        // World readable, owner writable. Reasonable since
        // web accessible files are world readable in that
        // sense regardless
        return fs.chmod(uploadsPath + path, self.getEnablePermissions(), callback);
      }
    },

    getEnablePermissions: function() {
      return self.options.enablePermissions || parseInt('644', 8);
    },

    disable: function(path, callback) {
      if (self.options.disabledFileKey) {
        return fs.rename(uploadsPath + path, uploadsPath + utils.getDisabledPath(path, self.options.disabledFileKey), callback);
      } else {
        // No access. Note this means you must explicitly
        // enable to get read access back, even with copyFileOut
        return fs.chmod(uploadsPath + path, self.getDisablePermissions(), callback);
      }
    },

    getDisablePermissions: function() {
      return self.options.disablePermissions || parseInt('0000', 8);
    },

    getUrl: function(path) {
      return utils.addPathToUrl(self.options, uploadsUrl, path);
    },

    migrateToDisabledFileKey: function(callback) {
      if (!self.options.disabledFileKey) {
        return callback(new Error('migrateToDisabledFileKey invoked with no disabledFileKey option set.'));
      }
      const candidates = [];
      try {
        spelunk('');
      } catch (e) {
        return callback(e);
      }
      return async.eachLimit(candidates, 5, function(file, callback) {
        fs.chmodSync(uploadsPath + file, self.options.enablePermissions || parseInt('644', 8));
        self.disable(file, callback);
      }, callback);
      function spelunk(folder) {
        const files = fs.readdirSync(uploadsPath + folder);
        files.forEach(function(file) {
          const stats = fs.statSync(uploadsPath + folder + '/' + file);
          const mode = stats.mode & parseInt('0777', 8);
          if (stats.isDirectory()) {
            return spelunk(folder + '/' + file);
          }
          if (mode === self.getDisablePermissions()) {
            candidates.push(folder + '/' + file);
          }
        });
      }
    },

    migrateFromDisabledFileKey: function(callback) {
      if (self.options.disabledFileKey) {
        return callback('migrateFromDisabledFileKey invoked with disabledFileKey option still set.');
      }
      const candidates = [];
      try {
        spelunk('');
      } catch (e) {
        return callback(e);
      }
      return async.eachLimit(candidates, 5, function(file, callback) {
        return async.series([
          function(callback) {
            return fs.rename(uploadsPath + file, removeDisabledSuffix(uploadsPath + file), callback);
          },
          function(callback) {
            return self.disable(removeDisabledSuffix(file), callback);
          }
        ], callback);
        function removeDisabledSuffix(path) {
          return path.replace(/-disabled-[0-9a-f]+$/, '');
        }
      }, callback);
      function spelunk(folder) {
        const files = fs.readdirSync(uploadsPath + folder);
        files.forEach(function(file) {
          const stats = fs.statSync(uploadsPath + folder + '/' + file);
          if (stats.isDirectory()) {
            return spelunk(folder + '/' + file);
          }
          if (file.match(/-disabled-[0-9a-f]+$/)) {
            candidates.push(folder + '/' + file);
          }
        });
      }
    },

    // Exported for unit testing only
    _testCopyFile: function(path1, path2, options, callback) {
      return copyFile(path1, path2, options, callback);
    }
  };

  return self;
};
