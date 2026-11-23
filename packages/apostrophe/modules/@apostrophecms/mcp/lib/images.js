// The image tools' handlers (see lib/image-tools.js).
//
// `save_image_to_media` takes the file as base64, refuses it before decoding
// when it is over the `maxImageSize` option, and then goes through the
// attachment module's own intake: its file types, uploadfs's identification
// and scaled sizes, and its SVG sanitizing. The image piece is created
// through the harness's write path, as the connected user, so it is marked
// as AI's and recorded in the change log.
//
// `get_image` returns links, never the image's bytes: no tool returns
// binary data.

const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');

const IMAGE = '@apostrophecms/image';
// 10 MB, as Finder and the media library count: 1 MB is 1,000,000 bytes
const DEFAULT_MAX_IMAGE_SIZE = 10 * 1000 * 1000;

module.exports = (self) => {
  return {
    async saveImageToMedia(req, {
      data, fileName, title, alt, locale
    }) {
      const imageReq = locale ? req.clone({ locale }) : req;
      const draftReq = imageReq.clone({ mode: 'draft' });
      if (
        !self.apos.ai.can(draftReq, 'create', IMAGE, 'draft') ||
        !self.apos.permission.can(req, 'upload-attachment')
      ) {
        throw refuse('The user may not add images to the media library.');
      }
      const field = getAttachmentField();
      const extension = checkFileName(field, fileName);
      const bytes = decode(data);
      const attachment = await insertAttachment(req, field, {
        fileName,
        extension,
        bytes
      });
      let written;
      try {
        const schema = self.apos.image.schema;
        const result = await self.apos.aposHarness.createDocument(imageReq, {
          type: IMAGE,
          title,
          values: {
            attachment: { _id: attachment._id },
            // A project may have removed the field
            ...(schema.some(field => field.name === 'alt') && { alt })
          }
        });
        [ written ] = result.written;
        if (!written) {
          const [ refusal ] = result.refused;
          throw self.apos.error('aiToolError', [
            `The image was refused: ${refusal.message}`,
            ...(refusal.fields || []).map(field => `${field.path}: ${field.message || field.reason}`)
          ].join('\n'));
        }
      } catch (e) {
        // Nothing holds the file now
        await removeAttachment(attachment);
        throw e;
      }
      const { doc, ...image } = written;
      return {
        ...image,
        alt: doc.alt,
        width: attachment.width,
        height: attachment.height,
        fileType: attachment.extension
      };
    },

    async getImage(req, { _id }) {
      const { doc, manager } = await self.apos.aposHarness.findReadable(req, _id);
      if (!self.apos.instanceOf(manager, IMAGE)) {
        throw self.apos.error(
          'aiToolError',
          `"${_id}" is not an image: it is a "${doc.type}". ` +
            `Images are documents of type "${IMAGE}".`
        );
      }
      const attachment = doc.attachment;
      return {
        _id: doc._id,
        title: doc.title,
        alt: doc.alt || '',
        ...(doc.credit && { credit: doc.credit }),
        ...(attachment && {
          width: attachment.width,
          height: attachment.height,
          fileType: attachment.extension,
          sizes: getSizes(req, attachment)
        })
      };
    },

    // The largest image `save_image_to_media` takes, in bytes: the
    // `maxImageSize` option, else the attachment module's `maxSize` when it
    // is a number of bytes (a string such as "10MB" is only shown in the
    // uploader), else 10 MB
    getMaxImageSize() {
      if (self.options.maxImageSize !== undefined) {
        return self.options.maxImageSize;
      }
      const { maxSize } = self.apos.attachment.options;
      return self.isBytes(maxSize) ? maxSize : DEFAULT_MAX_IMAGE_SIZE;
    },

    isBytes(value) {
      return Number.isSafeInteger(value) && (value > 0);
    },

    // `bytes` as people read it, in decimal units as Finder, phones and the
    // media library show file sizes: "104 KB", "10.3 MB"
    formatSize(bytes) {
      if (bytes >= 1000 * 1000) {
        return `${Number((bytes / (1000 * 1000)).toFixed(1))} MB`;
      }
      if (bytes >= 1000) {
        return `${Math.round(bytes / 1000)} KB`;
      }
      return `${bytes} bytes`;
    }
  };

  // The image type's attachment field, whose file types an image may have
  function getAttachmentField() {
    return self.apos.image.schema.find(field => field.type === 'attachment');
  }

  // The extension `fileName` claims, canonical (jpeg is jpg), when the
  // image's attachment field accepts it
  function checkFileName(field, fileName) {
    const claimed = path.extname(fileName).slice(1).toLowerCase();
    const group = self.apos.attachment.getFileGroup(claimed);
    const extension = self.apos.attachment.resolveExtension(claimed);
    if (!group || self.apos.attachment.checkExtension(field, {
      group: group.name,
      extension
    })) {
      throw refuse(
        `"${fileName}" isn't an image type the media library takes. ` +
          `Name the file with one of these extensions: ${getExtensions(field).join(', ')}.`
      );
    }
    return extension;
  }

  // The extensions the attachment field accepts
  function getExtensions(field) {
    return field.accept.split(',').map(accept => accept.replace(/^\./, ''));
  }

  // The bytes of base64 `data`, refused before decoding when over the size
  // limit
  function decode(data) {
    const base64 = data
      .replace(/^data:[^,]*;base64,/i, '')
      .replace(/\s+/g, '');
    const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
    const size = Math.floor(base64.length * 3 / 4) - padding;
    const max = self.maxImageSize;
    if (size > max) {
      // Just over the limit, both may round to the same figure
      const [ shown, limit ] = (self.formatSize(size) === self.formatSize(max))
        ? [ size, max ].map(bytes => `${bytes.toLocaleString('en-US')} bytes`)
        : [ size, max ].map(self.formatSize);
      throw refuse(
        `The image is ${shown}, over the limit of ${limit}. ` +
          'Send a smaller or more compressed file.'
      );
    }
    if (!isBase64(base64)) {
      throw refuse('"data" isn\'t valid base64.');
    }
    return Buffer.from(base64, 'base64');
  }

  // Standard or URL-safe base64, with up to two `=` of padding at the end.
  // Checked by searching for one character out of place, not by matching
  // the whole string with a repeated pattern: on a string of a few MB that
  // pattern overflows the regular expression engine's stack inside a
  // request
  function isBase64(base64) {
    const padding = base64.indexOf('=');
    return (base64.length > 0) &&
      !/[^A-Za-z0-9+/_=-]/.test(base64) &&
      ((padding === -1) || (
        (padding >= base64.length - 2) &&
        (base64.slice(padding) === '='.repeat(base64.length - padding))
      ));
  }

  // Stores the file as an attachment through the attachment module's
  // intake. The file must be an image of a type the field accepts,
  // whatever its name claims: a raster image as uploadfs identifies it, an
  // SVG as markup
  async function insertAttachment(req, field, {
    fileName, extension, bytes
  }) {
    const tempPath = path.join(
      self.apos.uploadfs.getTempPath(),
      `mcp-${self.apos.util.generateId()}`
    );
    await fs.writeFile(tempPath, bytes);
    try {
      if (self.apos.attachment.isSized(extension)) {
        const identified = await identify(tempPath);
        const actual = identified && self.apos.attachment.resolveExtension(identified);
        if (!actual || !getExtensions(field).includes(actual)) {
          throw refuse(
            'The data isn\'t an image the media library takes. It takes ' +
              `${getExtensions(field).join(', ')}.`
          );
        }
      } else if (!bytes.toString('utf8', 0, 4096).includes('<svg')) {
        throw refuse(`The data isn't an SVG image, as "${fileName}" says.`);
      }
      return await self.apos.attachment.insert(req, {
        name: fileName,
        path: tempPath
      });
    } finally {
      await fs.rm(tempPath, { force: true });
    }
  }

  // The file type uploadfs identifies the file as, `null` when it can't
  // read it as an image
  async function identify(filePath) {
    try {
      const info = await promisify(self.apos.uploadfs.identifyLocalImage)(filePath);
      return info?.extension || null;
    } catch (e) {
      return null;
    }
  }

  // Removes an attachment no document holds, its files included
  async function removeAttachment(attachment) {
    try {
      await self.apos.attachment.alterAttachment(attachment, 'remove');
      await self.apos.attachment.db.deleteOne({ _id: attachment._id });
    } catch (e) {
      self.logError('mcp-attachment-cleanup-failed', e.message, {
        attachmentId: attachment._id
      });
    }
  }

  // `[ { name, width, height, url } ]`, smallest first: every scaled size
  // the project defines (the attachment module's `imageSizes`), or the file
  // itself when it has none (SVG). Links are absolute; uploads stored on the
  // site are linked through the site's own address
  function getSizes(req, attachment) {
    const link = size => new URL(
      self.apos.attachment.url(attachment, { size }),
      req.baseUrl
    ).href;
    if (!self.apos.attachment.isSized(attachment)) {
      return [ {
        name: 'original',
        ...getDimensions(attachment),
        url: link('original')
      } ];
    }
    // By box first, so that sizes a small image fills alike stay in order
    const bySize = (one, two) => (one.width - two.width) || (one.height - two.height);
    return [ ...self.apos.attachment.imageSizes ]
      .sort(bySize)
      .map(size => ({
        name: size.name,
        ...getDimensions(attachment, size),
        url: link(size.name)
      }))
      .sort(bySize);
  }

  // The dimensions of the file uploadfs makes for `size`: the image scaled to
  // fit inside the size's box, never enlarged. Without a `size`, or without
  // known dimensions, the attachment's own, when it has them
  function getDimensions(attachment, size) {
    const { width, height } = attachment;
    if (!(width > 0 && height > 0)) {
      return {};
    }
    if (!size) {
      return {
        width,
        height
      };
    }
    const scale = Math.min(1, size.width / width, size.height / height);
    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale)
    };
  }

  function refuse(message) {
    return self.apos.error('aiToolError', message);
  }
};
