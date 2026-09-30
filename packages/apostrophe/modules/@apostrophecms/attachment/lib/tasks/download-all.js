const fs = require('fs');
const sep = require('path').sep;

// One progress line per this many attachments, rather than one per attachment.
const PROGRESS_EVERY = 100;

// Download everything Apostrophe believes to be in uploadfs.
// Useful when uploadfs is not using a storage backend we
// can conveniently sync from in some other way

module.exports = function(self) {
  return async function(argv) {
    const copyOut = require('util').promisify(self.uploadfs.copyOut);
    if (!argv.to) {
      throw 'You must specify a --to=directory argument';
    }
    const files = fs.readdirSync(argv.to);
    if ((files.length > 0) && (!argv.resume)) {
      throw `The directory ${argv.to} is not empty and --resume not specified, exiting`;
    }
    if (!argv.to.endsWith(sep)) {
      argv.to += sep;
    }
    const total = await self.db.count();
    let n = 0;
    const parallel = argv.parallel ? parseInt(argv.parallel) : 1;
    self.logInfo(
      'download-all-start',
      `Downloading all attachments to ${argv.to} (this takes time)`,
      {
        to: argv.to,
        total,
        parallel
      }
    );
    await self.each({}, parallel, async function(file) {
      const isImage = [ 'jpg', 'png', 'gif', 'webp' ].includes(file.extension);
      const originalFile = filename(file);
      n++;
      if (n % PROGRESS_EVERY === 0) {
        self.logInfo('download-all-progress', `${n} of ${total}`, {
          done: n,
          total
        });
      }
      const files = [
        originalFile
      ];
      if (isImage) {
        files.push(...self.imageSizes.map(size => {
          return filename(file, size);
        }));
        for (const crop of (file.crops || [])) {
          files.push(filename(file, false, crop));
          files.push(...self.imageSizes.map(size => filename(file, size, crop)));
        }
      }
      for (const file of files) {
        const to = argv.to + file;
        const tmp = to + '.tmp';
        if (fs.existsSync(to)) {
          self.logDebug('download-exists', `${to} already exists, skipping`, { file });
        } else {
          try {
            self.logDebug('download-file', `about to copy out: ${file}`, { file });
            await copyOut(`/attachments/${file}`, tmp);
            fs.renameSync(tmp, argv.to + file);
          } catch (e) {
            if (e.code === 'ENOSPC') {
              throw e;
            } else {
              self.logWarn(
                'download-missing',
                `${e.code}: ${file} was probably never uploaded to uploadfs, skipping`,
                {
                  file,
                  code: e.code
                }
              );
            }
          }
        }
      }
      function filename(file, size, crop) {
        let name = file._id + '-' + file.name;
        if (crop) {
          name += '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height;
        }
        if (size) {
          name += '.' + size.name;
        }
        name += '.' + file.extension;
        return name;
      }
    });
    self.logInfo('download-all-complete', `Downloaded ${n} of ${total} attachment(s)`, {
      done: n,
      total
    });
  };
};
