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

// The sizes `get_image` links to, when the project has them: small enough
// to look at, the width of a page's content, and the largest
const SIZES = [ 'one-third', 'full', 'max' ];

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
        const result = await self.apos.harness.createDocument(imageReq, {
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
      const { doc, manager } = await self.apos.harness.findReadable(req, _id);
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
          urls: getUrls(req, attachment)
        })
      };
    },

    // `bytes` as people read it: "512 KB", "10 MB"
    formatSize(bytes) {
      const mb = bytes / (1024 * 1024);
      return (mb >= 1)
        ? `${Number(mb.toFixed(1))} MB`
        : `${Math.ceil(bytes / 1024)} KB`;
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
    const max = self.options.maxImageSize;
    if (size > max) {
      throw refuse(
        `The image is ${self.formatSize(size)}, over the limit of ` +
          `${self.formatSize(max)}. Send a smaller or more compressed file.`
      );
    }
    // Standard or URL-safe
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(base64)) {
      throw refuse('"data" isn\'t valid base64.');
    }
    return Buffer.from(base64, 'base64');
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

  // Absolute links to the attachment's file, by size name: up to three of
  // the scaled sizes, or the file itself when it has none (SVG). Uploads
  // stored on the site are linked through the site's own address
  function getUrls(req, attachment) {
    const urls = {};
    if (self.apos.attachment.isSized(attachment)) {
      const names = self.apos.attachment.imageSizes.map(size => size.name);
      let chosen = SIZES.filter(name => names.includes(name));
      if (!chosen.length) {
        // The project has its own sizes: the smallest and the largest
        const sorted = [ ...self.apos.attachment.imageSizes ]
          .sort((one, two) => one.width - two.width)
          .map(size => size.name);
        chosen = [ ...new Set([ sorted[0], sorted.at(-1) ]) ];
      }
      for (const size of chosen) {
        urls[size] = self.apos.attachment.url(attachment, { size });
      }
    } else {
      urls.original = self.apos.attachment.url(attachment, { size: 'original' });
    }
    for (const [ size, url ] of Object.entries(urls)) {
      urls[size] = new URL(url, req.baseUrl).href;
    }
    return urls;
  }

  function refuse(message) {
    return self.apos.error('aiToolError', message);
  }
};
