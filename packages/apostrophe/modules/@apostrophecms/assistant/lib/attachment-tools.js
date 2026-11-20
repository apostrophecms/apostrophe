// The tools on files attached to a chat: `read_attachment` reads one as
// text, and `save_attachment_to_media` saves an attached image to Media
// unchanged. Both name a file by its attachment id, from the reference
// line of the message that attached it, and are tagged `assistant`, so
// only the assistant's door selects them.

const fs = require('node:fs/promises');
const {
  PART_CHARS, trimHtml, trimSvg, trimCss, searchCss, readTokens, getPart, getTokensPart,
  measureColors
} = require('./attachment-reads');

// A stylesheet larger than this, trimmed, is searched instead of read
const CSS_WHOLE_CHARS = PART_CHARS;
const SEARCH_MAX = 200;
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
          'scripts, path data, data URLs and comments; CSS whole, or searched with ' +
          '"search" when too large; token files as a list of tokens; Markdown as text. ' +
          'Long text comes in parts: read the next with "part". For an image, its size ' +
          'and main colors; PDFs and images are already in the message that attached them.',
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
            },
            search: {
              type: 'string',
              minLength: 1,
              maxLength: SEARCH_MAX,
              description: 'For a stylesheet: the rules that mention this, such as a ' +
                'selector, a class or a property'
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
          'user asks for it. It becomes a new Media image the site can use.',
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
            }
          },
          required: [ 'attachment' ],
          additionalProperties: false
        },
        handler: saveToMedia
      });

      async function readAttachment(req, {
        attachment, part = 1, search
      }) {
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
          const css = trimCss(text);
          if (search) {
            return {
              ...head,
              search,
              ...searchCss(css, search)
            };
          }
          if (css.length > CSS_WHOLE_CHARS) {
            return {
              ...head,
              length: css.length,
              note: 'Too large to read whole: call again with "search" for the rules ' +
                'that mention a selector, class or property.'
            };
          }
          return {
            ...head,
            content: css
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
        attachment, title, alt
      }) {
        const record = await self.findChatAttachment(req, attachment);
        const kind = self.getAttachmentKind(record);
        if (![ 'image', 'svg' ].includes(kind)) {
          throw self.apos.error('aiToolError', `Only images can be saved to Media; "${
            record.name}" is ${KIND_NAMES[kind]}.`);
        }
        return self.saveAttachmentToMedia(req, record, {
          title,
          alt
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
     * Saves a chat file to Media as a new image, through the harness's
     * create path: a site attachment made from the file as stored, then the
     * image, so the save is logged and reverted like any other. Refused as a
     * tool error when the user may not upload or create images, or when the
     * file is gone.
     *
     * @param {object} req The door's `req`.
     * @param {object} record The chat file's record.
     * @param {object} [options]
     * @param {string} [options.title] The file name without its extension
     *   when unset.
     * @param {string} [options.alt]
     * @returns {Promise<object>} The harness's write result.
     */
    async saveAttachmentToMedia(req, record, { title, alt } = {}) {
      const type = '@apostrophecms/image';
      if (!self.apos.permission.can(req, 'upload-attachment') ||
        !self.apos.ai.can(req.clone({ mode: 'draft' }), 'create', type, 'draft')) {
        throw self.apos.error('aiToolError', 'The user may not upload images, so nothing ' +
          'was saved.');
      }
      const base = record.name.replace(/\.[^.]*$/, '') || 'image';
      const { uploadfs } = self.apos.attachment;
      const temp = `${uploadfs.getTempPath()}/${self.apos.util.generateId()}.${record.extension}`;
      let attachment;
      try {
        let data;
        try {
          data = await self.readChatFile(record.storage);
        } catch (e) {
          if (e.name === 'notfound') {
            throw self.apos.error('aiToolError', `The file "${record.name}" is no longer available.`);
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
          throw self.apos.error('aiToolError', `Media refused the file: ${e.message}`);
        }
      } finally {
        await fs.rm(temp, { force: true });
      }
      return self.apos.harness.createPiece(req, {
        type,
        title: title || base,
        values: {
          attachment: { _id: attachment._id },
          ...(alt && { alt })
        }
      });
    }
  };
};
