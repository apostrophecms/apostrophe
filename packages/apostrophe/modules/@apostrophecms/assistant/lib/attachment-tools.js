// The tools on files attached to a chat: `read_attachment` reads one as
// text, and `save_attachment_to_media` saves an attached image to Media
// unchanged. Both name a file by its attachment id, from the reference
// line of the message that attached it, and are tagged `assistant`, so
// only the assistant's door selects them.

const fs = require('node:fs/promises');
const {
  PART_CHARS, trimHtml, trimSvg, trimCss, readTokens, getPart, getTokensPart,
  measureColors
} = require('./attachment-reads');

const ALT_MAX = 500;
const TITLE_MAX = 200;
const KIND_NAMES = {
  image: 'an image',
  svg: 'an SVG',
  pdf: 'a PDF',
  html: 'an HTML file',
  css: 'a stylesheet',
  tokens: 'a JSON file',
  markdown: 'a Markdown file'
};

module.exports = (self) => {
  return {
    addAttachmentTools() {
      if (!self.options.enabled) {
        return;
      }
      const attachment = {
        type: 'string',
        minLength: 1,
        description: 'The attachment id, from the message that attached the file'
      };
      self.apos.ai.addTool({
        name: 'read_attachment',
        label: 'apostrophe:aiToolReadAttachment',
        description: 'Read a file attached to this chat. HTML and SVG come trimmed of ' +
          'scripts, path data, data URLs and comments; CSS trimmed of comments; token ' +
          'files as a list of tokens; Markdown as text. A long file comes in parts: read ' +
          'the next with "part". For an image, its size and main colors; PDFs and images ' +
          'are already in the message that attached them.',
        kind: 'query',
        tags: [ 'assistant' ],
        input: {
          type: 'object',
          properties: {
            attachment,
            part: {
              type: 'integer',
              minimum: 1,
              description: 'Which part of a long file, from 1'
            }
          },
          required: [ 'attachment' ],
          additionalProperties: false
        },
        maxResultChars: PART_CHARS + 10000,
        handler: readAttachment
      });
      self.apos.ai.addTool({
        name: 'save_attachment_to_media',
        label: 'apostrophe:aiToolSaveAttachmentToMedia',
        description: 'Save an image attached to this chat to Media, unchanged, when the ' +
          'user asks for it. It becomes a new Media image the site can use, or, with ' +
          '"replaces", the new file of that Media image, which keeps its title and alt ' +
          'and changes on every page that uses it.',
        kind: 'action',
        tags: [ 'assistant' ],
        input: {
          type: 'object',
          properties: {
            attachment,
            title: {
              type: 'string',
              minLength: 1,
              maxLength: TITLE_MAX,
              description: 'The image\'s title in Media; the file name when omitted'
            },
            alt: {
              type: 'string',
              minLength: 1,
              maxLength: ALT_MAX,
              description: 'Alt text: what the image shows'
            },
            replaces: {
              type: 'string',
              minLength: 1,
              description: 'A Media image\'s _id: save the file into that image in place ' +
                'of a new one. Only when the user asks to replace or update it'
            }
          },
          required: [ 'attachment' ],
          additionalProperties: false
        },
        handler: saveToMedia
      });

      async function readAttachment(req, { attachment, part = 1 }) {
        const record = await self.findChatAttachment(req, attachment);
        const kind = self.getAttachmentKind(record);
        const head = {
          _id: record._id,
          name: record.name,
          kind,
          size: record.size
        };
        if (kind === 'pdf') {
          throw self.apos.error('aiToolError', 'A PDF is read as a document in the message ' +
            'that attached it; it has no text form here.');
        }
        if (kind === 'image') {
          return {
            ...head,
            width: record.width,
            height: record.height,
            colors: await getColors(record),
            note: 'The image itself is in the message that attached it; describe_images ' +
              'looks at it again.'
          };
        }
        const text = (await readFile(record)).toString('utf8');
        if (kind === 'css') {
          return {
            ...head,
            ...pageOf(getPart(trimCss(text), part, [ '}', ';', ' ' ]))
          };
        }
        if (kind === 'tokens') {
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            throw self.apos.error('aiToolError', 'The file is not valid JSON.');
          }
          const tokens = readTokens(parsed);
          if (tokens) {
            return {
              ...head,
              format: tokens.format,
              count: tokens.tokens.length,
              ...pageOf(getTokensPart(tokens.tokens, part))
            };
          }
          return {
            ...head,
            format: 'json',
            ...pageOf(getPart(JSON.stringify(parsed), part))
          };
        }
        const content = (kind === 'html')
          ? trimHtml(text)
          : (kind === 'svg') ? trimSvg(text) : text;
        return {
          ...head,
          ...pageOf(getPart(content, part))
        };

        function pageOf(found) {
          if (!found) {
            throw self.apos.error('aiToolError', `The file has no part ${part}.`);
          }
          return found;
        }
      }

      // The main colors of an attached image, or "not measured" where
      // uploadfs's image processor can't measure them
      async function getColors(record) {
        const sharp = self.getSharp();
        if (!sharp) {
          return 'not measured';
        }
        const data = await readFile(record, { size: 'preview' });
        try {
          return await measureColors(sharp, data);
        } catch (e) {
          return 'not measured';
        }
      }

      async function saveToMedia(req, {
        attachment, title, alt, replaces, _context
      }) {
        const record = await self.findChatAttachment(req, attachment);
        const kind = self.getAttachmentKind(record);
        if (![ 'image', 'svg' ].includes(kind)) {
          throw self.apos.error('aiToolError', `Only images can be saved to Media; "${
            record.name}" is ${KIND_NAMES[kind]}.`);
        }
        return self.saveAttachmentToMedia(req, record, {
          title,
          alt,
          ...(replaces && { replaces }),
          callId: _context?.call?.id || null
        });
      }

      async function readFile(record, options) {
        try {
          return await self.readChatFile(record.storage, options);
        } catch (e) {
          if (e.name === 'notfound') {
            throw self.apos.error('aiToolError', `The file "${record.name}" is no longer available.`);
          }
          throw e;
        }
      }
    },

    /**
     * The one save of a chat file into Media, through the harness's write
     * path, so it is logged and reverted like any other: a site attachment
     * made from the file as stored, then a new image, or, with `replaces`,
     * that image's file swapped under its lock, as Media's own Replace does;
     * its title and alt stay, and the file is named after it. Refused as a
     * tool error, with `data.reason` (`forbidden`, `gone` or `invalid`),
     * when the user may not upload images or edit the one replaced, when the
     * file is gone, or when Media refuses it. A save that lands posts its
     * notice.
     *
     * @param {object} req The door's `req`.
     * @param {object} record The chat file's record.
     * @param {object} [options]
     * @param {string} [options.title] A new image's title; the file name
     *   without its extension when unset.
     * @param {string} [options.alt] A new image's alt text.
     * @param {string|null} [options.replaces] The Media image to update;
     *   the record's own when unset.
     * @param {string} [options.callId] The tool call that saves.
     * @returns {Promise<object>} The harness's write result, `media` the
     *   sentence saying where the image is when it landed.
     */
    async saveAttachmentToMedia(req, record, {
      title, alt, replaces = record.replaces || null, callId = null
    } = {}) {
      const target = replaces && await self.findMediaImage(req, replaces);
      self.checkMediaSave(req, target, 'nothing was saved');
      // A replaced image keeps its own name
      const base = (target
        ? self.apos.util.slugify(target.doc.title)
        : record.name.replace(/\.[^.]*$/, '')) || 'image';
      const { uploadfs } = self.apos.attachment;
      const temp = `${uploadfs.getTempPath()}/${self.apos.util.generateId()}.${record.extension}`;
      let attachment;
      try {
        let data;
        try {
          data = await self.readChatFile(record.storage);
        } catch (e) {
          if (e.name === 'notfound') {
            throw self.apos.error('aiToolError', `The file "${record.name}" is no longer ` +
              'available.', { reason: 'gone' });
          }
          throw e;
        }
        await fs.writeFile(temp, data);
        try {
          attachment = await self.apos.attachment.insert(req, {
            name: `${base}.${record.extension}`,
            path: temp
          });
        } catch (e) {
          if (e.name !== 'invalid') {
            throw e;
          }
          throw self.apos.error('aiToolError', `Media refused the file: ${e.message}`, {
            reason: 'invalid'
          });
        }
      } finally {
        await fs.rm(temp, { force: true });
      }
      const result = target
        ? await self.apos.harness.updateDocument(req, {
          targets: [ {
            _id: target.doc._id,
            values: { attachment: { _id: attachment._id } }
          } ]
        })
        : await self.apos.harness.createPiece(req, {
          type: '@apostrophecms/image',
          title: title || base,
          values: {
            attachment: { _id: attachment._id },
            ...(alt && { alt })
          }
        });
      const saved = result.written[0];
      if (!saved) {
        return result;
      }
      await self.addNotice(req, {
        callId,
        tone: 'success',
        title: target ? 'apostrophe:assistantUpdatedInMedia' : 'apostrophe:assistantSavedToMedia',
        text: target
          ? 'apostrophe:assistantUpdatedInMediaText'
          : 'apostrophe:assistantSavedToMediaText',
        interpolate: { title: saved.title },
        link: {
          _id: saved._id,
          label: 'apostrophe:assistantOpenInMedia'
        }
      });
      return {
        ...result,
        media: target
          ? `"${saved.title}" was updated in the Media library; every page that uses it ` +
            'shows the new file.'
          : `"${saved.title}" is in the Media library, ready to place on a page.`
      };
    },

    /**
     * A Media image a tool names by id, `{ doc, draftReq }`, its draft in
     * its own locale. Throws `aiToolError` when it is not one the user can
     * read.
     *
     * @param {object} req The door's `req`.
     * @param {string} _id
     * @returns {Promise<object>}
     */
    async findMediaImage(req, _id) {
      let found;
      try {
        found = await self.apos.harness.findReadable(req, _id);
      } catch (e) {
        if (e.name !== 'aiToolError') {
          throw e;
        }
      }
      if (found?.doc.type !== '@apostrophecms/image') {
        throw self.apos.error('aiToolError', 'No Media image the user can see has this id.');
      }
      return found;
    }
  };
};
