// What this module gives the AI doors (the assistant, the MCP server), as
// `content` tools of the harness: no model runs here. A door's own model
// localizes with the harness's document tools; these tell it where two
// copies of a document stand, make a document's copy in another locale and
// record a localization once it is done. Registered only in a project with
// several locales.

// Characters of the result budget kept for what stands beside the lists
const HEADROOM = 600;

const VERSIONS_NOTE = 'The lists come from version history and may hold changes the ' +
  'target already has; check before writing.';
const UNTRANSLATED_NOTE = 'The copy was made for a localization that never finished: its ' +
  'text may still be in the source language. The lists are since that copy.';

// Why a copy into a locale, or its record, is refused, as the model reads it
const EXISTS = 'The document has a copy in this locale already, and a copy is never ' +
  'replaced; get_localization compares the two.';
const PARENT_MISSING = 'Its parent page has no copy in this locale; localize the parent first.';
const NO_COPY = 'The document has no copy in this locale; localize_document makes one.';
const UNREAD = 'The source was saved since you last read it, or you haven\'t read it: read ' +
  'it with get_localization, check nothing new is left to carry over, then record.';
const MAY_NOT_RECORD = 'The user may not edit the copy in this locale.';

module.exports = (self) => {
  return {
    registerDoorTools() {
      const locales = Object.keys(self.apos.i18n.locales);
      if (locales.length < 2) {
        return;
      }
      self.apos.ai.addTool({
        name: 'get_localization',
        label: 'apostrophe:aiToolGetLocalization',
        description: 'One document against its copy in another locale. "state": ' +
          '"missing" (no copy there; "parentMissing" when its parent page has none ' +
          'either), "untranslated" (the copy is still in the source language), ' +
          '"upToDate", "behind", or "noBaseline" (nothing says when the copies were ' +
          'last in line). "sourceChanges" and "targetChanges": what each copy changed ' +
          'since then, as get_changes rows, each "path" usable in its own copy. ' +
          '"counterpart": the other copy holds a widget or item of the same id, so the ' +
          'path works there as it is; when false, find the place by meaning and ' +
          'position. "changedInTarget": the target changed the same spot too. "place": ' +
          'a widget\'s area and spot in the source, with "counterpart" when the target ' +
          'has that spot.',
        input: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              minLength: 1,
              description: 'A document id: the source'
            },
            locale: {
              type: 'string',
              enum: locales,
              description: 'The locale of the copy to compare with'
            },
            widgets: {
              type: 'array',
              items: {
                type: 'string',
                minLength: 1
              },
              minItems: 1,
              maxItems: 50,
              uniqueItems: true,
              description: 'Only these widgets of the source, by id: each listed with ' +
                'its hints, changed or not'
            },
            offset: {
              type: 'string',
              pattern: '^\\d+:\\d+$',
              description: 'The "next" of the previous read'
            }
          },
          required: [ '_id', 'locale' ],
          additionalProperties: false
        },
        maxResultChars: self.apos.harness.getReadBudget('document'),
        tags: [ 'content' ],
        kind: 'query',
        handler: '@apostrophecms/ai-localize:getLocalization'
      });
      const targetLocales = description => ({
        type: 'array',
        items: {
          type: 'string',
          enum: locales
        },
        minItems: 1,
        uniqueItems: true,
        description
      });
      self.apos.ai.addTool({
        name: 'localize_document',
        label: 'apostrophe:aiToolLocalizeDocument',
        description: 'Make a document\'s copy in each locale given where it has none: the ' +
          'same document in the same place, its content in the source language until ' +
          'translated with update_document, then record_localization. Never replaces a ' +
          'copy. A page needs its parent\'s copy there.',
        input: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              minLength: 1,
              description: 'A document id: the source'
            },
            locales: targetLocales('The locales to copy it into'),
            related: {
              type: 'boolean',
              default: false,
              description: 'First copy the documents it relates to, such as images, that ' +
                'have no copy there, so it keeps them'
            }
          },
          required: [ '_id', 'locales' ],
          additionalProperties: false
        },
        tags: [ 'content' ],
        kind: 'action',
        handler: '@apostrophecms/ai-localize:localizeDocument'
      });
      self.apos.ai.addTool({
        name: 'record_localization',
        label: 'apostrophe:aiToolRecordLocalization',
        description: 'Record that the copies in these locales are in line with the source ' +
          'as you last read it: get_localization compares from here on. Only once every ' +
          'source change is carried over, never for part of a document. Refused when the ' +
          'source was saved since your last read.',
        input: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              minLength: 1,
              description: 'A document id: the source'
            },
            locales: targetLocales('The locales of the copies brought in line')
          },
          required: [ '_id', 'locales' ],
          additionalProperties: false
        },
        tags: [ 'content' ],
        kind: 'action',
        handler: '@apostrophecms/ai-localize:recordLocalization'
      });
    },

    // Whether core would refuse to copy a page into `locale` for want of
    // its parent's copy there
    async isParentMissing(doc, locale) {
      if (!self.apos.page.isPage(doc) || !doc.level) {
        return false;
      }
      return !await self.apos.doc.db.findOne({
        path: self.apos.page.getParentPath(doc),
        aposLocale: `${locale}:draft`
      }, { projection: { _id: 1 } });
    },

    async localizeDocument(req, {
      _id, locales, related = false
    }) {
      const { harness } = self.apos;
      const found = await harness.findReadable(req, _id);
      const from = checkLocales(self, found.doc, locales);
      const manager = self.apos.doc.getManager(found.doc.type);
      const source = await self.docModuleFor(manager)
        .findForEditing(found.draftReq, { _id: found.doc._id })
        .toObject();
      if (!source || !self.apos.ai.can(found.draftReq, 'edit', source)) {
        throw self.apos.error('aiToolError', 'The user may not edit this document, so it ' +
          'can\'t be localized.');
      }
      const written = [];
      const refused = [];
      for (const locale of locales) {
        const refusal = await getRefusal(source, locale);
        if (refusal) {
          refused.push(refusal);
          continue;
        }
        if (related) {
          for (const other of await getMissingRelated(locale)) {
            await localize(other, locale, { related: true });
          }
        }
        await localize(source, locale);
      }
      return harness.getWriteResult({
        written,
        refused
      });

      // Why the copy of `doc` into `locale` would be refused, `null` when
      // nothing says so before trying
      async function getRefusal(doc, locale, more = {}) {
        const header = {
          title: doc.title,
          locale,
          ...more
        };
        const existing = await self.storedDraft(`${doc.aposDocId}:${locale}:draft`);
        if (existing) {
          return {
            _id: existing._id,
            ...header,
            reason: 'exists',
            message: EXISTS
          };
        }
        if (await self.isParentMissing(doc, locale)) {
          return {
            ...header,
            reason: 'parentMissing',
            message: PARENT_MISSING
          };
        }
        if (!self.apos.ai.can(found.draftReq.clone({ locale }), 'create', doc.type, 'draft')) {
          return {
            ...header,
            ...harness.describeRefusal(self.apos.error('forbidden', { create: true }))
          };
        }
        return null;
      }

      async function localize(doc, locale, more = {}) {
        const refusal = more.related && await getRefusal(doc, locale, more);
        if (refusal) {
          refused.push(refusal);
          return;
        }
        let copy;
        try {
          copy = await self.localizeUntranslated(req, doc, locale);
        } catch (e) {
          refused.push({
            title: doc.title,
            locale,
            ...more,
            ...describeError(e)
          });
          return;
        }
        const copyReq = req.clone({
          locale,
          mode: 'draft'
        });
        // Read back for the URL the type's own query adds
        const loaded = await self.apos.doc.getManager(copy.type)
          .find(copyReq, { _id: copy._id })
          .relationships(false)
          .toObject();
        written.push({
          _id: copy._id,
          title: copy.title,
          type: copy.type,
          locale,
          slug: copy.slug,
          ...(loaded?._url && { url: loaded._url }),
          ...harness.getPublishState(copy.type),
          ...more,
          doc: copy
        });
      }

      // The documents the source relates to, in its locale, that the user
      // may read and that have no copy in `locale`, as core's Localize finds
      // them: only types that are localized and not kept out of related
      // documents
      async function getMissingRelated(locale) {
        const ids = manager.getRelatedDocsIds(found.draftReq, source);
        if (!ids.length) {
          return [];
        }
        const copied = new Set((await self.apos.doc.db
          .find({
            aposDocId: { $in: ids },
            aposLocale: `${locale}:draft`
          })
          .project({ aposDocId: 1 })
          .toArray())
          .map(doc => doc.aposDocId));
        const missing = ids.filter(id => !copied.has(id));
        const docs = [];
        for (const aposDocId of [ ...new Set(missing) ]) {
          const stored = await self.apos.doc.db.findOne({
            aposDocId,
            aposLocale: `${from}:draft`
          }, { projection: { type: 1 } });
          const relatedManager = stored && self.apos.doc.getManager(stored.type);
          if (!relatedManager?.isLocalized() ||
            (relatedManager.options.relatedDocument === false)) {
            continue;
          }
          const doc = await self.docModuleFor(relatedManager)
            .findForEditing(found.draftReq, { _id: stored._id })
            .permission('view')
            .toObject();
          if (doc && self.apos.ai.can(found.draftReq, 'view', doc)) {
            docs.push(doc);
          }
        }
        return docs;
      }

      function describeError(e) {
        if (e.data?.parentNotLocalized) {
          return {
            reason: 'parentMissing',
            message: PARENT_MISSING
          };
        }
        if (e.name === 'conflict') {
          return {
            reason: 'exists',
            message: EXISTS
          };
        }
        if ([ 'forbidden', 'locked', 'invalid', 'notfound' ].includes(e.name)) {
          return harness.describeRefusal(e);
        }
        throw e;
      }
    },

    async recordLocalization(req, { _id, locales }) {
      const { harness } = self.apos;
      const { doc, draftReq } = await harness.findReadable(req, _id);
      const from = checkLocales(self, doc, locales);
      const written = [];
      const refused = [];
      for (const locale of locales) {
        const targetId = `${doc.aposDocId}:${locale}:draft`;
        // Read for each locale: a record says what the source was as read
        const source = await self.storedDraft(doc._id);
        const target = await self.storedDraft(targetId);
        const header = {
          title: doc.title,
          locale
        };
        if (!target) {
          refused.push({
            ...header,
            reason: 'notfound',
            message: NO_COPY
          });
          continue;
        }
        const targetReq = draftReq.clone({ locale });
        if (!self.apos.ai.can(targetReq, 'edit', target)) {
          refused.push({
            _id: targetId,
            ...header,
            reason: 'forbidden',
            message: MAY_NOT_RECORD
          });
          continue;
        }
        const seen = harness.getDoor(req)?.seen.get(source._id);
        if (!seen || (new Date(seen).getTime() !== source.updatedAt?.getTime())) {
          refused.push({
            _id: targetId,
            ...header,
            reason: 'changed',
            message: UNREAD
          });
          continue;
        }
        const record = await self.insertRecord(req, {
          aposDocId: doc.aposDocId,
          from,
          to: locale,
          via: 'ai',
          source,
          target
        });
        written.push({
          _id: targetId,
          title: target.title,
          type: target.type,
          locale,
          since: record.at
        });
      }
      return {
        written,
        ...(refused.length && { refused })
      };
    },

    async getLocalization(req, {
      _id, locale, widgets, offset = '0:0'
    }) {
      const { harness, docVersions } = self.apos;
      const { doc, draftReq } = await harness.findReadable(req, _id);
      const from = harness.getLocaleOf(doc);
      if (!from) {
        throw self.apos.error('aiToolError', 'Documents of this type exist once, not per locale.');
      }
      if (from === locale) {
        throw self.apos.error('aiToolError', `The document is the "${locale}" copy; name ` +
          'another locale.');
      }
      const header = {
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        locale: from
      };
      const targetId = `${doc.aposDocId}:${locale}:draft`;
      const stored = await self.storedDraft(targetId);
      if (!stored) {
        return {
          ...header,
          state: 'missing',
          ...(await self.isParentMissing(doc, locale) && { parentMissing: true })
        };
      }
      const target = await findTarget();
      const targetReq = target.draftReq;
      for (const [ copyReq, copy ] of [ [ draftReq, doc ], [ targetReq, target.doc ] ]) {
        if (!self.apos.ai.can(copyReq, 'edit', copy)) {
          throw self.apos.error('aiToolError', 'The user may not see the changes of the ' +
            `"${harness.getLocaleOf(copy)}" copy.`);
        }
      }
      const source = await self.storedDraft(doc._id);
      const sourceIndex = harness.getContentIndex(draftReq, source);
      const targetIndex = harness.getContentIndex(targetReq, stored);
      const unknown = (widgets || [])
        .filter(id => sourceIndex.get(id)?.kind !== 'widget');
      if (unknown.length) {
        throw self.apos.error('aiToolError', `No widget ${unknown.map(id => `"${id}"`).join(', ')} ` +
          'in the source; get_document lists its widgets.');
      }
      const baseline = await getBaseline();
      const lists = (baseline.basis === 'none')
        ? {
          source: [],
          target: []
        }
        : {
          source: await getRows(draftReq, source, baseline.source),
          target: await getRows(targetReq, stored, baseline.target)
        };
      // A door's write to either copy saved since this read is refused
      await harness.rememberSeen(draftReq, doc, { read: true });
      await harness.rememberSeen(targetReq, target.doc, { read: true });
      const result = {
        ...header,
        target: {
          _id: stored._id,
          title: stored.title,
          locale
        },
        state: getState(),
        ...((baseline.basis !== 'none') && {
          since: baseline.since,
          basis: baseline.basis,
          ...await getLocalizer()
        }),
        ...((baseline.basis === 'versions') && { note: VERSIONS_NOTE }),
        ...(baseline.untranslated && { note: UNTRANSLATED_NOTE }),
        ...(widgets && { widgets: widgets.map(describeWidget) })
      };
      const within = row => !widgets || widgets.some(id => namesOf(row).includes(id));
      const sourceRows = lists.source.filter(within).flatMap(row => {
        return render(draftReq, source, row, targetIndex, {
          ...(lists.target.some(other => isSameSpot(row, other)) && {
            changedInTarget: true
          })
        });
      });
      const targetRows = lists.target.filter(within).flatMap(row => {
        return render(targetReq, stored, row, sourceIndex);
      });
      // Half the room each, what the source leaves going to the target: the
      // source's list is the one to carry over
      const room = self.apos.ai.getTool('get_localization').maxResultChars -
        HEADROOM - JSON.stringify(result).length;
      const [ sourceOffset, targetOffset ] = offset.split(':').map(Number);
      const sourcePage = harness
        .pageChangeRows(sourceRows, sourceOffset, Math.floor(room / 2));
      const targetPage = harness
        .pageChangeRows(targetRows, targetOffset, room - sourcePage.size);
      const next = [
        sourcePage.next ?? sourceRows.length,
        targetPage.next ?? targetRows.length
      ];
      const more = (next[0] < sourceRows.length) || (next[1] < targetRows.length);
      return {
        ...result,
        sourceChanges: sourcePage.rows,
        targetChanges: targetPage.rows,
        ...(more && { next: next.join(':') })
      };

      // The copy as the user reads it; one the user can't read is no copy
      // to compare with, and not a missing one either
      async function findTarget() {
        try {
          const found = await harness.findDraft(req, targetId);
          if (self.apos.ai.can(found.draftReq, 'view', found.doc)) {
            return found;
          }
        } catch (e) {
          if (e.name !== 'notfound') {
            throw e;
          }
        }
        throw self.apos.error('aiToolError', `The user can't read the "${locale}" copy of ` +
          'this document.');
      }

      // What both lists compare from. The copy an unfinished localization
      // left is in line with the source as it was copied, only untranslated
      async function getBaseline() {
        const latest = await self.latestRecord({
          aposDocId: doc.aposDocId,
          from,
          to: locale
        });
        if (latest?.via !== 'copy') {
          return self.getBaseline(draftReq, {
            source,
            target: stored
          });
        }
        return {
          basis: 'record',
          untranslated: true,
          since: latest.at,
          ownerId: latest.ownerId,
          source: await docVersions.unpack(latest.source),
          target: await docVersions.unpack(latest.target)
        };
      }

      // The changes of one copy since the baseline, as Document Versions
      // lists them, each credited to the versions saved since
      async function getRows(copyReq, copy, older) {
        if (!older) {
          return [];
        }
        const { rows } = await docVersions.getChangesSince(copyReq, copy, older, {
          after: baseline.since,
          savedOver: true
        });
        // Only what AI reads counts, on either side
        return rows.filter(row => harness.renderChangeRow(copyReq, copy, row).length);
      }

      function getState() {
        if (baseline.untranslated) {
          return 'untranslated';
        }
        if (baseline.basis === 'none') {
          return 'noBaseline';
        }
        return lists.source.length ? 'behind' : 'upToDate';
      }

      // Who brought the copies in line last, when a record says
      async function getLocalizer() {
        const user = baseline.ownerId && await self.apos.doc.db.findOne(
          { _id: baseline.ownerId },
          { projection: { title: 1 } }
        );
        return {
          ...(user?.title && { by: user.title }),
          ...((baseline.via === 'ai') && { ai: true })
        };
      }

      // A row as the door reads it, with what the server knows of the
      // other copy: whether it holds the row's widget or item, and an added
      // widget's place
      function render(copyReq, copy, row, otherIndex, hints = {}) {
        const id = getAnchor(row)[0];
        return harness.renderChangeRow(copyReq, copy, row).map(rendered => ({
          ...rendered,
          ...(id.startsWith('@') && { counterpart: otherIndex.has(id.slice(1)) }),
          ...hints,
          ...(rendered.place && { place: withCounterpart(rendered.place, otherIndex) })
        }));
      }

      // A widget of `widgets` as the source holds it
      function describeWidget(id) {
        const {
          type, area, after
        } = sourceIndex.get(id);
        const at = row => namesOf(row).includes(id);
        return {
          _id: id,
          type,
          counterpart: targetIndex.get(id)?.kind === 'widget',
          ...((baseline.basis !== 'none') && { changed: lists.source.some(at) }),
          ...(lists.target.some(at) && { changedInTarget: true }),
          place: withCounterpart({
            area,
            ...(after ? { after } : { position: 0 })
          }, targetIndex)
        };
      }
    }
  };
};

// The locale of `doc`, the source of a copy into each of `locales`; a tool
// error the model can act on when it has none or is among them
function checkLocales(self, doc, locales) {
  const from = self.apos.harness.getLocaleOf(doc);
  if (!from) {
    throw self.apos.error('aiToolError', 'Documents of this type exist once, not per locale.');
  }
  if (locales.includes(from)) {
    throw self.apos.error('aiToolError', `The document is the "${from}" copy; name only ` +
      'other locales.');
  }
  return from;
}

// The names along a row's path: fields, and the ids of widgets and items
function namesOf(row) {
  return row.path.map(segment => segment.name);
}

// A row's path from the innermost widget or item it is in, that one as
// "@<id>": where the row is, whatever is above it
function getAnchor(row) {
  let anchor = [];
  for (const segment of row.path) {
    anchor = ((segment.ordinal !== undefined) && segment.name)
      ? [ `@${segment.name}` ]
      : [ ...anchor, segment.name ];
  }
  return anchor;
}

// Whether two rows, one of each copy, are at one spot: one at, above or
// below the other, by the whole path or from the same widget or item. An
// order is the same spot only as the same order
function isSameSpot(one, two) {
  const isOrder = row => [ 'area', 'array' ].includes(row.kind);
  const isRelated = (first, second) => {
    const length = Math.min(first.length, second.length);
    return first.slice(0, length).every((name, i) => name === second[i]);
  };
  if (isOrder(one) || isOrder(two)) {
    return isOrder(one) && isOrder(two) && (namesOf(one).join() === namesOf(two).join());
  }
  const [ first, second ] = [ getAnchor(one), getAnchor(two) ];
  return isRelated(namesOf(one), namesOf(two)) ||
    (first[0].startsWith('@') && isRelated(first, second));
}

// A place in one copy with whether the other has it: its area, and the
// widget before in that area
function withCounterpart(place, otherIndex) {
  const holder = place.area.startsWith('@') && place.area.split('.')[0].slice(1);
  const hasArea = !holder || otherIndex.has(holder);
  const hasSpot = !place.after || (otherIndex.get(place.after)?.area === place.area);
  return {
    ...place,
    counterpart: hasArea && hasSpot
  };
}

// What the model reads beside the tools' definitions, for tests of what each
// door reads
module.exports.MODEL_TEXTS = [
  VERSIONS_NOTE,
  UNTRANSLATED_NOTE,
  EXISTS,
  PARENT_MISSING,
  NO_COPY,
  UNREAD,
  MAY_NOT_RECORD
];
