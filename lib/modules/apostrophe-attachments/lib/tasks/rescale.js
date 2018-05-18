// Direct use of console is appropriate in tasks. -Tom
/* eslint-disable no-console */

var async = require('async');
var _ = require('@sailshq/lodash');
var request = require('request');
var fs = require('fs');

// Regenerate all scaled images. Useful after changing the configured sizes

module.exports = function(self) {
  return function(argv, callback) {
    console.log('Rescaling all images with latest uploadfs settings');
    return self.db.count(function(err, total) {
      if (err) {
        return callback(err);
      }
      var n = 0;
      self.each({}, argv.parallel || 1,
        function(file, fileCallback) {
          if (!_.contains(['jpg', 'png', 'gif'], file.extension)) {
            n++;
            console.log('Skipping a non-image attachment: ' + file.name + '.' + file.extension);
            return fileCallback(null);
          }
          var tempFile;
          async.series([
            function(callback) {
              var originalFile = '/attachments/' + file._id + '-' + file.name + '.' + file.extension;
              tempFile = self.uploadfs.getTempPath() + '/' + self.apos.utils.generateId() + '.' + file.extension;
              n++;
              console.log(n + ' of ' + total + ': ' + originalFile);
              async.series([
                function(resumeCallback) {
                  // By default, the --resume option will skip any image that
                  // has a one-third size rendering. If you are adding a
                  // different size, already have images of the other
                  // sizes for everything, and have some of the new images
                  // you can also pass --resume-test-size=sizename.
                  //
                  // --resume takes a site URL (no trailing /) to which the
                  // relative URL to files will be appended. If your media are
                  // actually on s3 you can skip that part, it'll figure it out.
                  if (!argv.resume) {
                    return resumeCallback(null);
                  }
                  var resumeTestSize = argv['resume-test-size'] || 'one-third';
                  var url = self.uploadfs.getUrl() + '/attachments/' + file._id + '-' + file.name + '.' + resumeTestSize + '.' + file.extension;
                  if (url.substr(0, 1) === '/') {
                    url = argv.resume + url;
                  }
                  return request.head(url, function(err, response, body) {
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
                  return self.uploadfs.copyOut(originalFile, tempFile, function(err) {
                    if (err) {
                      self.apos.utils.error('WARNING: could not access ' + originalFile + ', perhaps it was deleted');
                      return fileCallback(null);
                    }
                    return callback(null);
                  });
                },
                function(callback) {
                  if (!argv['crop-only']) {
                    return self.uploadfs.copyImageIn(tempFile, originalFile, function(err) {
                      if (err) {
                        self.apos.utils.error('WARNING: could not work with ' + tempFile + ' even though copyOut claims it is there');
                        return fileCallback(null);
                      }
                      return callback(null);
                    });
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
                var originalFile = '/attachments/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;
                console.log("Cropping " + tempFile + " to " + originalFile);
                return self.uploadfs.copyImageIn(tempFile, originalFile, { crop: crop }, function(err) {
                  if (err) {
                    console.error('WARNING: problem copying image back into uploadfs:');
                    console.error(err);
                    return fileCallback(null);
                  }
                  return callback(null);
                });
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
};
