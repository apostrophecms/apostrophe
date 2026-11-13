// Revert: takes back what door requests changed, as the change log recorded
// it, across every document. Each document is reverted on its own, in one
// save: its rows newest first, each checked by the versions module's row
// guard (`checkChangeRows`) against the document as the rows before it left
// it, so a row put back can make another one clean. A row edited, removed or
// not restorable since is kept and reported; nothing is overwritten.
//
// Documents the requests created come last, newest first, once the changes
// referencing them are reverted: removed unless published, edited, given
// children or used elsewhere since. A never-published draft is deleted, as
// the editor's Discard Draft does; a type that publishes on save or has no
// drafts is archived.

const _ = require('lodash');

// Row guard outcomes that keep a document, and the reason it is kept for
const KEPT = {
  edited: 'edited',
  gone: 'removed'
};

module.exports = (self) => {
  return {
    /**
     * Reverts the changes of door requests, or tells what a revert would do
     * (`dryRun`). `req` carries the door context of the revert (`withDoor`
     * with `revert: true`): its saves lock as the door's writes do and are
     * recorded as the user's own change, under the user's permissions.
     *
     * @param {object} req
     * @param {string[]} requestIds The requests whose changes are reverted.
     * @param {object} [options]
     * @param {boolean} [options.dryRun] Write nothing.
     * @param {string[]} [options.docIds] Only these documents, by the
     *   `docId` of their change log entries.
     * @param {Function} [options.onProgress] `async ({ done, total })`,
     *   after each document.
     * @returns {Promise<object[]>} One outcome per document, `{ docId,
     *   aposDocId, locale, type, title, created, outcome, reason?,
     *   lockedBy?, rows }`. `outcome`: `putBack`; `reverted`, nothing left
     *   to put back; `kept`, `reason` `edited`, `removed` or `archived`
     *   since, and for a created document `published`, `children` or
     *   `used`; `unrestorable`, `reason` as `checkChangeRows` gives it, or
     *   `permission` or `invalid`; `locked`, `lockedBy` the holder's name,
     *   `null` for the user's own; `deleted` or `archived`, a created
     *   document removed. `rows`: `{ entryId, index, outcome, reason? }`
     *   per change row checked, `outcome` `putBack`, `reverted`, `edited`,
     *   `gone` or `unrestorable`. `title` is the document's own, else the
     *   one its newest entry stored.
     */
    async revertRequests(req, requestIds, {
      dryRun = false, docIds = null, onProgress = null
    } = {}) {
      const door = self.getDoor(req);
      if (!door?.revert) {
        throw self.apos.error('invalid', 'a revert needs the door context of a revert');
      }
      const entries = await self.changes
        .find({
          requestId: { $in: requestIds },
          ...(docIds && { docId: { $in: docIds } })
        })
        .sort({
          at: -1,
          sequence: -1
        })
        .toArray();
      const byDoc = new Map();
      for (const entry of entries) {
        byDoc.set(entry.docId, [ ...(byDoc.get(entry.docId) || []), entry ]);
      }
      const documents = [ ...byDoc.values() ].map(list => ({
        newest: list[0],
        changes: list.filter(entry => entry.effect !== 'create'),
        create: list.find(entry => entry.effect === 'create') || null
      }));
      const order = [
        ...documents.filter(document => !document.create),
        ...documents.filter(document => document.create)
          .sort((one, two) => two.create.at - one.create.at)
      ];
      // Each document as the revert leaves it, and the created documents it
      // removes, for the documents that come after
      const planned = new Map();
      const removed = new Set();
      const results = [];
      for (const document of order) {
        results.push(await revertDocument(document));
        if (onProgress) {
          await onProgress({
            done: results.length,
            total: order.length
          });
        }
      }
      return results;

      async function revertDocument({
        newest, changes, create
      }) {
        const result = {
          docId: newest.docId,
          aposDocId: newest.aposDocId,
          locale: newest.locale,
          type: newest.type,
          title: newest.title,
          created: Boolean(create)
        };
        const end = (outcome, more = {}) => ({
          ...result,
          outcome,
          ...more,
          rows: more.rows || []
        });
        const stored = await self.apos.doc.db.findOne({ _id: result.docId }, {
          projection: {
            title: 1,
            archived: 1
          }
        });
        if (!stored || stored.archived) {
          // A document the requests added and that is gone is as they found
          // it
          return create
            ? end('reverted')
            : end('kept', { reason: stored ? 'archived' : 'removed' });
        }
        result.title = stored.title;
        let found;
        try {
          found = await self.findDraft(req, result.docId);
        } catch (e) {
          if (e.name !== 'notfound') {
            throw e;
          }
          return end('unrestorable', { reason: 'permission' });
        }
        if (dryRun) {
          if (!self.apos.ai.can(found.draftReq, 'edit', found.doc)) {
            return end('unrestorable', { reason: 'permission' });
          }
          const refusal = await self.apos.doc.checkLock(
            found.draftReq,
            found.doc,
            door.lockId,
            door.family ? { family: door.family } : {}
          );
          return refusal
            ? refused(refusal)
            : decide(found, null);
        }
        try {
          return await self.writeDraft(found, ({ save }) => decide(found, save));
        } catch (e) {
          return refused(e);
        }

        // A document the revert can't write, as `e` refuses it
        function refused(e) {
          if (e.name === 'locked') {
            return end('locked', {
              lockedBy: e.data?.me ? null : (e.data?.title || e.data?.username || null)
            });
          }
          if (e.name === 'forbidden') {
            return end('unrestorable', { reason: 'permission' });
          }
          if (e.name === 'notfound') {
            return end('kept', { reason: 'removed' });
          }
          if (isRefusal(e)) {
            return end('unrestorable', { reason: 'invalid' });
          }
          throw e;
        }

        // Plans the document's revert, and with `save` carries it out
        async function decide({
          doc, manager, draftReq
        }, save) {
          const {
            working, patches, rows
          } = await putBack(doc, manager, draftReq);
          result.title = working.title;
          planned.set(doc._id, {
            doc: working,
            manager
          });
          if (create) {
            const reason = await getKeepReason(doc, working, draftReq);
            if (!reason) {
              const outcome = (self.getPublishing(doc.type) === 'drafts') ? 'deleted' : 'archived';
              removed.add(doc._id);
              if (save && (outcome === 'deleted')) {
                await self.apos.doc.delete(draftReq, doc);
              } else if (save) {
                await save([ { archived: true } ]);
              }
              return end(outcome);
            }
            if (save && patches.length) {
              await save(patches);
            }
            return end('kept', {
              reason,
              rows
            });
          }
          if (save && patches.length) {
            await save(patches);
          }
          const [ outcome, more ] = summarize(rows);
          return end(outcome, {
            ...more,
            rows
          });
        }

        // The document's rows checked newest first against the document as
        // the rows before left it, passing over those not clean again while
        // a pass puts one more back: `{ working, patches, rows }`, the
        // document as the revert leaves it and the patches that do it
        async function putBack(doc, manager, draftReq) {
          // As the type's own patch loads it: a page with its ancestors
          let working = await (isPage(manager) ? self.apos.page : manager)
            .findOneForEditing(draftReq, { _id: doc._id });
          const items = changes.flatMap(entry => entry.rows.map((row, index) => ({
            entryId: entry._id,
            index,
            row
          })));
          const outcomes = new Map();
          const patches = [];
          let open = items;
          let progress = true;
          while (progress && open.length) {
            progress = false;
            const left = [];
            for (const item of open) {
              const [ checked ] = await self.apos.docVersions.checkChangeRows(
                draftReq,
                working,
                [ item.row ]
              );
              if (checked.outcome !== 'clean') {
                outcomes.set(item, _.pick(checked, 'outcome', 'reason'));
                left.push(item);
                continue;
              }
              const next = _.cloneDeep(working);
              try {
                await applyPatch(draftReq, manager, next, checked.restore.patch);
              } catch (e) {
                if (!isRefusal(e)) {
                  throw e;
                }
                outcomes.set(item, {
                  outcome: 'unrestorable',
                  reason: 'invalid'
                });
                continue;
              }
              working = next;
              patches.push(checked.restore.patch);
              outcomes.set(item, { outcome: 'putBack' });
              progress = true;
            }
            open = left;
          }
          return {
            working,
            patches,
            rows: items.map(({ entryId, index }, i) => ({
              entryId,
              index,
              ...outcomes.get(items[i])
            }))
          };
        }

        // Why a created document stays, `null` when it goes
        async function getKeepReason(doc, working, draftReq) {
          // The requests never publish: a published draft was published by
          // someone. A type that publishes on save published with them
          if ((self.getPublishing(doc.type) === 'drafts') && doc.lastPublishedAt) {
            return 'published';
          }
          const checked = await self.apos.docVersions.checkChangeRows(
            draftReq,
            working,
            create.rows
          );
          if (checked.some(row => ![ 'clean', 'unrestorable' ].includes(row.outcome))) {
            return 'edited';
          }
          if (doc.path && self.apos.page.isPage(doc) && await hasChildren(doc)) {
            return 'children';
          }
          return (await isUsed(doc)) ? 'used' : null;
        }

        async function hasChildren(doc) {
          return Boolean(await self.apos.doc.db.findOne({
            path: new RegExp(`^${self.apos.util.regExpQuote(`${doc.path}/`)}`),
            aposLocale: doc.aposLocale,
            archived: { $ne: true },
            _id: { $nin: [ ...removed ] }
          }, { projection: { _id: 1 } }));
        }

        // Whether another document holds the document, in either mode, as
        // the revert leaves it. Relationships only: rich text holds content
        // inline, outside the related ids
        async function isUsed(doc) {
          const copies = await self.apos.doc.db
            .find({
              _id: {
                $in: [ doc._id, doc._id.replace(/:draft$/, ':published') ]
              }
            })
            .project({
              relatedReverseIds: 1,
              aposLocale: 1
            })
            .toArray();
          const ids = _.uniq(copies.flatMap(copy => copy.relatedReverseIds || []));
          if (!ids.length) {
            return false;
          }
          const referrers = await self.apos.doc.db
            .find({
              aposDocId: { $in: ids },
              aposLocale: {
                $in: [ ...copies.map(copy => copy.aposLocale || null), null ]
              },
              archived: { $ne: true }
            })
            .project({ _id: 1 })
            .toArray();
          return referrers.some(({ _id }) => {
            const after = planned.get(_id);
            return !after ||
              after.manager.getRelatedDocsIds(req, after.doc).includes(doc.aposDocId);
          });
        }
      }

      // Applies a patch as the PATCH route takes it to `doc` in memory, as a
      // save would, lossless unless it says otherwise, so `doc` ends as the
      // save would store it. Throws as the save would refuse
      async function applyPatch(draftReq, manager, doc, patch) {
        const input = _.cloneDeep({
          _lossless: true,
          ...patch
        });
        if (isPage(manager)) {
          await self.apos.page.applyPatch(draftReq, doc, input);
        } else {
          await manager.applyPatch(draftReq, doc, input);
        }
        self.apos.schema.prepareForStorage(draftReq, doc);
      }

      function isPage(manager) {
        return self.apos.instanceOf(manager, '@apostrophecms/page-type');
      }
    }
  };
};

// `[ outcome, { reason } ]` of a document from its rows' outcomes: kept when
// a row was edited or removed since, else not restorable, else put back
function summarize(rows) {
  const kept = rows.find(row => KEPT[row.outcome]);
  if (kept) {
    return [ 'kept', { reason: KEPT[kept.outcome] } ];
  }
  const unrestorable = rows.find(row => row.outcome === 'unrestorable');
  if (unrestorable) {
    return [ 'unrestorable', { reason: unrestorable.reason } ];
  }
  return [ rows.some(row => row.outcome === 'putBack') ? 'putBack' : 'reverted', {} ];
}

// An error that refuses a patch, as conversion throws its field errors
function isRefusal(e) {
  return Array.isArray(e) || [ 'invalid', 'forbidden', 'notfound' ].includes(e?.name);
}
