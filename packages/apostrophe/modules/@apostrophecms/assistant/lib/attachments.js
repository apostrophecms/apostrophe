// Chat attachments: files an editor attaches to a request, one record each
// in `aposChatAttachments`, the bytes in the file store (see files.js).
//
// A file is uploaded to a chat before its request is sent, under the id the
// browser named the chat by, which may not exist yet; the send claims it by
// setting its `requestId`. Until then its owner may delete it.
//
// The request record keeps a description of each file, and its user
// message a reference line per file plus, for an image or a PDF, a part
// naming the file (`{ type, attachmentId, name, mediaType }`). The bytes
// are built into those parts just before a call (`addAttachmentBytes`) and
// never stored: what a run stores keeps the references.
//
// A record: `{ _id, schemaVersion, ownerId, chatId, requestId, kind,
// status, name, extension, mediaType, size, width, height, pages,
// convertedFrom, storage, createdAt, updatedAt }`. `kind` is `attachment`,
// or `candidate` for a file an image ask holds (its `callId`, `kept` when
// picked on Refine; see image-tools.js); an attachment a picked image
// became carries `replaces`, the Media image its save updates. `status` is
// `writing` until the bytes are stored, then `stored`, `missing` once a
// read found its bytes gone from storage, or `orphan` once its chat is
// deleted and a file could not be removed: an orphan keeps its owner and
// its storage only, for a later removal.

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const multer = require('multer');

const SCHEMA_VERSION = 1;
const NAME_MAX = 200;
// What a request may carry, by extension, and how the assistant reads it
const TYPES = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  // Converted to PNG: no provider takes them
  avif: 'image',
  heic: 'image',
  heif: 'image',
  svg: 'svg',
  pdf: 'pdf',
  html: 'html',
  htm: 'html',
  css: 'css',
  json: 'tokens',
  tokens: 'tokens',
  md: 'markdown',
  markdown: 'markdown'
};
// Image formats every provider takes, by the extension uploadfs reports
const IMAGE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
};
const TEXT_TYPES = {
  svg: 'image/svg+xml',
  html: 'text/html',
  css: 'text/css',
  tokens: 'application/json',
  markdown: 'text/markdown'
};
// The largest edge of a converted image: providers scale larger ones down
const CONVERT_MAX_EDGE = 2048;
const ATTACHMENTS_INTRO = 'Files attached to this message, by id: read one with ' +
  'read_attachment, look at an image again with describe_images. Images and PDFs ' +
  'also follow as parts of this message:';
// For "couldn't be read as …"
const TEXT_WHAT = {
  svg: 'an SVG',
  html: 'HTML',
  css: 'CSS',
  tokens: 'JSON',
  markdown: 'Markdown'
};
// How to build pages from a source the user attached
const SOURCE_SECTION = [
  'Building from an attached source. When the user asks for pages built from an attached ' +
    'screenshot, HTML or CSS:',
  '- Read the source first: a screenshot is in the message (describe_images reads it ' +
    'again), HTML and CSS with read_attachment.',
  '- Build only from this site\'s own page types and widgets: read the schema of each one ' +
    'you use. Never invent a widget, markup or styles the site does not have.',
  '- One page per source, unless the user asks otherwise. Pages are created as drafts.',
  '- Match each part of the source to the closest widget. In your reply, name each page ' +
    'you created, and each part no widget matched with what you used instead, or that you ' +
    'left it out.'
].join('\n');
const KIND_NAMES = {
  image: 'image',
  svg: 'SVG',
  pdf: 'PDF',
  html: 'HTML',
  css: 'CSS',
  tokens: 'tokens',
  markdown: 'Markdown'
};

module.exports = (self) => {
  return {
    async ensureAttachmentCollection() {
      self.attachments = await self.apos.db.collection('aposChatAttachments');
      await self.attachments.createIndex({
        chatId: 1,
        createdAt: 1
      });
      await self.attachments.createIndex({
        ownerId: 1,
        status: 1
      });
    },

    // The instructions' section on building pages from an attached source,
    // in a chat that has files
    getSourceSection() {
      return SOURCE_SECTION;
    },

    // The extensions a request may carry, by what the chat's route reads:
    // no PDF without `documentInput`, no image without `imageInput`
    getAttachmentExtensions() {
      const unreadable = self.getUnreadableExtensions();
      return Object.keys(TYPES).filter(extension => !unreadable[extension]);
    },

    // The extensions of the kinds the chat's route can't read, each with
    // its kind, so the panel says why it refuses them
    getUnreadableExtensions() {
      const route = self.getAttachmentRoute();
      return Object.fromEntries(Object.entries(TYPES).filter(([ , kind ]) =>
        ((kind === 'pdf') && !route.documentInput) ||
        ((kind === 'image') && !route.imageInput)));
    },

    // What the chat's route reads: `{ imageInput, documentInput,
    // maxDocumentPages, maxDocumentBytes }`. Mock mode with no provider
    // routes nothing and reads everything
    getAttachmentRoute() {
      const { effort } = self.options;
      if (!Object.keys(self.apos.ai.modelCatalog().effort.levels).length) {
        return {
          imageInput: true,
          documentInput: true
        };
      }
      const info = self.apos.ai.modelInfo(effort ? { effort } : {});
      return {
        imageInput: Boolean(info.capabilities.imageInput),
        documentInput: Boolean(info.capabilities.documentInput),
        maxDocumentPages: info.maxDocumentPages,
        maxDocumentBytes: info.maxDocumentBytes
      };
    },

    /**
     * Stores a file attached to a chat's next request. The chat may not
     * exist yet; one of someone else is not found. Refused with `invalid`
     * and `data.reason`, before anything is stored: `type`, `route` (the
     * chat's route can't read its `kind`), `size` (`size`, `limit`),
     * `pages` (`pages`, `limit`), `count` (`limit`) or `unreadable` (not a
     * file of its type). An image in a format no provider takes is
     * converted to PNG.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} file `{ originalname, path, size }`, as multer gives it.
     * @returns {Promise<object>} The attachment as the browser reads it
     *   (`renderAttachment`).
     */
    async attach(req, chatId, file) {
      const ownerId = self.getOwnerId(req);
      const _id = self.apos.launder.id(chatId);
      if (!_id) {
        throw self.apos.error('invalid', 'the chat id is not valid');
      }
      const chat = await self.chats.findOne({ _id }, { projection: { ownerId: 1 } });
      if (chat && (chat.ownerId !== ownerId)) {
        throw self.apos.error('notfound');
      }
      const name = path.basename(self.apos.launder.string(file.originalname || file.name))
        .trim()
        .slice(-NAME_MAX) || 'file';
      let extension;
      try {
        ({ extension } = self.apos.attachment.checkFileType(req, file, {
          extensions: Object.keys(TYPES)
        }));
      } catch (e) {
        throw refuse('type', `${name}: this kind of file can't be attached`);
      }
      const kind = TYPES[extension];
      const route = self.getAttachmentRoute();
      if (((kind === 'pdf') && !route.documentInput) || ((kind === 'image') && !route.imageInput)) {
        throw refuse('route', `${name}: the assistant can't read this kind of file`, { kind });
      }
      checkSize(file.size ?? (await fs.stat(file.path)).size);
      const count = await self.attachments.countDocuments({
        ownerId,
        chatId: _id,
        kind: 'attachment',
        requestId: null,
        status: { $ne: 'orphan' }
      });
      if (count >= self.options.attachmentMaxCount) {
        throw refuse('count', `${name}: a request takes up to ${self.options.attachmentMaxCount} files`, {
          limit: self.options.attachmentMaxCount
        });
      }
      const temp = [];
      try {
        const intake = await readFile();
        const record = await self.storeChatFile(intake.path, intake.extension, {
          ownerId,
          chatId: _id,
          requestId: null,
          kind: 'attachment',
          name: intake.name,
          mediaType: intake.mediaType,
          size: intake.size,
          ...(intake.pages && { pages: intake.pages }),
          ...(intake.convertedFrom && { convertedFrom: intake.convertedFrom })
        });
        return self.renderAttachment(record);
      } finally {
        for (const file of temp) {
          await fs.rm(file, { force: true });
        }
      }

      // The file as it is stored: `{ path, extension, name, mediaType,
      // size, pages, convertedFrom }`
      async function readFile() {
        const unreadable = (what) => refuse('unreadable', `${name} couldn't be read as ${what}`, { kind });
        if (kind === 'image') {
          let info;
          try {
            const { uploadfs } = self.apos.attachment;
            info = await promisify(uploadfs.identifyLocalImage)(file.path);
          } catch (e) {
            throw unreadable('an image');
          }
          if (IMAGE_TYPES[info.extension]) {
            return {
              path: file.path,
              extension: info.extension,
              name,
              size: (await fs.stat(file.path)).size
            };
          }
          return convert(info.extension);
        }
        const bytes = await fs.readFile(file.path);
        if (kind === 'pdf') {
          if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
            throw unreadable('a PDF');
          }
          const pages = countPdfPages(bytes);
          if (route.maxDocumentBytes && (bytes.length > route.maxDocumentBytes)) {
            throw refuse('size', `${name} is over the ${megabytes(route.maxDocumentBytes)} limit`, {
              size: bytes.length,
              limit: route.maxDocumentBytes
            });
          }
          if (pages && route.maxDocumentPages && (pages > route.maxDocumentPages)) {
            throw refuse('pages', `${name} has ${pages} pages, over the ${route.maxDocumentPages} page limit`, {
              pages,
              limit: route.maxDocumentPages
            });
          }
          return {
            path: file.path,
            extension,
            name,
            mediaType: 'application/pdf',
            size: bytes.length,
            ...(pages && { pages })
          };
        }
        // Text: UTF-8 without NUL bytes, and JSON that parses
        const text = bytes.toString('utf8');
        if (text.includes('\u0000') || text.includes('\uFFFD')) {
          throw unreadable(TEXT_WHAT[kind]);
        }
        if (kind === 'tokens') {
          try {
            JSON.parse(text);
          } catch (e) {
            throw unreadable(TEXT_WHAT.tokens);
          }
        }
        if (kind === 'svg') {
          try {
            await self.apos.attachment.checkFileContent(req, file, 'svg');
          } catch (e) {
            throw unreadable(TEXT_WHAT.svg);
          }
        }
        return {
          path: file.path,
          extension,
          name,
          mediaType: TEXT_TYPES[kind],
          size: (await fs.stat(file.path)).size
        };
      }

      // A format no provider takes, as a PNG, when uploadfs's image
      // processor can write one
      async function convert(format) {
        const sharp = self.getSharp();
        if (!sharp) {
          throw refuse('unreadable', `${name}: ${format} images can't be attached on this site`, { kind });
        }
        const converted = `${file.path}.png`;
        temp.push(converted);
        try {
          await sharp(file.path)
            .rotate()
            .resize({
              width: CONVERT_MAX_EDGE,
              height: CONVERT_MAX_EDGE,
              fit: 'inside',
              withoutEnlargement: true
            })
            .png()
            .toFile(converted);
        } catch (e) {
          throw refuse('unreadable', `${name} couldn't be read as an image`, { kind });
        }
        const size = (await fs.stat(converted)).size;
        checkSize(size);
        return {
          path: converted,
          extension: 'png',
          name: `${name.replace(/\.[^.]*$/, '')}.png`,
          size,
          convertedFrom: format
        };
      }

      function checkSize(size) {
        const limit = self.options.attachmentMaxBytes;
        if (size > limit) {
          throw refuse('size', `${name} is ${megabytes(size)}, over the ${megabytes(limit)} limit`, {
            size,
            limit
          });
        }
      }
    },

    /**
     * Stores a chat file and its record: the record first, as `writing`,
     * then the bytes, then `stored`, so no bytes are ever stored without a
     * record naming them. A write that fails removes what was written.
     *
     * @param {string} localPath
     * @param {string} extension As checked at intake.
     * @param {object} fields The record's own: `ownerId`, `chatId`,
     *   `requestId`, `kind`, `name`, and any others; `mediaType` from the
     *   image's real format when unset.
     * @returns {Promise<object>} The stored record.
     */
    async storeChatFile(localPath, extension, fields) {
      const prepared = await self.prepareChatFile(localPath, extension);
      const now = new Date();
      const record = {
        _id: self.apos.util.generateId(),
        schemaVersion: SCHEMA_VERSION,
        ...fields,
        status: 'writing',
        extension: prepared.extension,
        mediaType: fields.mediaType ||
          IMAGE_TYPES[prepared.extension] || 'application/octet-stream',
        size: fields.size ?? (await fs.stat(localPath)).size,
        ...(prepared.width && {
          width: prepared.width,
          height: prepared.height
        }),
        storage: prepared.storage,
        createdAt: now,
        updatedAt: now
      };
      await self.attachments.insertOne(record);
      try {
        await self.writeChatFile(localPath, record.storage);
      } catch (e) {
        await self.removeAttachmentRecord(record);
        throw e;
      }
      await self.attachments.updateOne({ _id: record._id }, {
        $set: {
          status: 'stored',
          updatedAt: new Date()
        }
      });
      return {
        ...record,
        status: 'stored'
      };
    },

    /**
     * The upload route's work: the request's one file, refused as it streams
     * in past `attachmentMaxBytes`, stored with `attach`. The upload's
     * temporary file is removed either way.
     *
     * @param {object} req
     * @param {string} chatId
     * @returns {Promise<object>} As `attach` returns it.
     */
    async uploadAttachment(req, chatId) {
      const limit = self.options.attachmentMaxBytes;
      const upload = multer({
        dest: os.tmpdir(),
        defParamCharset: 'utf8',
        limits: {
          fileSize: limit,
          files: 1
        }
      }).single('file');
      try {
        await promisify(upload)(req, req.res);
      } catch (e) {
        if (req.file) {
          await fs.rm(req.file.path, { force: true });
        }
        if (e.code === 'LIMIT_FILE_SIZE') {
          throw refuse('size', `the file is over the ${megabytes(limit)} limit`, { limit });
        }
        throw self.apos.error('invalid', 'the upload could not be read');
      }
      if (!req.file) {
        throw self.apos.error('invalid', 'the upload has no file');
      }
      try {
        return await self.attach(req, chatId, req.file);
      } finally {
        await fs.rm(req.file.path, { force: true });
      }
    },

    // The read route: a chat's file for its owner only, an image or its
    // `thumbnail` or `preview` size as itself, an SVG sandboxed, any other
    // file as a download, never a page of the site. Anything else is not
    // found
    async serveAttachment(req, res) {
      let found;
      try {
        if (!self.active) {
          throw self.apos.error('notfound');
        }
        const { _id, attachmentId } = req.params;
        found = await self.readAttachment(req, _id, attachmentId, {
          size: self.apos.launder.string(req.query.size)
        });
      } catch (e) {
        return res.status((e.name === 'forbidden') ? 403 : 404).send('not found');
      }
      const { record, data } = found;
      const image = Object.values(IMAGE_TYPES).includes(record.mediaType);
      const svg = record.mediaType === TEXT_TYPES.svg;
      res.set({
        'Content-Type': (image || svg) ? record.mediaType : 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
        ...(svg && {
          'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox'
        }),
        ...(!(image || svg) && {
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(record.name)}`
        })
      });
      return res.send(data);
    },

    /**
     * Deletes a file attached to a chat whose request was not sent: the
     * composer's × after the upload. Not found once a send claimed it.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {string} attachmentId
     */
    async detach(req, chatId, attachmentId) {
      const record = await self.attachments.findOne({
        _id: self.apos.launder.id(attachmentId),
        ownerId: self.getOwnerId(req),
        chatId: self.apos.launder.id(chatId),
        kind: 'attachment',
        requestId: null,
        status: { $ne: 'orphan' }
      });
      if (!record) {
        throw self.apos.error('notfound');
      }
      await self.removeAttachmentRecord(record);
    },

    /**
     * The bytes of a chat's file for its owner, `{ record, data }`; an
     * image's `thumbnail` or `preview` size when `size` names one. Anyone
     * else, and a file no longer stored, gets `notfound`.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {string} attachmentId
     * @param {object} [options]
     * @param {string} [options.size]
     * @returns {Promise<{ record: object, data: Buffer }>}
     */
    async readAttachment(req, chatId, attachmentId, { size = null } = {}) {
      const record = await self.attachments.findOne({
        _id: self.apos.launder.id(attachmentId),
        ownerId: self.getOwnerId(req),
        chatId: self.apos.launder.id(chatId),
        status: 'stored'
      });
      if (!record) {
        throw self.apos.error('notfound');
      }
      const known = [ 'thumbnail', 'preview' ].includes(size) ? size : null;
      return {
        record,
        data: await self.readRecordFile(record, { size: known })
      };
    },

    /**
     * Reads a chat file's record's bytes, as `readChatFile` does. Bytes no
     * longer in storage (a database copied without its files, a file removed
     * outside the assistant) mark the record `missing`, so the thread shows
     * the file as no longer available from then on, and throw `notfound`.
     *
     * @param {object} record
     * @param {object} [options] As `readChatFile` takes them.
     * @returns {Promise<Buffer>}
     */
    async readRecordFile(record, options) {
      try {
        return await self.readChatFile(record.storage, options);
      } catch (e) {
        if (e.name === 'notfound') {
          await self.attachments.updateOne({
            _id: record._id,
            status: 'stored'
          }, {
            $set: {
              status: 'missing',
              updatedAt: new Date()
            }
          });
        }
        throw e;
      }
    },

    /**
     * Claims the files a send names for its request, in the order given:
     * each the owner's, attached to this chat and not sent yet. Refused
     * with `invalid` past `attachmentMaxCount`, or when one is not
     * available. Returns the request's description of each file.
     *
     * @param {object} chat
     * @param {string} requestId
     * @param {string[]} ids
     * @returns {Promise<object[]>}
     */
    async claimAttachments(chat, requestId, ids) {
      if (!ids.length) {
        return [];
      }
      if (ids.length > self.options.attachmentMaxCount) {
        throw refuse('count', `a request takes up to ${self.options.attachmentMaxCount} files`, {
          limit: self.options.attachmentMaxCount
        });
      }
      const mine = {
        _id: { $in: ids },
        ownerId: chat.ownerId,
        chatId: chat._id,
        kind: 'attachment',
        status: 'stored'
      };
      await self.attachments.updateMany({
        ...mine,
        requestId: null
      }, {
        $set: {
          requestId,
          updatedAt: new Date()
        }
      });
      const claimed = await self.attachments.find({
        ...mine,
        requestId
      }).toArray();
      if (claimed.length !== ids.length) {
        await self.releaseAttachments(chat, requestId);
        throw self.apos.error('invalid', 'an attached file is no longer available', {
          reason: 'gone'
        });
      }
      const byId = new Map(claimed.map(record => [ record._id, record ]));
      return ids.map(_id => self.describeAttachment(byId.get(_id)));
    },

    // Gives back the files a request claimed and never stored
    async releaseAttachments(chat, requestId) {
      await self.attachments.updateMany({
        ownerId: chat.ownerId,
        chatId: chat._id,
        requestId
      }, {
        $set: {
          requestId: null,
          updatedAt: new Date()
        }
      });
    },

    // A file as a request describes it, which the model and the panel read
    describeAttachment(record) {
      return {
        _id: record._id,
        name: record.name,
        kind: TYPES[record.extension],
        mediaType: record.mediaType,
        size: record.size,
        ...(record.width && {
          width: record.width,
          height: record.height
        }),
        ...(record.pages && { pages: record.pages })
      };
    },

    // A file as the browser reads it on upload
    renderAttachment(record) {
      return self.describeAttachment(record);
    },

    /**
     * A request's attachments in its user message: a reference line per
     * file, then a part naming each image and PDF, its bytes built in at
     * call time (`addAttachmentBytes`). SVG and text files are read with
     * `read_attachment`.
     *
     * @param {object[]} attachments The request's descriptions.
     * @returns {object[]} Content parts.
     */
    getAttachmentParts(attachments) {
      if (!attachments?.length) {
        return [];
      }
      const lines = attachments.map(attachment => ({
        id: attachment._id,
        name: attachment.name,
        kind: KIND_NAMES[attachment.kind],
        size: megabytes(attachment.size),
        ...(attachment.width && { pixels: `${attachment.width}×${attachment.height}` }),
        ...(attachment.pages && { pages: attachment.pages })
      }));
      return [
        {
          type: 'text',
          text: `${ATTACHMENTS_INTRO} ${JSON.stringify(lines)}`
        },
        ...attachments
          .filter(attachment => [ 'image', 'pdf' ].includes(attachment.kind))
          .map(attachment => ({
            type: (attachment.kind === 'pdf') ? 'document' : 'image',
            attachmentId: attachment._id,
            name: attachment.name,
            mediaType: attachment.mediaType,
            ...(attachment.pages && { pages: attachment.pages })
          }))
      ];
    },

    /**
     * Messages as a call sends them: each part naming a chat file with its
     * bytes built in, an image at its `preview` size. A file that can't be
     * read becomes a line saying it is no longer available, and the call
     * goes on. Parts with bytes already are left as they are.
     *
     * @param {string} ownerId The chat's owner.
     * @param {object[]} messages
     * @returns {Promise<object[]>} Copies where a part changed.
     */
    async addAttachmentBytes(ownerId, messages) {
      const ids = new Set(messages
        .flatMap(message => (Array.isArray(message.content) ? message.content : []))
        .filter(isReference)
        .map(part => part.attachmentId));
      if (!ids.size) {
        return messages;
      }
      const records = new Map((await self.attachments.find({
        _id: { $in: [ ...ids ] },
        ownerId,
        status: 'stored'
      }).toArray()).map(record => [ record._id, record ]));
      const parts = new Map();
      for (const _id of ids) {
        parts.set(_id, await readPart(records.get(_id)));
      }
      return messages.map(message => {
        if (!Array.isArray(message.content) || !message.content.some(isReference)) {
          return message;
        }
        return {
          ...message,
          content: message.content.map(part => {
            if (!isReference(part)) {
              return part;
            }
            return parts.get(part.attachmentId) || {
              type: 'text',
              text: `[The ${part.type === 'document' ? 'document' : 'image'} "${part.name}" ` +
                `(attachment ${part.attachmentId}) is no longer available.]`
            };
          })
        };
      });

      async function readPart(record) {
        if (!record) {
          return null;
        }
        let data;
        try {
          data = (await self.readRecordFile(record, {
            size: (record.mediaType === 'application/pdf') ? null : 'preview'
          })).toString('base64');
        } catch (e) {
          if (e.name !== 'notfound') {
            self.logError('chat-file-read', 'A chat file could not be read.', {
              attachmentId: record._id,
              code: e.data?.code ?? null
            });
          }
          return null;
        }
        return (record.mediaType === 'application/pdf')
          ? {
            type: 'document',
            document: {
              data,
              mediaType: record.mediaType,
              name: record.name
            }
          }
          : {
            type: 'image',
            image: {
              data,
              mediaType: record.mediaType
            }
          };
      }
    },

    /**
     * A chat file a tool of the door's chat names, by id: one of the
     * chat's attached files that is stored. Throws `aiToolError` otherwise.
     *
     * @param {object} req The door's `req`.
     * @param {string} _id
     * @returns {Promise<object>} The record.
     */
    async findChatAttachment(req, _id) {
      const door = self.apos.harness.getDoor(req);
      const record = door?.chat && await self.attachments.findOne({
        _id: self.apos.launder.id(_id),
        ownerId: self.getOwnerId(req),
        chatId: door.chat,
        kind: 'attachment',
        requestId: { $ne: null },
        status: { $in: [ 'stored', 'missing' ] }
      });
      if (!record) {
        throw self.apos.error('aiToolError', 'No file attached to this chat has this id.');
      }
      if (record.status === 'missing') {
        throw self.apos.error('aiToolError', `The file "${record.name}" is no longer available.`, {
          reason: 'gone'
        });
      }
      return record;
    },

    // The file's kind: `image`, `svg`, `pdf`, `html`, `css`, `tokens` or
    // `markdown`
    getAttachmentKind(record) {
      return TYPES[record.extension];
    },

    /**
     * Removes a file and its record. A file that can't be removed keeps
     * its record as an orphan: its owner and storage only.
     *
     * @param {object} record
     * @returns {Promise<boolean>} Whether nothing is left.
     */
    async removeAttachmentRecord(record) {
      if (await self.removeChatFile(record.storage)) {
        await self.attachments.deleteOne({ _id: record._id });
        return true;
      }
      await self.attachments.updateOne({ _id: record._id }, {
        $set: {
          status: 'orphan',
          removeFailedAt: new Date(),
          updatedAt: new Date()
        },
        $unset: {
          chatId: 1,
          requestId: 1,
          name: 1,
          mediaType: 1
        }
      });
      return false;
    },

    // Every file of a chat, bytes before records, when the chat is deleted
    async deleteChatAttachments(chat) {
      const records = await self.attachments.find({
        ownerId: chat.ownerId,
        chatId: chat._id
      }).toArray();
      for (const record of records) {
        await self.removeAttachmentRecord(record);
      }
    },

    // The image processor uploadfs runs on, when it is sharp; `null` on a
    // site whose uploadfs falls back to imagemagick
    getSharp() {
      if (self.sharp === undefined) {
        try {
          self.sharp = require(require.resolve('sharp', {
            paths: [ path.dirname(require.resolve('uploadfs')) ]
          }));
        } catch (e) {
          self.sharp = null;
        }
      }
      return self.sharp;
    }
  };

  function refuse(reason, message, data = {}) {
    return self.apos.error('invalid', message, {
      reason,
      ...data
    });
  }
};

function isReference(part) {
  return [ 'image', 'document' ].includes(part?.type) && (typeof part.attachmentId === 'string') &&
    !part.image && !part.document;
}

// A PDF's pages as its page tree counts them, or its page objects; `null`
// when neither is readable (compressed object streams)
function countPdfPages(bytes) {
  const text = bytes.toString('latin1');
  let count = 0;
  for (const match of text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) {
    count = Math.max(count, Number(match[1] || match[2]));
  }
  if (!count) {
    count = [ ...text.matchAll(/\/Type\s*\/Page(?![a-zA-Z])/g) ].length;
  }
  return count || null;
}

function megabytes(size) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}
