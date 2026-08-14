const _ = require('lodash');
const fs = require('fs');
const Promise = require('bluebird');

// One progress line per this many attachments, rather than one per attachment.
const PROGRESS_EVERY = 100;

// Regenerate all scaled images. Useful after changing the configured sizes

module.exports = function(self) {
  return async function(argv) {
    const total = await self.db.count();
    let n = 0;
    self.logInfo('rescale-start', 'Rescaling all images with latest uploadfs settings', {
      total
    });
    await self.each({}, argv.parallel || 1, async function(file) {
      if (!_.includes([ 'jpg', 'png', 'gif', 'webp' ], file.extension)) {
        n++;
        self.logDebug(
          'rescale-not-an-image',
          'Skipping a non-image attachment: ' + file.name + '.' + file.extension,
          { _id: file._id }
        );
        return;
      }

      const originalFile = '/attachments/' + file._id + '-' + file.name + '.' + file.extension;
      const tempFile = self.uploadfs.getTempPath() + '/' + self.apos.util.generateId() + '.' + file.extension;
      n++;
      if (n % PROGRESS_EVERY === 0) {
        self.logInfo('rescale-progress', n + ' of ' + total, {
          done: n,
          total
        });
      }
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
        const resumeTestSize = argv['resume-test-size'] || 'one-third';
        let url = self.uploadfs.getUrl() + '/attachments/' + file._id + '-' + file.name + '.' + resumeTestSize + '.' + file.extension;
        if (url.substr(0, 1) === '/') {
          url = argv.resume + url;
        }
        try {
          await self.apos.http.head(url);
          self.logDebug('rescale-exists', 'exists, skipping', { file: originalFile });
          return;
        } catch (e) {
          // Continue the pipeline, we didn't find it
        }
      }
      try {
        await Promise.promisify(self.uploadfs.copyOut)(originalFile, tempFile);
      } catch (e) {
        self.logWarn(
          'rescale-missing',
          'could not access ' + originalFile + ', perhaps it was deleted',
          { file: originalFile }
        );
        return;
      }
      if (!argv['crop-only']) {
        try {
          await Promise.promisify(self.uploadfs.copyImageIn)(tempFile, originalFile, {
            sizes: self.imageSizes
          });
        } catch (e) {
          self.logWarn(
            'rescale-failed',
            'could not work with ' + tempFile + ' even though copyOut claims it is there',
            { file: originalFile }
          );
          return;
        }
      }
      for (const crop of file.crops || []) {
        const originalFile = '/attachments/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;
        self.logDebug('rescale-crop', 'Cropping ' + tempFile + ' to ' + originalFile, {
          file: originalFile
        });
        try {
          await Promise.promisify(self.uploadfs.copyImageIn)(tempFile, originalFile, {
            crop,
            sizes: self.imageSizes
          });
        } catch (e) {
          self.logError('rescale-copy-back-failed', 'problem copying image back into uploadfs', {
            file: originalFile,
            stack: e.stack
          });
        }
      }
      await (Promise.promisify(fs.unlink))(tempFile);
    });
    self.logInfo('rescale-complete', `Rescaled ${n} of ${total} attachment(s)`, {
      done: n,
      total
    });
  };
};
