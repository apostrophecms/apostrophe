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
     * the change log records (`aposSaveMarker`).
     *
     * Targets naming one document are written together: one permission
     * check, one lock and one save. A refused document is reported and the
     * others are still written.
     *
     * @param {object} req
     * @param {Array<{ _id: string, patch: object|Function }>} targets
     *   `_id` names the document in any mode, or by `aposDocId` in the
     *   locale of `req`. `patch` is a patch as the PATCH route takes it, or
     *   `async (doc, manager) => patch` to build one from the draft as it
     *   is; it may throw `invalid` to refuse the document.
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
          found = await self.findForWrite(req, _id);
          written.push(await writeOne(found, patches));
        } catch (e) {
          // Conversion throws its field errors as an array
          const error = Array.isArray(e)
            ? self.apos.error('invalid', { errors: e })
            : e;
          if (!REFUSALS.has(error?.name)) {
            throw error;
          }
          refused.push({
            _id: found?.doc._id || _id,
            ...(found && { title: found.doc.title }),
            ...self.describeRefusal(error)
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
            const input = (typeof patch === 'function')
              ? await patch(doc, manager)
              : patch;
            inputs.push({
              ...input,
              _lossless: true
            });
          }
          const saveReq = draftReq.clone({
            aposAi: !door?.revert,
            ...(door && {
              aposSaveMarker: {
                door: door.door,
                request: door.request,
                ...(door.chat && { chat: door.chat }),
                ...(door.model && { model: door.model }),
                ...(door.revert && { revert: true })
              }
            })
          });
          const body = (inputs.length === 1)
            ? inputs[0]
            : { _patches: inputs };
          const saved = self.apos.instanceOf(manager, '@apostrophecms/page-type')
            ? await self.apos.page.patch(saveReq.clone({ body }), doc._id)
            : await manager.convertPatchAndRefresh(saveReq, body, doc._id);
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

    // The draft a write targets, `{ doc, manager, draftReq }`, `draftReq`
    // in the document's locale. Throws `notfound` when `req` can't see it
    async findForWrite(req, _id) {
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

    // Where a write of `type` lands: `{ published, notice }`, the notice
    // being the sentence the model repeats. Live for a type that publishes
    // on save or has no drafts
    getPublishState(type) {
      const manager = self.apos.doc.getManager(type);
      const live = Boolean(manager?.options.autopublish) || !manager?.isLocalized();
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
              reason: item.name || 'invalid'
            } ];
        });
      }
    }
  };
};
