// `generate_image`: images generated, or edited from a source, and shown to
// the editor as one ask over rounds. Each round's candidates are chat files
// of the call (`kind: 'candidate'`, its `callId`), held until the ask
// resolves: Use saves the picked one through the one save into Media, Try
// again and Refine generate the next round, Cancel ends it, and every
// candidate not kept is removed. Nothing reaches Media before Use.
//
// Sources and targets never mix: a source is always a chat file (an
// attachment, a Media image copied into the chat as the ask starts, or a
// candidate picked on Refine), and `replaces` is always a Media image,
// held for the whole ask. The round's state rides the ask.
//
// The request keeps what the thread shows of each ask in `imageAsks`:
// `{ callId, title, replaces, rounds, outcome }`, each answered round
// `{ action, notes, kept }` (`kept`, the candidate picked on Refine, which
// stays with the chat), and `outcome` `{ action, option, candidate,
// imageId, attachmentId }` once it resolves: `imageId`, the Media image the
// picked one became, or `attachmentId`, a picked image Media didn't take,
// which its notice's Retry saves again (see notices.js). Rounds and the
// outcome are noted as the answer is stored, so the thread shows them while
// the tool works; the tool adds only what its work produced.

const fs = require('node:fs/promises');
const { promisify } = require('node:util');

const PROMPT_MAX = 4000;
const TITLE_MAX = 200;
const ALT_MAX = 500;
const NOTES_MAX = 2000;
// What a provider edits from, by the extension uploadfs gives
const SOURCE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
};
const MODEL_ERRORS = {
  aiRetry: 'The image service kept failing.',
  aiRefusal: 'The image service declined the prompt.'
};

module.exports = (self) => {
  return {
    addImageTools() {
      if (!self.options.enabled) {
        return;
      }
      self.addAskKind('images', {
        accept: self.acceptImagesAnswer,
        answered(req, request, ask, {
          action, candidate = null, notes = null
        }) {
          if ((action === 'again') || (action === 'refine')) {
            return self.changeImageAsk(req, request._id, ask.callId, each => ({
              ...each,
              rounds: [ ...each.rounds, (action === 'again')
                ? { action }
                : {
                  action,
                  notes,
                  kept: candidate
                } ]
            }));
          }
          const option = ask.payload.candidates
            .findIndex(each => each._id === candidate) + 1;
          return self.changeImageAsk(req, request._id, ask.callId, each => ({
            ...each,
            outcome: {
              action,
              ...(candidate && {
                option,
                candidate
              })
            }
          }));
        },
        discard(req, request, ask, status) {
          return self.endImageAsk(req, request._id, ask.callId, { action: status });
        }
      });
      self.addNoticeAction('saveToMedia', { run: self.retryKeptImage });
      self.apos.ai.addTool({
        name: 'generate_image',
        label: 'apostrophe:aiToolGenerateImage',
        description: 'Generate images and show them to the user, who picks one and uses ' +
          'it, asks for new ones, refines them with notes, or cancels. Only the image ' +
          'they use is saved to Media. To edit an image, name it as the source: ' +
          '"fromImage" for a Media image, "fromAttachment" for an image attached to this ' +
          'chat; the prompt then describes the change. Set "replaces" to a Media image ' +
          'when the user asks to edit or fix that image itself: the image used becomes ' +
          'its new file, with its title and alt kept, on every page that uses it. ' +
          'Without "replaces" a new Media image is made: for "a version of" or "based ' +
          'on" an image. Ask the user when unclear.',
        kind: 'action',
        // The image saved to Media, else what was asked for
        summary: ({ prompt }, output) => (output?.written?.length
          ? output.written.map(item => ({
            _id: item._id,
            title: item.title,
            action: 'savedToMedia'
          }))
          : [
            output?.answered
              ? {
                text: 'apostrophe:aiStepGeneratedImages',
                title: prompt
              }
              : { text: prompt }
          ]),
        tags: [ 'assistant' ],
        input: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              minLength: 1,
              maxLength: PROMPT_MAX,
              description: 'What to generate, in full: subject, style, composition, mood; ' +
                'with a source, the change to make'
            },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: TITLE_MAX,
              description: 'The new image\'s title in Media'
            },
            alt: {
              type: 'string',
              minLength: 1,
              maxLength: ALT_MAX,
              description: 'The new image\'s alt text: what it shows'
            },
            aspect: {
              type: 'string',
              enum: [ 'square', 'portrait', 'landscape' ],
              description: 'The shape; omit to let the prompt decide'
            },
            fromImage: {
              type: 'string',
              minLength: 1,
              description: 'A Media image\'s _id to edit from'
            },
            fromAttachment: {
              type: 'string',
              minLength: 1,
              description: 'An attachment id, of an image attached to this chat, to edit from'
            },
            replaces: {
              type: 'string',
              minLength: 1,
              description: 'A Media image\'s _id: the image used becomes its new file'
            }
          },
          required: [ 'prompt', 'title', 'alt' ],
          additionalProperties: false
        },
        handler: generateImage
      });

      async function generateImage(req, args) {
        const { _context } = args;
        const callId = _context.call.id;
        const { requestId } = self.apos.aposHarness.getDoor(req);
        if (_context.input === undefined) {
          return start();
        }
        const {
          action, candidate, notes, state
        } = _context.input;
        const option = state.candidates.findIndex(each => each._id === candidate) + 1;
        try {
          if (action === 'cancel') {
            await self.endImageAsk(req, requestId, callId);
            return {
              answered: true,
              used: false,
              note: 'The user cancelled: nothing was saved to Media. Generate again only ' +
                'when they ask.'
            };
          }
          if (action === 'use') {
            return await use(state, candidate, option);
          }
          const rest = state.candidates
            .map(each => each._id)
            .filter(_id => _id !== candidate);
          await removeCandidates(rest);
          if (action === 'again') {
            return await nextRound(state);
          }
          // Refine: from the picked image, or from the original with every
          // note so far
          if (candidate) {
            await self.attachments.updateOne({ _id: candidate }, {
              $set: {
                kept: true,
                updatedAt: new Date()
              }
            });
          }
          const allNotes = [ ...state.notes, notes ];
          return await nextRound({
            ...state,
            notes: allNotes,
            source: candidate || state.original,
            prompt: candidate
              ? `Change this image as follows, keeping everything else as it is: ${notes}`
              : `${args.prompt}\n\nChanges the user asked for: ${allNotes.join(' ')}`
          });
        } catch (e) {
          if (e.name !== 'aiInput') {
            await self.endImageAsk(req, requestId, callId, { action: 'failed' });
          }
          throw e;
        }

        // The ask's first round: the rights and the source checked, a Media
        // image copied into the chat
        async function start() {
          if (args.fromImage && args.fromAttachment) {
            throw self.apos.error('aiToolError', 'Name one source, "fromImage" or ' +
              '"fromAttachment".');
          }
          const target = args.replaces && await self.findMediaImage(req, args.replaces);
          self.checkMediaSave(req, target, 'no image was generated');
          let original = null;
          if (args.fromAttachment) {
            const record = await self.findChatAttachment(req, args.fromAttachment);
            if (!SOURCE_TYPES[record.extension]) {
              throw self.apos.error('aiToolError', `"${record.name}" can't be edited: only ` +
                'JPEG, PNG, GIF and WebP images can.');
            }
            original = record._id;
          }
          await self.noteImageAsk(req, {
            callId,
            title: args.title,
            replaces: target
              ? {
                _id: target.doc._id,
                title: target.doc.title
              }
              : null,
            rounds: [],
            outcome: null
          });
          try {
            if (args.fromImage) {
              original = (await copyMediaImage(args.fromImage))._id;
            }
            return await nextRound({
              round: 0,
              prompt: args.prompt,
              source: original,
              original,
              notes: [],
              replaces: target
                ? {
                  _id: target.doc._id,
                  title: target.doc.title
                }
                : null
            });
          } catch (e) {
            if (e.name !== 'aiInput') {
              await self.endImageAsk(req, requestId, callId, { action: 'failed' });
            }
            throw e;
          }
        }

        // Generates a round's candidates from its prompt and source, holds
        // them and asks
        async function nextRound(state) {
          const source = state.source && await self.attachments.findOne({
            _id: state.source,
            ownerId: self.getOwnerId(req),
            status: 'stored'
          });
          if (state.source && !source) {
            throw self.apos.error('aiToolError', 'The image to edit from is no longer available.');
          }
          let generated;
          try {
            generated = await self.apos.ai.generateImage(req, state.prompt, {
              count: self.options.genImageCount,
              ...(args.aspect && { aspect: args.aspect }),
              ...(source && {
                images: [ {
                  data: (await self.readRecordFile(source, { size: 'preview' }))
                    .toString('base64'),
                  mediaType: source.mediaType
                } ]
              }),
              ...(_context.signal && { signal: _context.signal }),
              usageMetadata: { purpose: 'generate_image' }
            });
          } catch (e) {
            await self.addAgentUsage(req, [ e.aposAiPartial?.usage ]);
            const known = MODEL_ERRORS[e.name];
            if (known || (e.name === 'invalid')) {
              throw self.apos.error('aiToolError', known ||
                `The image could not be generated: ${e.message}`);
            }
            if (e.name === 'notfound') {
              throw self.apos.error('aiToolError', 'The image to edit from is no longer available.');
            }
            throw e;
          }
          await self.addAgentUsage(req, [ generated.usage ]);
          const round = state.round + 1;
          const candidates = [];
          try {
            for (const [ index, image ] of generated.images.entries()) {
              candidates.push(await holdCandidate(image, `${round}-${index + 1}`));
            }
          } catch (e) {
            await removeCandidates(candidates.map(each => each._id));
            throw e;
          }
          throw self.apos.error('aiInput', 'waiting for the user to pick an image', {
            kind: 'images',
            title: args.title,
            ...state,
            round,
            candidates: candidates.map(({
              _id, width, height
            }) => ({
              _id,
              width,
              height
            }))
          });
        }

        // Use: the picked candidate becomes a chat attachment carrying its
        // target, every other one goes, and the one save runs. A save that
        // fails keeps the image, to save again
        async function use(state, candidate, option) {
          const ext = (await self.attachments.findOne({ _id: candidate })).extension;
          await self.attachments.updateOne({ _id: candidate }, {
            $set: {
              kind: 'attachment',
              name: `${self.apos.util.slugify(args.title) || 'image'}.${ext}`,
              replaces: state.replaces?._id || null,
              updatedAt: new Date()
            },
            $unset: { callId: 1 }
          });
          await self.endImageAsk(req, requestId, callId);
          const record = await self.attachments.findOne({ _id: candidate });
          const { result, failure } = await self.saveKeptImage(req, record, {
            title: args.title,
            alt: args.alt,
            callId,
            ask: {
              requestId,
              callId
            }
          });
          if (!failure) {
            return {
              answered: true,
              used: true,
              option,
              ...result
            };
          }
          return {
            answered: true,
            used: true,
            option,
            saved: false,
            error: failure.message,
            attachment: record._id,
            note: 'The picked image is kept in this chat as an attachment; ' +
              'save_attachment_to_media saves it when the user asks.'
          };
        }

        async function holdCandidate(image, label) {
          const { uploadfs } = self.apos.attachment;
          const extension = SOURCE_TYPES[image.type] ? image.type : 'png';
          const temp = `${uploadfs.getTempPath()}/${self.apos.util.generateId()}.${extension}`;
          await fs.writeFile(temp, Buffer.from(image.data, 'base64'));
          try {
            return await self.storeChatFile(temp, extension, {
              ...heldBy(),
              name: `${self.apos.util.slugify(args.title) || 'image'}-${label}.${extension}`
            });
          } catch (e) {
            if (e.name === 'invalid') {
              throw self.apos.error('aiToolError', 'The image service sent an image that ' +
                'could not be read.');
            }
            throw e;
          } finally {
            await fs.rm(temp, { force: true });
          }
        }

        // A Media image as a chat file of the ask, the source of its rounds
        async function copyMediaImage(_id) {
          const { doc } = await self.findMediaImage(req, _id);
          const { attachment } = doc;
          const extension = attachment &&
            self.apos.attachment.resolveExtension(attachment.extension);
          if (!SOURCE_TYPES[extension]) {
            throw self.apos.error('aiToolError', `"${doc.title}" can't be edited: only JPEG, ` +
              'PNG, GIF and WebP images can.');
          }
          const { uploadfs } = self.apos.attachment;
          const temp = `${uploadfs.getTempPath()}/${self.apos.util.generateId()}.${extension}`;
          try {
            try {
              const path = self.apos.attachment.url(attachment, {
                uploadfsPath: true,
                size: 'original',
                crop: false
              });
              await promisify(uploadfs.copyOut.bind(uploadfs))(path, temp);
            } catch (e) {
              throw self.apos.error('aiToolError', `The file of "${doc.title}" could not be read.`);
            }
            return await self.storeChatFile(temp, extension, {
              ...heldBy(),
              name: `${self.apos.util.slugify(doc.title) || 'image'}.${extension}`
            });
          } finally {
            await fs.rm(temp, { force: true });
          }
        }

        // The fields of a file the ask holds
        function heldBy() {
          const door = self.apos.aposHarness.getDoor(req);
          return {
            ownerId: self.getOwnerId(req),
            chatId: door.chat,
            requestId: door.requestId,
            kind: 'candidate',
            callId
          };
        }

        async function removeCandidates(ids) {
          for (const record of await self.attachments.find({
            _id: { $in: ids },
            kind: 'candidate'
          }).toArray()) {
            await self.removeAttachmentRecord(record);
          }
        }
      }

    },

    /**
     * Saves an image the chat keeps for Media, the image picked on Use,
     * through the one save. Saved, the chat's copy goes: Media holds it.
     * Refused, it stays, and an error notice says why, with Retry
     * (`saveToMedia`).
     *
     * @param {object} req The door's `req`.
     * @param {object} record The kept image's record.
     * @param {object} [options] `title`, `alt` and `callId`, as the one
     *   save takes them, and `ask`, `{ requestId, callId }`, the image ask
     *   the image was picked in, whose outcome notes the Media image it
     *   became, or the kept image while it isn't one.
     * @returns {Promise<{ result?: object, failure?: object }>} The save's
     *   result, or `{ reason, message }`.
     */
    async saveKeptImage(req, record, options = {}) {
      let result;
      let failure;
      try {
        result = await self.saveAttachmentToMedia(req, record, options);
        failure = result.refused?.[0];
      } catch (e) {
        if (e.name !== 'aiToolError') {
          throw e;
        }
        failure = {
          reason: e.data?.reason || 'invalid',
          message: e.message,
          ...(e.data?.title && { title: e.data.title })
        };
      }
      const saved = !failure && result.written[0];
      if (options.ask) {
        const { requestId, callId } = options.ask;
        await self.changeImageAsk(req, requestId, callId, ask => ({
          ...ask,
          outcome: {
            ...ask.outcome,
            imageId: saved ? saved._id : null,
            attachmentId: saved ? null : record._id
          }
        }));
      }
      if (!failure) {
        await self.removeAttachmentRecord(record);
        return { result };
      }
      const named = Boolean(failure.title);
      const locked = (failure.reason === 'locked') && (failure.lockedBy
        ? 'apostrophe:assistantSaveLocked'
        : 'apostrophe:assistantSaveLockedSelf');
      await self.addNotice(req, {
        callId: options.callId,
        tone: 'error',
        title: 'apostrophe:assistantNotSavedToMedia',
        text: locked || {
          forbidden: named
            ? 'apostrophe:assistantSaveForbiddenImage'
            : 'apostrophe:assistantSaveForbidden',
          gone: 'apostrophe:assistantSaveGone',
          changed: 'apostrophe:assistantSaveChanged'
        }[failure.reason] || 'apostrophe:assistantSaveRefused',
        interpolate: {
          title: failure.title || '',
          name: failure.lockedBy || ''
        },
        action: (failure.reason === 'gone')
          ? null
          : {
            name: 'saveToMedia',
            label: 'apostrophe:assistantRetry',
            data: {
              attachmentId: record._id,
              ask: options.ask || null
            }
          }
      });
      return { failure };
    },

    // The `saveToMedia` action, Retry on a save that failed: the same kept
    // image saved again, into the same image, as the model's own
    // `save_attachment_to_media` call would
    async retryKeptImage(req, notice) {
      const callId = `retry-${self.apos.util.generateId()}`;
      const { attachmentId, ask } = notice.action.data;
      const record = await self.attachments.findOne({
        _id: attachmentId,
        ownerId: self.getOwnerId(req),
        kind: 'attachment',
        status: 'stored'
      });
      const call = {
        type: 'toolCall',
        id: callId,
        name: 'save_attachment_to_media',
        input: { attachment: attachmentId }
      };
      let outcome;
      if (record) {
        const { result, failure } = await self.saveKeptImage(req, record, {
          callId,
          ask
        });
        outcome = failure
          ? { error: failure.message }
          : { output: result };
      } else {
        await self.addNotice(req, {
          callId,
          tone: 'error',
          title: 'apostrophe:assistantNotSavedToMedia',
          text: 'apostrophe:assistantSaveGone'
        });
        outcome = { error: 'The picked image is no longer available.' };
      }
      return [
        {
          role: 'assistant',
          content: [ call ]
        },
        {
          role: 'tool',
          content: [ {
            type: 'toolResult',
            toolCallId: callId,
            ...outcome
          } ]
        }
      ];
    },

    /**
     * Turns the editor's answer to an `images` ask into the tool's input:
     * `{ action: 'use', candidate }`, `{ action: 'again' }`, `{ action:
     * 'refine', notes, candidate? }` or `{ action: 'cancel' }`, a candidate
     * being one of the round's. Anything else is `invalid`, and the ask
     * keeps waiting.
     *
     * @param {object} req
     * @param {object} ask The stored ask.
     * @param {object} answer
     * @returns {object} The answer with the round's state.
     */
    acceptImagesAnswer(req, ask, answer) {
      const state = ask.payload;
      const action = answer?.action;
      const candidate = (answer?.candidate === undefined) ? null : answer.candidate;
      if (candidate !== null && !state.candidates.some(each => each._id === candidate)) {
        throw self.apos.error('invalid', 'no such image in this round');
      }
      if (action === 'use') {
        if (!candidate) {
          throw self.apos.error('invalid', 'pick an image to use');
        }
        return {
          action,
          candidate,
          state
        };
      }
      if ((action === 'again') || (action === 'cancel')) {
        return {
          action,
          state
        };
      }
      if (action === 'refine') {
        const notes = self.apos.launder.string(answer.notes).trim().slice(0, NOTES_MAX);
        if (!notes) {
          throw self.apos.error('invalid', 'refining needs notes');
        }
        return {
          action,
          notes,
          ...(candidate && { candidate }),
          state
        };
      }
      throw self.apos.error('invalid', 'answer with use, again, refine or cancel');
    },

    /**
     * Refused as a tool error, saying `what` didn't happen, when the user
     * may not upload images, or may not change the Media image `target`
     * (`{ doc, draftReq }`) or, with none, create one.
     *
     * @param {object} req The door's `req`.
     * @param {object|null} target
     * @param {string} what
     */
    checkMediaSave(req, target, what) {
      const allowed = self.apos.permission.can(req, 'upload-attachment') && (target
        ? self.apos.ai.can(target.draftReq, 'edit', target.doc)
        : self.apos.ai.can(req.clone({ mode: 'draft' }), 'create', '@apostrophecms/image', 'draft'));
      if (!allowed) {
        throw self.apos.error('aiToolError', target
          ? `The user may not change the Media image "${target.doc.title}", so ${what}.`
          : `The user may not upload images, so ${what}.`, {
          reason: 'forbidden',
          ...(target && { title: target.doc.title })
        });
      }
    },

    /**
     * Ends an image ask: every file it holds and didn't keep is removed,
     * and its outcome, if given, is noted on the request. An answered ask's
     * outcome is noted as the answer is stored.
     *
     * @param {object} req The door's `req`, or a request of the owner.
     * @param {string} requestId
     * @param {string} callId
     * @param {object} [outcome] `{ action }`, `action` one of `failed`,
     *   `skipped`, `stopped`.
     */
    async endImageAsk(req, requestId, callId, outcome = null) {
      const ownerId = self.getOwnerId(req);
      for (const record of await self.attachments.find({
        ownerId,
        requestId,
        callId,
        kind: 'candidate',
        kept: { $ne: true }
      }).toArray()) {
        await self.removeAttachmentRecord(record);
      }
      if (outcome) {
        await self.changeImageAsk(req, requestId, callId, ask => ({
          ...ask,
          outcome
        }));
      }
    },

    // Changes an image ask the request notes, whole: only its answers and
    // its own call change it, one step at a time
    async changeImageAsk(req, requestId, callId, change) {
      const ownerId = self.getOwnerId(req);
      const request = await self.requests.findOne({
        _id: requestId,
        ownerId
      }, { projection: { imageAsks: 1 } });
      if (!request?.imageAsks?.some(ask => ask.callId === callId)) {
        return;
      }
      await self.requests.updateOne({
        _id: requestId,
        ownerId
      }, {
        $set: {
          imageAsks: request.imageAsks
            .map(ask => ((ask.callId === callId) ? change(ask) : ask))
        }
      });
    },

    // Notes a new image ask on the door's request, for the thread
    async noteImageAsk(req, ask) {
      const door = self.apos.aposHarness.getDoor(req);
      await self.requests.updateOne({
        _id: door.requestId,
        ownerId: self.getOwnerId(req)
      }, {
        $push: { imageAsks: ask }
      });
    }
  };
};
