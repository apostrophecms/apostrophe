const crypto = require('crypto');
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
  }

};
