const crypto = require('crypto');
const { PassThrough } = require('stream');
/**
 * Helper functions
 **/
module.exports = {
  // Use an unguessable filename suffix to disable files.
  // This is secure at the web level if the webserver is not
  // configured to serve indexes of files, and it does not impede the
  // use of rsync etc. Used when options.disabledFileKey is set.
  // Use of an HMAC to do this for each filename ensures that even if
  // one such filename is exposed, the others remain secure

  getDisabledPath: function(path, disabledFileKey) {
    const hmac = crypto.createHmac('sha256', disabledFileKey);
    hmac.update(path);
    const disabledPath = path + '-disabled-' + hmac.digest('hex');
    return disabledPath;
  },

  getPathFromDisabledPath: function(path) {
    return path.replace(/-disabled-.*/g, '');
  },

  // Append a path to a bucket's base URL, with a joining slash if not provided.
  // This is shared by several backends, while others have their own path
  // handling needs. We want to ensure that both `path/to/file` (which others
  // sometimes use) and `/path/to/file` (always used by Apostrophe) behave
  // reasonably.
  //
  // If `path` is nullish `url` is returned as-is.
  //
  // If `options.strictPaths` is `true`, we do not attempt to provide a slash
  // when needed

  addPathToUrl(options, url, path) {
    if (options.strictPaths) {
      if (path != null) {
        return url + path;
      } else {
        return url;
      }
    } else {
      if (path != null) {
        return url + ((path.charAt(0) !== '/') ? '/' : '') + path;
      } else {
        return url;
      }
    }
  },

  // Leading slashes were the norm with knox, but
  // produce unwanted extra slashes in the URL with
  // the AWS SDK for S3 and in GCS, so return the
  // string without them.
  //
  // If `options.strictPaths` is true, we do not
  // make this modification.

  removeLeadingSlash(options, key) {
    if (options.strictPaths) {
      return key;
    } else {
      return key.replace(/^\//, '');
    }
  },

  // Returns an error if `path` is not acceptable as an uploadfs path,
  // otherwise null. `..` segments are never legitimate: they could escape
  // the uploads folder of the local backend, and in cloud backends they can
  // be normalized away when the key becomes part of a request URL, reaching
  // other buckets or containers. Backslashes count as separators because they
  // are separators on Windows and are also normalized to slashes in URLs.

  checkPath(path) {
    if (
      (typeof path !== 'string') ||
      path.includes('\0') ||
      path.split(/[/\\]/).includes('..')
    ) {
      return module.exports.invalidPathError(path);
    }
    return null;
  },

  invalidPathError(path) {
    const error = new Error(`uploadfs: invalid path ${JSON.stringify(path)}`);
    error.code = 'EUPLOADFSPATH';
    return error;
  },

  // A readable stream that fails with `error`, for methods like
  // `streamOut` that report errors via the stream

  errorStream(error) {
    const stream = new PassThrough();
    process.nextTick(() => stream.destroy(error));
    return stream;
  }

};
