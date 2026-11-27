// The one write path every mutating harness tool goes through.

// Errors a target is refused with; anything else is a bug and stops the call
const REFUSALS = new Set([ 'notfound', 'forbidden', 'locked', 'invalid', 'conflict' ]);

const LIVE_NOTICE = 'The change is live on the site now.';
const DRAFT_NOTICE = 'The change is saved in the draft; it goes live once the draft is ' +
  'published.';
const MIXED_NOTICE = 'Changes with "published": true are live on the site now; the others ' +
  'are saved in drafts and go live once published.';
const PUBLISHED_NOTICE = 'The published documents are live on the site now.';
// A publish refused because the draft was saved since the door read it: the
// user decides, whatever the door
const PUBLISH_CHANGED = 'The document was saved by someone else since you last read it, ' +
  'so it was not published: publishing now would make their changes live too. Tell the ' +
  'user what changed (get_changes since the publication) and publish only if they ask; ' +
  'read it again with get_document first.';
const PUBLISH_FORBIDDEN = 'The user may not publish this document.';

module.exports = (self) => {
  return {
    /**
     * Writes patches to documents, one document at a time: in draft mode,
     * with the AI permission check (`apos.ai.can`), a lock held only while
     * the document is written and the type's own patch, flagged `_lossless`
     * so nothing the patch supplies is silently dropped and marked as AI's
     * for Document Versions, unless the door's request reverts. A door's
     * writes lock with its lock id in its family's slot, a plain call's with
     * the engine's call id. With a door context the save carries the marker
     * the change log records (`aposSaveMarker`), and the browser tab of the
     * door's family hears of the save as it starts and once it settles (see
     * lib/change-events.js). A door's write to a document saved since the
     * door last read or wrote it is refused as `changed`.
     *
     * Targets naming one document are written together: one permission
     * check, one lock and one save. A refused document is reported and the
     * others are still written.
     *
     * @param {object} req
     * @param {Array<{ _id: string, patch: object|Function }>} targets
     *   `_id` names the document in any mode, or by `aposDocId` in the
     *   locale of `req`. `patch` is a patch as the PATCH route takes it, or
     *   `async (doc, manager, req) => patch` to build one from the draft as
     *   it is, `req` being in the document's locale; it may return several
     *   patches, applied in order, and throw `invalid` to refuse the
     *   document. A patch is lossless unless it sets `_lossless: false`, for
     *   content that is the document's own, such as a widget it moves.
     * @returns {Promise<{ written: object[], refused: object[] }>}
     *   `written`: `{ _id, title, type, locale, published, notice, doc }`,
     *   `doc` the saved draft, for the tool's own result.
     *   `refused`: `{ _id, title?, reason, message, lockedBy?, savedBy?, fields? }`,
     *   `reason` one of `notfound`, `forbidden`, `locked`, `invalid`,
     *   `changed` (see `describeRefusal`).
     */
    async writeDocuments(req, targets) {
      const byId = new Map();
      for (const { _id, patch } of targets) {
        byId.set(_id, [ ...(byId.get(_id) || []), patch ]);
      }
      const written = [];
      const refused = [];
      for (const [ _id, patches ] of byId) {
        let found = null;
        try {
          found = await self.findDraft(req, _id);
          written.push(await writeOne(found, patches));
        } catch (e) {
          const refusal = getRefusal(self, e);
          if (!refusal) {
            throw e;
          }
          refused.push({
            _id: found?.doc._id || _id,
            ...(found && { title: found.doc.title }),
            ...refusal
          });
        }
      }
      return {
        written,
        refused
      };

      function writeOne(found, patches) {
        return self.writeDraft(found, async ({
          doc, manager, draftReq, save
        }) => {
          const inputs = [];
          for (const patch of patches) {
            const built = (typeof patch === 'function')
              ? await patch(doc, manager, draftReq)
              : patch;
            inputs.push(...[ built ].flat());
          }
          const saved = await save(inputs);
          return {
            _id: saved._id,
            title: saved.title,
            type: saved.type,
            locale: self.getLocaleOf(saved),
            ...self.getPublishState(saved.type),
            doc: saved
          };
        });
      }
    },

    /**
     * Publishes documents, one at a time, in the order given: with the AI
     * permission checks for editing and publishing, under the lock a write
     * takes, through the type's own publish. The publication is not marked
     * as AI's: it puts the draft live as it is, at the user's request. The
     * draft is read again under the lock; a door's publish of a draft saved
     * since the door last read or wrote it, by anyone but the user, is
     * refused as `changed` (see `isSavedOnlyBy`), and what goes live is the
     * draft as checked. A draft whose live version already matches it, and
     * a document of a type that is always live, are reported and left as
     * they are.
     *
     * @param {object} req
     * @param {string[]} ids Each names a document in any mode, or by
     *   `aposDocId` in the locale of `req`.
     * @returns {Promise<{ published: object[], refused: object[] }>}
     *   `published`: `{ _id, title, type, locale, status }`, `status`
     *   `published`, `unchanged` or `alwaysLive`. `refused` as
     *   `writeDocuments` refuses, a page whose parents are not published
     *   with their `{ _id, title }` as `parents`.
     */
    async publishDocuments(req, ids) {
      const published = [];
      const refused = [];
      for (const _id of [ ...new Set(ids) ]) {
        let found = null;
        try {
          found = await self.findDraft(req, _id);
          published.push(await self.writeDraft(found, publishOne));
        } catch (e) {
          const refusal = getRefusal(self, e);
          if (!refusal) {
            throw e;
          }
          refused.push({
            _id: found?.doc._id || _id,
            ...(found && { title: found.doc.title }),
            ...refusal,
            ...getPublishRefusal(e)
          });
        }
      }
      return {
        published,
        refused
      };

      async function publishOne({
        doc, manager, draftReq
      }) {
        const done = (draft, status) => ({
          _id: draft._id,
          title: draft.title,
          type: draft.type,
          locale: self.getLocaleOf(draft),
          status
        });
        if (self.getPublishing(doc.type) !== 'drafts') {
          return done(doc, 'alwaysLive');
        }
        if (!self.apos.ai.can(draftReq, 'publish', doc)) {
          throw self.apos.error('forbidden', { publish: true });
        }
        // As the editor's Publish loads it: a page with its ancestors
        const finder = self.apos.instanceOf(manager, '@apostrophecms/page-type')
          ? self.apos.page
          : manager;
        const draft = await finder.findOneForEditing(draftReq, { _id: doc._id });
        if (!draft) {
          throw self.apos.error('notfound');
        }
        const door = self.getDoor(draftReq);
        const seen = door && !door.revert && door.seen.get(draft._id);
        if (
          seen &&
          self.isSavedSince(draft, seen) &&
          !await self.isSavedOnlyBy(draftReq, manager, draft, seen)
        ) {
          throw self.apos.error('conflict');
        }
        if (draft.lastPublishedAt && !draft.modified) {
          return done(draft, 'unchanged');
        }
        const saveReq = self.getSaveRequest(draftReq).clone({ aposAi: false });
        await finder.publish(saveReq, draft);
        if (saveReq.aposSaveMarker) {
          await self.recordPublish(saveReq, draft);
        }
        await self.publishChangePublished(draftReq, draft);
        return done(draft, 'published');
      }

      // What a publish says beside the write path's refusal: its own words
      // for `changed` and `forbidden`, and the parents a page waits for
      function getPublishRefusal(e) {
        if (e.name === 'conflict') {
          return { message: PUBLISH_CHANGED };
        }
        if (e.name === 'forbidden' && e.data?.publish) {
          return { message: PUBLISH_FORBIDDEN };
        }
        const parents = e.data?.unpublishedAncestors;
        return Array.isArray(parents)
          ? {
            parents: parents.map(parent => ({
              _id: parent._id,
              title: parent.title
            }))
          }
          : {};
      }
    },

    /**
     * The publish tool's result: each document with its status, the refused
     * ones with their reason, and the sentence the model repeats once any
     * document went live.
     *
     * @param {{ published: object[], refused: object[] }} result
     * @returns {{ published: object[], refused?: object[], notice?: string }}
     */
    getPublishResult({ published, refused }) {
      return {
        published,
        ...(refused.length && { refused }),
        ...(published.some(item => item.status === 'published') && {
          notice: PUBLISHED_NOTICE
        })
      };
    },

    /**
     * Whether `doc` was saved since `updatedAt`, the `updatedAt` a door read
     * or wrote it with. A document without `updatedAt` is not checked.
     *
     * @param {object} doc
     * @param {Date|string} updatedAt
     * @returns {boolean}
     */
    isSavedSince(doc, updatedAt) {
      const saved = new Date(doc.updatedAt ?? NaN).getTime();
      return !isNaN(saved) && (saved !== new Date(updatedAt).getTime());
    },

    /**
     * Whether every save of `draft` since `updatedAt` is the user's own, as
     * Document Versions records them: each draft version saved after it by
     * the user of `req`, none marked as AI's, the newest one the draft as it
     * is. A save by someone else always starts a version of its own. When
     * the type has no draft versions, or they don't account for the draft,
     * nothing tells the saves apart: `false`.
     *
     * @param {object} req
     * @param {object} manager The draft's type manager.
     * @param {object} draft
     * @param {Date|string} updatedAt
     * @returns {Promise<boolean>}
     */
    async isSavedOnlyBy(req, manager, draft, updatedAt) {
      const { docVersions } = self.apos;
      if (!req.user || !docVersions?.hasDraftVersions(manager.options)) {
        return false;
      }
      const since = new Date(updatedAt);
      // A version replaced in place keeps its `createdAt`
      const versions = await docVersions.find(req, {
        ...docVersions.getTimelineCriteria(draft),
        mode: 'draft',
        $or: [
          { createdAt: { $gt: since } },
          { updatedAt: { $gt: since } }
        ]
      }, {
        project: {
          authorId: 1,
          ai: 1,
          doc: 1
        }
      });
      // A version is stamped after its save: the save's own time tells
      const after = versions
        .filter(version => new Date(version.doc?.updatedAt ?? NaN) > since);
      return after.length > 0 &&
        after.every(version => (version.authorId === req.user._id) && !version.ai) &&
        after.some(version => !self.isSavedSince(draft, version.doc.updatedAt));
    },

    /**
     * Runs `work` on a draft `findDraft` found, as `writeDocuments` writes
     * one: after the AI permission check, with a lock held until `work`
     * ends. `work` gets `{ doc, manager, draftReq, save }`; `save(inputs)`
     * saves patches as the PATCH route takes them in one save of the
     * type's own patch, each lossless unless it sets `_lossless: false`,
     * marked and announced as `writeDocuments` describes, and returns the
     * saved draft. Throws `forbidden` or `locked` before `work` runs.
     *
     * @param {{ doc: object, manager: object, draftReq: object }} found
     * @param {Function} work
     * @returns {Promise<*>} What `work` returns.
     */
    async writeDraft({
      doc, manager, draftReq
    }, work) {
      if (!self.apos.ai.can(draftReq, 'edit', doc)) {
        throw self.apos.error('forbidden');
      }
      const door = self.getDoor(draftReq);
      const lockId = door?.lockId ||
        draftReq.aposAiCallId ||
        self.apos.util.generateId();
      await self.apos.doc.lock(draftReq, doc, lockId, door?.family && {
        family: door.family
      });
      try {
        return await work({
          doc,
          manager,
          draftReq,
          save
        });
      } finally {
        try {
          await self.apos.doc.unlock(draftReq, doc, lockId);
        } catch (e) {
          // The lock expires on its own, and a saved write stands
          self.logError(draftReq, 'lock-release-failed', e.message, {
            lockId,
            docId: doc._id
          });
        }
      }

      async function save(patches) {
        const inputs = patches.map(input => ({
          _lossless: true,
          ...input
        }));
        const saveReq = self.getSaveRequest(draftReq, doc);
        const body = (inputs.length === 1)
          ? inputs[0]
          : { _patches: inputs };
        await self.publishChangeStarting(draftReq, doc, inputs);
        let saved;
        try {
          saved = self.apos.instanceOf(manager, '@apostrophecms/page-type')
            ? await self.apos.page.patch(saveReq.clone({ body }), doc._id)
            : await manager.convertPatchAndRefresh(saveReq, body, doc._id);
        } catch (e) {
          await self.publishChangeSettled(draftReq, doc);
          throw e;
        }
        await self.publishChangeSettled(draftReq, doc, saveReq.aposSaveMarker);
        await self.rememberSeen(draftReq, saved);
        return saved;
      }
    },

    /**
     * Creates a document as `writeDocuments` writes one: in draft mode, with
     * the AI permission check, marked as AI's and recorded for a door's
     * request. Every value is a new instance (see `newValue`), and the
     * document is refused when conversion would drop any of it, since all
     * of it is the caller's. A page goes under `parent`, in its locale, at
     * `position` from `target` as `apos.page.insert` takes them, its slug
     * under the parent's unless `values` names one.
     *
     * @param {object} req
     * @param {object} options
     * @param {string} options.type A page or piece type.
     * @param {string} options.title
     * @param {object} [options.values] Other fields of the type's AI-facing
     *   schema, by name; an unknown name refuses the document.
     * @param {object} [options.parent] The parent page, for a page.
     * @param {object} [options.target] The page `position` is from; the
     *   parent when omitted.
     * @param {string} [options.position] `firstChild`, `lastChild` (the
     *   default), `before` or `after`.
     * @returns {Promise<{ written: object[], refused: object[] }>} As
     *   `writeDocuments` returns them, with the document's `slug`, and its
     *   `url` when it has one.
     */
    async createDocument(req, {
      type, title, values = {}, parent = null, target = parent, position = 'lastChild'
    }) {
      try {
        return {
          written: [ await create() ],
          refused: []
        };
      } catch (e) {
        const refusal = getRefusal(self, e);
        if (!refusal) {
          throw e;
        }
        return {
          written: [],
          refused: [ {
            title,
            ...refusal
          } ]
        };
      }

      async function create() {
        const manager = self.apos.doc.getManager(type);
        const locale = parent && self.getLocaleOf(parent);
        const draftReq = req.clone({
          mode: 'draft',
          ...(locale && { locale })
        });
        if (!self.apos.ai.can(draftReq, 'create', type, 'draft')) {
          throw self.apos.error('forbidden', { create: true });
        }
        const schema = self.getAiSchemaOf(draftReq, manager);
        const input = {};
        const errors = [];
        for (const [ name, value ] of Object.entries(values)) {
          const field = schema.find(field => field.name === name);
          if (field) {
            input[name] = self.newValue(draftReq, field, value);
          } else {
            errors.push({
              path: name,
              name: 'unknown',
              hint: 'The type has no field of that name.'
            });
          }
        }
        if (errors.length) {
          throw self.apos.error('invalid', { errors });
        }
        input.title = title;
        const doc = parent ? self.apos.page.newChild(parent) : manager.newInstance();
        if (parent) {
          input.type = type;
          input.slug ??= self.apos.util.addSlashIfNeeded(parent.slug) +
            self.apos.util.slugify(title);
        }
        // Conversion empties every field its input lacks: the type's defaults
        // for the fields the model left out, as the editor's own create sends
        const defaults = manager.newInstance();
        for (const field of manager.schema) {
          if (!Object.hasOwn(input, field.name) && Object.hasOwn(defaults, field.name)) {
            input[field.name] = defaults[field.name];
          }
        }
        const saveReq = self.getSaveRequest(draftReq);
        const drops = [];
        await manager.convert(saveReq, input, doc, { drops });
        if (drops.length) {
          throw self.apos.error('invalid', { drops });
        }
        await manager.emit('afterConvert', saveReq, input, doc);
        if (parent) {
          await self.apos.page.insert(saveReq, target._id, position, doc);
        } else {
          await manager.insert(saveReq, doc);
        }
        // Read back for the URL the type's own query adds
        const saved = await manager.find(draftReq, { _id: doc._id })
          .relationships(false)
          .toObject() || doc;
        // A field's aiHow reaches the model with the schema read, which a
        // create can skip: the fields with one left empty carry it here
        const unfilled = schema
          .filter(field => field.aiHow?.trim() && isEmpty(saved[field.name]))
          .map(field => ({
            field: field.name,
            aiHow: field.aiHow.trim()
          }));
        await self.rememberSeen(draftReq, saved);
        return {
          _id: saved._id,
          title: saved.title,
          type: saved.type,
          locale: self.getLocaleOf(saved),
          slug: saved.slug,
          ...(saved._url && { url: saved._url }),
          ...self.getPublishState(saved.type),
          ...(unfilled.length && { unfilled }),
          doc: saved
        };
      }
    },

    // The draft a read or write targets, `{ doc, manager, draftReq }`,
    // `draftReq` in the document's locale. `_id` names the document in any
    // mode, or by `aposDocId` in the locale of `req`. Throws `notfound` when
    // `req` can't see it
    async findDraft(req, _id) {
      const id = self.apos.launder.id(_id);
      const [ aposDocId, locale ] = id.split(':');
      if (!aposDocId || (locale && !self.apos.i18n.locales[locale])) {
        throw self.apos.error('notfound');
      }
      const draftReq = req.clone({
        mode: 'draft',
        ...(locale && { locale })
      });
      const doc = await self.apos.doc.find(draftReq, {
        $or: [
          { _id: locale ? `${aposDocId}:${locale}:draft` : aposDocId },
          { aposDocId }
        ]
      }).toObject();
      const manager = doc && self.apos.doc.getManager(doc.type);
      if (!manager) {
        throw self.apos.error('notfound');
      }
      return {
        doc,
        manager,
        draftReq
      };
    },

    // How documents of `type` go live: `drafts` (an editor publishes the
    // draft), `autopublish` (published on save) or `noDrafts` (saved live)
    getPublishing(type) {
      const manager = self.apos.doc.getManager(type);
      if (!manager?.isLocalized()) {
        return 'noDrafts';
      }
      return manager.options.autopublish ? 'autopublish' : 'drafts';
    },

    // Where a write of `type` lands: `{ published, notice }`, the notice
    // being the sentence the model repeats. Live for a type that publishes
    // on save or has no drafts
    getPublishState(type) {
      const live = self.getPublishing(type) !== 'drafts';
      return {
        published: live,
        notice: live ? LIVE_NOTICE : DRAFT_NOTICE
      };
    },

    /**
     * The request a save of `doc` runs on, as every harness write saves:
     * marked as AI's unless the door's request reverts and, with a door
     * context, carrying the marker the change log records and, for a
     * document the door read or wrote, the `updatedAt` the save is checked
     * against (see the harness's `checkUnchanged`). For code that saves
     * through core's own methods, such as a copy into another locale.
     *
     * @param {object} draftReq A draft-mode `req` in the document's locale.
     * @param {object} [doc] The document saved, `null` for a new one.
     * @returns {object} A clone of `draftReq`.
     */
    getSaveRequest(draftReq, doc = null) {
      const door = self.getDoor(draftReq);
      const updatedAt = doc && !door?.revert && door?.seen.get(doc._id);
      return draftReq.clone({
        aposAi: !door?.revert,
        ...(updatedAt && {
          aposHarnessExpected: {
            docId: doc._id,
            updatedAt,
            checked: false
          }
        }),
        ...(door && {
          aposSaveMarker: {
            door: door.door,
            requestId: door.requestId,
            ...(door.chat && { chat: door.chat }),
            ...(door.model && { model: door.model }),
            ...(door.client && { client: door.client }),
            ...(door.revert && { revert: true })
          }
        })
      });
    },

    /**
     * The tool result of `writeDocuments` or `createDocument`: each document
     * written with where it landed and what `extra(doc)` adds for the tool,
     * the refused ones with their reason, and the sentence the model
     * repeats.
     *
     * @param {{ written: object[], refused: object[] }} result
     * @param {Function} [extra] `(doc) => object`, `doc` the saved draft.
     * @returns {{ written: object[], refused?: object[], notice?: string }}
     */
    getWriteResult({ written, refused }, extra = () => ({})) {
      const published = new Set(written.map(item => item.published));
      return {
        written: written.map(({
          doc, notice, ...item
        }) => ({
          ...item,
          ...extra(doc)
        })),
        ...(refused.length && { refused }),
        ...(written.length && {
          notice: (published.size > 1) ? MIXED_NOTICE : written[0].notice
        })
      };
    },

    // The locale of a document without its mode, `null` when the type is
    // not localized
    getLocaleOf(doc) {
      return doc.aposLocale ? doc.aposLocale.split(':')[0] : null;
    },

    // `{ reason, message, ... }` for a write refused with `error`: a
    // `locked` one with `lockedBy`, the holder's name, `null` for the same
    // user elsewhere; an `invalid` one with the `fields` it names; a
    // `changed` one saved since the door's last read with `savedBy`, the
    // saver's name, `null` for the door's own user
    describeRefusal(error) {
      if (error.name === 'locked') {
        const lockedBy = error.data?.me
          ? null
          : (error.data?.title || error.data?.username || null);
        return {
          reason: 'locked',
          lockedBy,
          message: error.data?.me
            ? 'The document is being edited in another browser tab or chat of the same user.'
            : `The document is being edited by ${lockedBy || 'another user'}.`
        };
      }
      if (error.name === 'conflict') {
        const me = Boolean(error.data?.me);
        const savedBy = me
          ? null
          : (error.data?.title || error.data?.username || null);
        const saved = me
          ? 'The document was saved as the user, in the admin UI or another of ' +
            'their chats or tools, since you last read it'
          : `The document was saved by ${savedBy || 'someone else'} since you last read it`;
        // A save as the same user needs no question: the read shows it, and
        // the write builds on it. Anyone else's could be lost, so the model
        // stops and asks
        if (me) {
          return {
            reason: 'changed',
            savedBy,
            message: `${saved}, so nothing was written to it. Read it again and make ` +
              'your change to what was saved, keeping those changes.'
          };
        }
        return {
          reason: 'changed',
          savedBy,
          message: `${saved}, so nothing was written to it. Writing it now would ` +
            'replace their work: read it again, tell the user what they changed, and ' +
            'write it only if the user asks you to.'
        };
      }
      if (error.name === 'invalid') {
        const fields = getFields(error);
        return {
          reason: 'invalid',
          message: fields.length
            ? 'Some values were refused.'
            : (error.message || 'The values were refused.'),
          ...(fields.length && { fields })
        };
      }
      if (error.name === 'forbidden') {
        return {
          reason: 'forbidden',
          message: error.data?.create
            ? 'The user may not create a document of this type.'
            : 'The user may not edit this document.'
        };
      }
      return {
        reason: error.name,
        message: 'No such document.'
      };

      // `{ path, reason }` for every field the error names: what the save
      // flag would drop, or what conversion rejected, nested errors
      // flattened to dotted paths
      function getFields(error) {
        if (Array.isArray(error.data?.drops)) {
          return error.data.drops.map(drop => ({
            path: drop.path,
            reason: drop.reason,
            ...(drop.message && { message: drop.message })
          }));
        }
        const errors = error.data?.errors;
        if (!Array.isArray(errors)) {
          return [];
        }
        return errors.flatMap(item => {
          const nested = getFields(item)
            .map(field => ({
              ...field,
              path: `${item.path}.${field.path}`
            }));
          return nested.length
            ? nested
            : [ {
              path: item.path,
              reason: item.name || 'invalid',
              ...(item.hint && { message: item.hint })
            } ];
        });
      }
    }
  };
};

// `{ reason, message, fields? }` for an error that refuses a document,
// `null` for one that stops the call. Conversion throws its field errors as
// an array
function getRefusal(self, e) {
  const error = Array.isArray(e)
    ? self.apos.error('invalid', { errors: e })
    : e;
  return REFUSALS.has(error?.name) ? self.describeRefusal(error) : null;
}

// A value a create left empty: nothing, an empty string or list, an area
// without widgets
function isEmpty(value) {
  return (value == null) ||
    (value === '') ||
    (Array.isArray(value) && !value.length) ||
    ((value.metaType === 'area') && !value.items?.length);
}

// What the model reads of a write, for tests of what each door reads
module.exports.MODEL_TEXTS = [
  LIVE_NOTICE,
  DRAFT_NOTICE,
  MIXED_NOTICE,
  PUBLISHED_NOTICE,
  PUBLISH_CHANGED,
  PUBLISH_FORBIDDEN
];
