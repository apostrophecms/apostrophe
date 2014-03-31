var async = require('async');
var _ = require('lodash');
var argv = require('optimist').argv;
var request = require('request');
var fs = require('fs');

// Make sure all files that are in the trash have been hidden from web access.
// (The one-sixth size of images remains available so admins can easily browse
// the trash.) This is automatic for all items put in the trash today, so this
// task should just be a one-time fixup for existing sites as of 2014-01-14.

module.exports = function(self, callback) {
  console.log('Disabling web access to all files in the trash. This takes a while,');
  console.log('especially if you are using S3 rather than local files. You should');
  console.log('only need this task once, and only for older sites.');
  var errors = 0;
  return self.files.find({ trash: true }).count(function(err, total) {
    var n = 0;
    return self.forEachFile({ trash: true },
      function(file, callback) {
        n++;
        console.log(n + ' of ' + total + ': ' + file.name);
        return self.hideInUploadfs(file, true, function(err) {
          if (err) {
            console.error('Error on ' + file.name + ': ' + err);
            errors++;
          }
          return callback(null);
        });
      }, function(err) {
        if (err) {
          return callback(err);
        }
        if (errors) {
          console.error('ERRORS OCCURRED: ' + errors + ' out of ' + total + ' files');
          console.error('Maybe some of your files are no longer on disk,');
          console.error('or you added sizes later without running apostrophe:rescale.');
          console.error('I hid all the trashed files I could access.');
          return callback('errors');
        }
        return callback(null);
      }
    );
  });
};
