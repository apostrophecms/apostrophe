// The assistant's file store: chat files in the project's own uploadfs, in
// a folder of their own. A chat file is private by its path: each path
// holds a secret of 32 random bytes made for that file, kept only in the
// file's record and never given out, by a route, a log or an export.
// Files are written, read and removed with the calls Media makes, which
// every backend has, and are never disabled.
//
// A file's storage is `{ path, sizes }`: the file as given, and for an
// image the path of each of its sizes by name (`null` otherwise). The
// record keeps it whole, so a later change of the sizes never leaves a
// file behind.
//
// A file is prepared, its record stored, then it is written, so no bytes
// are ever stored without a record naming them. A write that fails leaves
// the record; removing the file clears whatever was written.

const crypto = require('crypto');
const fs = require('fs/promises');
const { promisify } = require('util');

// Never `attachments`: the hosting's sync tool takes such keys for site
// attachments
const FOLDER = '/apos-ai';
// The store's own, whatever image sizes the project sets: the panel's
// thumbnails and its fullscreen preview. The original is kept for Media
const SIZES = [
  {
    name: 'thumbnail',
    width: 400,
    height: 400
  },
  {
    name: 'preview',
    width: 1600,
    height: 1600
  }
];

module.exports = (self) => {
  return {
    /**
     * Makes the storage of a new chat file. An image is identified, and
     * gets its true extension and a path per size; any other file is
     * stored under a neutral extension, so its path never serves it as
     * what it is.
     *
     * @param {string} localPath
     * @param {string} extension The file's extension, as checked at intake.
     * @returns {Promise<object>} `{ storage, extension, width, height }`,
     *   `width` and `height` for an image only.
     */
    async prepareChatFile(localPath, extension) {
      const { attachment } = self.apos;
      const base = `${FOLDER}/${crypto.randomBytes(32).toString('hex')}`;
      if (!attachment.isSized(extension)) {
        return {
          storage: {
            path: `${base}.bin`,
            sizes: null
          },
          extension
        };
      }
      const identify = promisify(attachment.uploadfs.identifyLocalImage);
      let info;
      try {
        info = await identify(localPath);
      } catch (e) {
        throw self.apos.error('invalid', 'The image could not be read.');
      }
      return {
        storage: {
          path: `${base}.${info.extension}`,
          sizes: Object.fromEntries(SIZES.map(({ name }) => [
            name,
            `${base}.${name}.${info.extension}`
          ]))
        },
        extension: info.extension,
        width: info.width,
        height: info.height
      };
    },

    // Writes a prepared chat file, an image with each of its sizes
    async writeChatFile(localPath, storage) {
      const { uploadfs } = self.apos.attachment;
      try {
        if (storage.sizes) {
          await promisify(uploadfs.copyImageIn)(localPath, storage.path, {
            sizes: SIZES,
            // The original is what the model reads, whatever the project
            // keeps for Media
            copyOriginal: true
          });
        } else {
          await promisify(uploadfs.copyIn)(localPath, storage.path);
        }
      } catch (e) {
        throw storageError(e, 'The chat file could not be written.');
      }
    },

    /**
     * Reads a chat file back, or one of its image sizes.
     *
     * @param {object} storage
     * @param {object} [options]
     * @param {string} [options.size] `thumbnail` or `preview`; the file as
     *   given when unset or when the file has no sizes.
     * @returns {Promise<Buffer>} Throws `notfound` when the file is gone.
     */
    async readChatFile(storage, { size = null } = {}) {
      const { uploadfs } = self.apos.attachment;
      const path = (size && storage.sizes?.[size]) || storage.path;
      const temp = `${uploadfs.getTempPath()}/${self.apos.util.generateId()}`;
      try {
        await promisify(uploadfs.copyOut)(path, temp);
        return await fs.readFile(temp);
      } catch (e) {
        throw storageError(e, 'The chat file could not be read.');
      } finally {
        await fs.rm(temp, { force: true });
      }
    },

    // Removes a chat file and its image sizes. A file already gone counts
    // as removed, so an interrupted removal is finished by the next one
    async removeChatFile(storage) {
      const { uploadfs } = self.apos.attachment;
      const remove = promisify(uploadfs.remove);
      let failed = null;
      for (const path of [ storage.path, ...Object.values(storage.sizes || {}) ]) {
        try {
          await remove(path);
        } catch (e) {
          if (!isGone(e)) {
            failed = failed || e;
          }
        }
      }
      if (failed) {
        throw storageError(failed, 'The chat file could not be removed.');
      }
    }
  };

  // The backend's error names the path, which must never reach a log or a
  // response: only its code is kept
  function storageError(e, message) {
    if (e.aposError) {
      return e;
    }
    return isGone(e)
      ? self.apos.error('notfound', 'The chat file is no longer available.')
      : self.apos.error('error', message, { code: getCode(e) });
  }

  // Local storage: ENOENT; GCS and Azure: 404; S3: a 404 response, or
  // NoSuchKey (S3 and Azure removes never fail for a missing file)
  function isGone(e) {
    return [ 'ENOENT', 'NoSuchKey', 'BlobNotFound', 404 ].includes(getCode(e)) ||
      (e?.statusCode === 404) || (e?.$metadata?.httpStatusCode === 404);
  }

  function getCode(e) {
    return e?.code ?? e?.Code ?? e?.name ?? null;
  }
};
