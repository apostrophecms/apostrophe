// The one write path every mutating harness tool goes through.

// Errors a target is refused with; anything else is a bug and stops the call
const REFUSALS = new Set([ 'notfound', 'forbidden', 'locked', 'invalid' ]);

const LIVE_NOTICE = 'The change is live on the site now.';
const DRAFT_NOTICE = 'The change is saved in the draft; it goes live when an editor publishes it.';

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
     * lib/change-events.js).
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
     *   `doc` the saved draft, for the tool's own result. `refused`: `{ _id,
     *   title?, reason, message, fields? }`, `reason` one of `notfound`,
     *   `forbidden`, `locked`, `invalid`; `fields` the `{ path, reason }` an
     *   `invalid` one names.
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

      async function writeOne({
        doc, manager, draftReq
      }, patches) {
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
          const inputs = [];
          for (const patch of patches) {
            const built = (typeof patch === 'function')
              ? await patch(doc, manager, draftReq)
              : patch;
            for (const input of [ built ].flat()) {
              inputs.push({
                _lossless: true,
                ...input
              });
            }
          }
          const saveReq = getSaveRequest(self, draftReq);
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
          return {
            _id: saved._id,
            title: saved.title,
            type: saved.type,
            locale: self.getLocaleOf(saved),
            ...self.getPublishState(saved.type),
            doc: saved
          };
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
          throw self.apos.error('forbidden');
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
        const saveReq = getSaveRequest(self, draftReq);
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

    // The locale of a document without its mode, `null` when the type is
    // not localized
    getLocaleOf(doc) {
      return doc.aposLocale ? doc.aposLocale.split(':')[0] : null;
    },

    // `{ reason, message, fields? }` for a write refused with `error`
    describeRefusal(error) {
      if (error.name === 'locked') {
        return {
          reason: 'locked',
          message: error.data?.me
            ? 'The document is being edited in another browser tab or chat of the same user.'
            : `The document is being edited by ${error.data?.title || error.data?.username || 'another user'}.`
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
      return {
        reason: error.name,
        message: (error.name === 'forbidden')
          ? 'The user may not edit this document.'
          : 'No such document.'
      };

      // `{ path, reason }` for every field the error names: what the save
      // flag would drop, or what conversion rejected, nested errors
      // flattened to dotted paths
      function getFields(error) {
        if (Array.isArray(error.data?.drops)) {
          return error.data.drops.map(drop => ({
            path: drop.path,
            reason: drop.reason
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

// The request a door's save runs on: marked as AI's unless the request
// reverts, and with a door context, carrying the marker the change log
// records
function getSaveRequest(self, draftReq) {
  const door = self.getDoor(draftReq);
  return draftReq.clone({
    aposAi: !door?.revert,
    ...(door && {
      aposSaveMarker: {
        door: door.door,
        requestId: door.requestId,
        ...(door.chat && { chat: door.chat }),
        ...(door.model && { model: door.model }),
        ...(door.revert && { revert: true })
      }
    })
  });
}

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
