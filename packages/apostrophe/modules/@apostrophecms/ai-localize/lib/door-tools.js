// What this module gives the AI doors (the assistant, the MCP server), as
// `content` tools of the harness: no model runs here. A door's own model
// localizes with the harness's document tools; these tell it where two
// copies of a document stand. Registered only in a project with several
// locales.

// Characters of the result budget kept for what stands beside the lists
const HEADROOM = 600;

const VERSIONS_NOTE = 'The lists come from version history and may hold changes the ' +
  'target already has; check before writing.';
const UNTRANSLATED_NOTE = 'The copy was made for a localization that never finished: its ' +
  'text may still be in the source language. The lists are since that copy.';

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
          ...(await isParentMissing() && { parentMissing: true })
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

      // Core refuses to copy a page whose parent has no copy in the locale
      async function isParentMissing() {
        if (!self.apos.page.isPage(doc) || !doc.level) {
          return false;
        }
        return !await self.apos.doc.db.findOne({
          path: self.apos.page.getParentPath(doc),
          aposLocale: `${locale}:draft`
        }, { projection: { _id: 1 } });
      }

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

// What the model reads beside the tool's definition, for tests of what each
// door reads
module.exports.MODEL_TEXTS = [ VERSIONS_NOTE, UNTRANSLATED_NOTE ];
