// The change log: one entry per document a door's request saved, with the
// change rows between the document before the request's first save and
// after its last. Entries are written by the save-settled event, so they
// hold what storage did, every save handler included. A publish is an entry
// of its own, with no rows: it changes no content of the draft.

// Raised when an entry's shape changes; a migration upgrades older entries
const SCHEMA_VERSION = 1;

module.exports = (self) => {
  return {
    async enableChangeLog() {
      self.changes = await self.apos.db.collection('aposAiChanges');
      // The fold's own key, and a request's entries
      await self.changes.createIndex({
        requestId: 1,
        docId: 1,
        sequence: 1
      }, { unique: true });
      await self.changes.createIndex({
        docId: 1,
        at: -1
      });
      await self.changes.createIndex({
        userId: 1,
        at: -1
      });
      await self.changes.createIndex({
        door: 1,
        at: -1
      });
      await self.changes.createIndex({
        chat: 1,
        at: 1
      });
    },

    /**
     * Records a save of a door's request (see `writeDocuments`) in the
     * change log. Saves of one document in one request fold into one entry:
     * its rows run from the document before the first save to after the
     * latest. A save that does not start where the entry's last one ended,
     * because someone else saved in between, starts a new entry, so no
     * other save is ever recorded as the request's.
     *
     * An editor's save of fields the request wrote into it from outside
     * (see the assistant's `markOutsideSave`) records only the rows at or
     * below those `fields`: the editor's own stay the editor's. Such a save
     * after the request ended leaves a closed entry.
     *
     * @param {object} req The `req` of the save.
     * @param {object} settled The `afterSaveSettled` payload, and for an
     *   editor's save `fields` and `ended`.
     * @returns {Promise<string|null>} The `_id` of the entry the save landed
     *   in, `null` when none of `fields` changed.
     */
    async recordChange(req, {
      marker, before, after, toolCall, drops, fields = null, ended = false
    }) {
      const open = await self.changes.findOne({
        requestId: marker.requestId,
        docId: after._id
      }, {
        sort: { sequence: -1 }
      });
      // An open entry has a `head`, the `updatedAt` its last save left
      const continues = Boolean(open?.head && before) &&
        (open.head.getTime() === before.updatedAt?.getTime());
      const base = continues
        ? (open.base && await self.apos.docVersions.unpack(open.base))
        : before;
      const allFields = fields && [ ...new Set([ ...(open?.fields || []), ...fields ]) ];
      const between = await self.apos.docVersions.getChangeRowsBetween(req, base, after);
      const rows = allFields
        ? between.filter(row => self.apos.docVersions.isWithinFields(row, allFields))
        : between;
      if (allFields && !rows.length) {
        return null;
      }
      const now = new Date();
      const latest = {
        updatedAt: now,
        ...(!ended && { head: after.updatedAt }),
        ...(allFields && { fields: allFields }),
        title: after.title,
        effect: getEffect(base, after),
        rows,
        versionId: await getVersionId(after)
      };
      if (continues) {
        await self.changes.updateOne({ _id: open._id }, {
          $set: latest,
          $push: {
            toolCalls: { $each: toolCall ? [ toolCall ] : [] },
            drops: { $each: drops }
          }
        });
        return open._id;
      }
      const _id = self.apos.util.generateId();
      await self.changes.insertOne({
        _id,
        schemaVersion: SCHEMA_VERSION,
        requestId: marker.requestId,
        sequence: (open?.sequence || 0) + 1,
        door: marker.door,
        chat: marker.chat || null,
        model: marker.model || null,
        ai: !marker.revert,
        ...(marker.revert && { revert: true }),
        userId: req.user?._id || null,
        userTitle: req.user?.title || null,
        at: now,
        docId: after._id,
        aposDocId: after.aposDocId,
        locale: self.getLocaleOf(after),
        type: after.type,
        ...(!before && await isLocalized(after) && { localized: true }),
        toolCalls: toolCall ? [ toolCall ] : [],
        drops,
        ...(!ended && {
          base: before ? await self.apos.docVersions.pack(before) : null
        }),
        ...latest
      });
      return _id;

      // What the save did to the document: `create`, `archive`, `move` (a
      // page placed elsewhere in the tree), `submit` or `update`
      function getEffect(before, after) {
        if (!before) {
          return 'create';
        }
        if (after.archived && !before.archived) {
          return 'archive';
        }
        if ((after.path !== before.path) || (after.rank !== before.rank)) {
          return 'move';
        }
        if (after.submitted && !before.submitted) {
          return 'submit';
        }
        return 'update';
      }

      // Whether a document just created is a copy into its locale of one
      // another locale already holds: a revert removes such a copy whole
      async function isLocalized(doc) {
        const locale = self.getLocaleOf(doc);
        return Boolean(locale && await self.apos.doc.db.findOne({
          aposDocId: doc.aposDocId,
          aposLocale: {
            $nin: [ 'draft', 'published', 'previous' ].map(mode => `${locale}:${mode}`)
          }
        }, { projection: { _id: 1 } }));
      }

      // The Document Versions version this save landed in, `null` when
      // it recorded none
      async function getVersionId(doc) {
        const version = await self.apos.docVersions.findOne(req, {
          docId: doc.aposDocId,
          locale: self.getLocaleOf(doc)
        }, {
          project: {
            _id: 1,
            createdAt: 1,
            updatedAt: 1
          },
          raw: true
        });
        const at = version && (version.updatedAt || version.createdAt);
        return (at && (at >= doc.updatedAt)) ? version._id : null;
      }
    },

    /**
     * Records a door request's publish of `draft` in the change log: an
     * entry of its own, `effect` `publish`, with no rows, closed at once, so
     * a later save of the document starts an entry of its own.
     *
     * @param {object} req The publish's `req`, carrying the save marker.
     * @param {object} draft The draft published.
     * @returns {Promise<string>} The entry's `_id`.
     */
    async recordPublish(req, draft) {
      const marker = req.aposSaveMarker;
      const last = await self.changes.findOne({
        requestId: marker.requestId,
        docId: draft._id
      }, {
        sort: { sequence: -1 },
        projection: { sequence: 1 }
      });
      const now = new Date();
      const _id = self.apos.util.generateId();
      await self.changes.insertOne({
        _id,
        schemaVersion: SCHEMA_VERSION,
        requestId: marker.requestId,
        sequence: (last?.sequence || 0) + 1,
        door: marker.door,
        chat: marker.chat || null,
        model: marker.model || null,
        ai: !marker.revert,
        userId: req.user?._id || null,
        userTitle: req.user?.title || null,
        at: now,
        updatedAt: now,
        docId: draft._id,
        aposDocId: draft.aposDocId,
        locale: self.getLocaleOf(draft),
        type: draft.type,
        title: draft.title,
        effect: 'publish',
        rows: [],
        toolCalls: req.aposAiToolCall ? [ req.aposAiToolCall ] : [],
        drops: [],
        versionId: null
      });
      return _id;
    },

    /**
     * Ends a door's request: closes its change log entries, which keep only
     * their rows from then on. The door calls it once the request is over,
     * however it ended.
     *
     * @param {object} req A `req` carrying the door context (`withDoor`).
     */
    async endRequest(req) {
      const door = self.getDoor(req);
      if (!door) {
        return;
      }
      await self.changes.updateMany({
        requestId: door.requestId,
        head: { $exists: true }
      }, {
        $unset: {
          base: 1,
          head: 1
        }
      });
    },

    /**
     * Deletes the change log entries of a chat, for the assistant's delete
     * of that chat. Only the user's own entries: a chat's writes run as its
     * owner.
     *
     * @param {object} req
     * @param {string} chat The chat's id.
     */
    async deleteChatChanges(req, chat) {
      await self.changes.deleteMany({
        chat,
        userId: req.user._id
      });
    }
  };
};
