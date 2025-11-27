// Copy a file reliably, with error handling.
// path1 is the original file, path2 is the new file.
// "options" is used in internal recursive calls and
// may be omitted.
//
// Creates any necessary parent folders of path2 automatically.

const fs = require('fs');
const path = require('path');

const copy = module.exports = function(path1, path2, options, callback) {
  let failed = false;
  let retryingWithMkdirp = false;
  if (!callback) {
    callback = options;
    options = {};
  }
  // Other people's implementations of fs.copy() lack
  // error handling, let's be thorough and also implement
  // a retry that does mkdirp() for consistency with S3
  const sin = fs.createReadStream(path1);
  const sout = fs.createWriteStream(path2);

  sin.on('error', function(e) {
    if (failed) {
      return;
    }
    failed = true;
    errorCleanup();
    return callback(e);
  });

  sout.on('error', function(e) {
    if (failed) {
      return;
    }
    // If the destination folder doesn't exist yet,
    // retry the whole thing after recursively creating
    // the folder and its parents as needed, avoiding the
    // overhead of checking for folders in the majority
    // of cases where they already exist.
    //
    // Try this up to 100 times to guard against race conditions
    // with the empty directory cleanup mechanism: as long as
    // there are fewer than 100 node processes running this backend
    // at once, it should not be possible for a sudden burst
    // of rmdir()s to defeat the mkdir() mechanism.
    //
    // Note that there will only be one node process unless you're using
    // cluster, multiple Heroku dynos, or something similar.
    //
    // If you have more than 100 CPU cores bashing on this folder,
    // I respectfully suggest it may be time for the
    // S3 backend anyway.

    if ((e.code === 'ENOENT') && ((!options.afterMkdirp) || (options.afterMkdirp <= 100))) {
      retryingWithMkdirp = true;
      return mkdirp(path.dirname(path2), function (e) {
        if (e) {
          if (failed) {
            return;
          }
          return callback(e);
        }
        options.afterMkdirp = options.afterMkdirp ? (options.afterMkdirp + 1) : 1;
        return copy(path1, path2, options, callback);
      });
    }
    errorCleanup();
    failed = true;
    return callback(e);
  });

  sout.on('close', function() {
    if (retryingWithMkdirp) {
      // This is the original stream closing after error (in node 16+
      // we always get a close event even on an error), don't consider
      // this success, but don't worry either as we're going to try
      // again after mkdirp
      return;
    }
    if (failed) {
      // We already reported an error
      return;
    }
    // Report success
    return callback(null);
  });

  // Carry out the actual copying
  sin.pipe(sout);

  function errorCleanup() {
    // This will fail if we weren't able to write to
    // path2 in the first place; don't get excited
    fs.unlink(path2, function(e) { });
  }
};

// Legacy-compatible, tested implementation of mkdirp without
// any npm audit vulnerabilities

function mkdirp(dir, callback) {
  dir = path.resolve(dir);
  return fs.mkdir(dir, function(err) {
    if (!err) {
      return callback(null);
    }
    if (err.code === 'EEXIST') {
      return callback(null);
    }
    if (err.code === 'ENOENT') {
      const newDir = path.dirname(dir);
      if (newDir === dir) {
        return callback(err);
      }
      return mkdirp(newDir, function(err) {
        if (err) {
          return callback(err);
        }
        return mkdirp(dir, callback);
      });
    }
    return callback(err);
  });
}
