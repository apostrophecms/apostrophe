// Direct use of console is appropriate in tasks. -Tom
/* eslint-disable no-console */

const _ = require('lodash');
const request = require('request-promise');
const fs = require('fs');

// Regenerate all scaled images. Useful after changing the configured sizes

module.exports = function(self) {
  return async function(argv) {
    console.log('Rescaling all images with latest uploadfs settings');
    const total = await self.db.count();
    let n = 0;
    await self.each({}, argv.parallel || 1, async function(file) {
      if (!_.includes(['jpg', 'png', 'gif'], file.extension)) {
        n++;
        console.log('Skipping a non-image attachment: ' + file.name + '.' + file.extension);
        return;
      }
      let tempFile;
      const originalFile = '/attachments/' + file._id + '-' + file.name + '.' + file.extension;
      tempFile = self.uploadfs.getTempPath() + '/' + self.apos.utils.generateId() + '.' + file.extension;
      n++;
      console.log(n + ' of ' + total + ': ' + originalFile);
      // By default, the --resume option will skip any image that
      // has a one-third size rendering. If you are adding a
      // different size, already have images of the other
      // sizes for everything, and have some of the new images
      // you can also pass --resume-test-size=sizename.
      //
      // --resume takes a site URL (no trailing /) to which the
      // relative URL to files will be appended. If your media are
      // actually on s3 you can skip that part, it'll figure it out.
      if (argv.resume) {
        let resumeTestSize = argv['resume-test-size'] || 'one-third';
        let url = self.uploadfs.getUrl() + '/attachments/' + file._id + '-' + file.name + '.' + resumeTestSize + '.' + file.extension;
        if (url.substr(0, 1) === '/') {
          url = argv.resume + url;
        }
        try {
          await request.head(url);
          console.log('exists, skipping');
          return;
        } catch (e) {
          // Continue the pipeline, we didn't find it
        }
      }
      try {
        await Promise.promisify(self.uploadfs.copyOut)(originalFile, tempFile);
      } catch (e) {
        self.apos.utils.error('WARNING: could not access ' + originalFile + ', perhaps it was deleted');
        return;
      }
      if (!argv['crop-only']) {
        try {
          await Promise.promisify(self.uploadfs.copyImageIn)(tempFile, originalFile);
        } catch (e) {
          self.apos.utils.error('WARNING: could not work with ' + tempFile + ' even though copyOut claims it is there');
          return;
        }
      }
      for (let crop of file.crops) {
        console.log('RECROPPING');
        const originalFile = '/attachments/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;
        console.log("Cropping " + tempFile + " to " + originalFile);
        try {
          Promise.promisify(self.uploadfs.copyImageIn)(tempFile, originalFile, { crop: crop });
        } catch (e) {
          console.error('WARNING: problem copying image back into uploadfs:');
          console.error(e);
        }
      }
      await (Promise.promisify(fs.unlink))(tempFile);
    });
  };
};
