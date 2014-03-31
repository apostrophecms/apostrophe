var async = require('async');
var _ = require('lodash');
var argv = require('optimist').argv;
var request = require('request');
var fs = require('fs');

// Regenerate all scaled images. Useful after changing the configured sizes

module.exports = function(self, callback) {
  console.log('Rescaling all images with latest uploadfs settings');
  return self.files.count(function(err, total) {
    if (err) {
      return callback(err);
    }
    var n = 0;
    self.forEachFile({},
      function(file, fileCallback) {
        if (!_.contains(['jpg', 'png', 'gif'], file.extension)) {
          n++;
          console.log('Skipping a non-image file: ' + file.name + '.' + file.extension);
          return fileCallback(null);
        }
        var tempFile;
        async.series([
          function(callback) {
            var originalFile = '/files/' + file._id + '-' + file.name + '.' + file.extension;
            tempFile = self.uploadfs.getTempPath() + '/' + self.generateId() + '.' + file.extension;
            n++;
            console.log(n + ' of ' + total + ': ' + originalFile);
            async.series([
              function(resumeCallback) {
                // ACHTUNG: the --resume option will skip any image that
                // has a one-third size rendering. So it's not very useful
                // for resuming the addition of an additional size. But
                // it's pretty handy after a full import. --resume takes
                // a site URL (no trailing /) to which the relative URL
                // to files will be appended. If your media are
                // actually on s3 you can skip that part, it'll figure it out.
                if (!argv.resume) {
                  return resumeCallback(null);
                }
                var url = self.uploadfs.getUrl() + '/files/' + file._id + '-' + file.name + '.one-third.' + file.extension;
                if (url.substr(0, 1) === '/') {
                  url = argv.resume + url;
                }
                console.log('Checking ' + url);
                return request.head(url, function(err, response, body) {
                  console.log(err);
                  console.log(response.statusCode);
                  if ((!err) && (response.statusCode === 200)) {
                    // Invoke the MAIN callback, skipping this file
                    console.log('exists, skipping');
                    return fileCallback(null);
                  }
                  // Continue the pipeline to rescale this file
                  return resumeCallback(null);
                });
              },
              function(callback) {
                self.uploadfs.copyOut(originalFile, tempFile, callback);
              },
              function(callback) {
                if (!argv['crop-only']) {
                  return self.uploadfs.copyImageIn(tempFile, originalFile, callback);
                } else {
                  return callback(null);
                }
              }
            ], callback);
          },
          // Don't forget to recrop as well!
          function(callback) {
            async.forEachSeries(file.crops || [], function(crop, callback) {
              console.log('RECROPPING');
              var originalFile = '/files/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;
              console.log("Cropping " + tempFile + " to " + originalFile);
              self.uploadfs.copyImageIn(tempFile, originalFile, { crop: crop }, callback);
            }, callback);
          },
          function(callback) {
            fs.unlink(tempFile, callback);
          }
        ], fileCallback);
      },
      callback);
  });
};
