/* jshint node:true */

// Local filesystem-based backend for uploadfs. See also
// s3.js.

const dirname = require('path').dirname;
const fs = require('fs');
const copyFile = require('../copyFile.js');
const async = require('async');
const utils = require('../utils.js');
const disabledFileKey = require('./disabledFileKey.js');

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
      timeout = setTimeout(cleanup, 1000);
      return callback(null);

      function cleanup() {
        timeout = null;
        const list = removeCandidates;
        list.sort(function(a, b) {
          if (a.length > b.length) {
            return -1;
          } else if (a.length < b.length) {
            return 1;
          } else {
            return 0;
          }
        });
        removeCandidates = [];
        return async.eachSeries(list, function(path, callback) {
          const uploadPath = uploadsPath + path;
          fs.rmdir(uploadPath, function(e) {
            if (!e) {
              add(dirname(path));
            }
            return callback(null);
          });
        }, function() {
          if (!self.destroyed) {
            timeout = setTimeout(cleanup, 1000);
          }
        });

        function add(path) {
          if (path.length > 1) {
            removeCandidates.push(path);
          }
        }
      }
    },

    destroy: function(callback) {
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

    rename: function(from, to, callback) {
      return fs.rename(uploadsPath + from, uploadsPath + to, callback);
    },

    enable: function(path, callback) {
      if (self.options.disabledFileKey) {
        return disabledFileKey.enable(self, path, callback);
      } else {
        return fs.chmod(uploadsPath + path, self.getEnablePermissions(), callback);
      }
    },

    getEnablePermissions: function() {
      return self.options.enablePermissions || parseInt('644', 8);
    },

    disable: function(path, callback) {
      if (self.options.disabledFileKey) {
        return disabledFileKey.disable(self, path, callback);
      } else {
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
            return fs.rename(
              uploadsPath + file,
              removeDisabledSuffix(uploadsPath + file),
              callback
            );
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

    _testCopyFile: function(path1, path2, options, callback) {
      return copyFile(path1, path2, options, callback);
    }
  };

  return self;
};
