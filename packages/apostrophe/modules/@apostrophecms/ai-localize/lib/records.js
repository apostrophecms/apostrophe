// Localization records: the one marker of "a localization occurred". A
// record says that a document's copy in one locale was brought in line with
// its copy in another, and keeps both contents as they were at that moment:
// the source as it was when the work started, the target as the work left
// it. Core's whole-document localize writes one through `afterLocalize`; an
// AI pass that patched only what needed it writes one when it finishes.
//
// Nothing finer is tracked: no record of which change was carried over, nor
// which passage of one copy matches which of the other. The next pass gets
// the source's changes since the newest record and the target's own changes
// since then, and works out from both what is new in the source and what was
// done in the target alone and must be kept.
//
// Records are append-only; the newest one for a pair is the baseline.

// A record's contents are stored the way versions store a document: packed
// (see `@apostrophecms/document-versions`), so they cost little and are never
// queried into

// What a change list may run to, per text side
const CHANGE_TEXT_MAX_CHARS = 1500;

module.exports = (self) => {
  return {
    async ensureRecords() {
      self.recordsDb = await self.apos.db.collection(self.options.recordsCollection);
      await self.recordsDb.createIndex({
        aposDocId: 1,
        from: 1,
        to: 1,
        at: -1
      });
    },

    // A whole-document copy by core — the classic Localize flow, or the copy
    // that starts an AI pass — is a localization of everything: both halves
    // are the copied content. The AI flow suppresses it with
    // `req.aposAiLocalizeCopy`, since its copy is still untranslated and only
    // the pass that translates it may claim a localization. Related documents
    // such as images get records too: the AI flow translates their text
    async recordCoreLocalization(req, source, result, { target: to }) {
      if (req.aposAiLocalizeCopy) {
        return;
      }
      await self.insertRecord(req, {
        aposDocId: source.aposDocId,
        from: source.aposLocale.split(':')[0],
        to,
        via: 'localize',
        source: self.apos.util.clonePermanent(source),
        target: await self.storedDraft(result._id)
      });
    },

    async insertRecord(req, {
      aposDocId, from, to, via, source, target
    }) {
      const record = {
        _id: self.apos.util.generateId(),
        aposDocId,
        from,
        to,
        via,
        at: new Date(),
        ownerId: req.user?._id || null,
        ai: via === 'ai',
        source: await self.apos.docVersions.pack(source),
        target: await self.apos.docVersions.pack(target)
      };
      await self.recordsDb.insertOne(record);
      return record;
    },

    // The newest record for a pair. Its `via` says what made it: "localize",
    // core's whole-document copy; "ai", a finished AI pass; "copy", the copy
    // an AI pass starts from, which stands until that pass finishes and
    // means the target is still untranslated
    async latestRecord({
      aposDocId, from, to
    }) {
      return self.recordsDb.findOne({
        aposDocId,
        from,
        to
      }, { sort: { at: -1 } });
    },

    // A draft as stored, in the form versions store a document
    async storedDraft(_id) {
      const doc = await self.apos.doc.db.findOne({ _id });
      return doc && self.apos.util.clonePermanent(doc);
    },

    // What to compare from: the newest record between the two locales, in
    // either direction — a localization fr → en leaves both copies in line
    // just as one en → fr does, so after editing the French copy directly
    // the way back compares from there, the halves swapped. Failing that,
    // the version history as of the last whole-document copy between them,
    // which core stamps on the copy as `localizedAt` — inexact, since a
    // draft version may have been saved over after it; failing that,
    // nothing (`basis: 'none'`).
    //
    // A "copy" record is no baseline: it marks a copy still untranslated
    async getBaseline(req, { source, target }) {
      const from = source.aposLocale.split(':')[0];
      const to = target.aposLocale.split(':')[0];
      const record = await self.recordsDb.findOne({
        aposDocId: source.aposDocId,
        via: { $ne: 'copy' },
        $or: [
          {
            from,
            to
          },
          {
            from: to,
            to: from
          }
        ]
      }, { sort: { at: -1 } });
      if (record) {
        const forward = record.from === from;
        const recordSource = await self.apos.docVersions.unpack(record.source);
        const recordTarget = await self.apos.docVersions.unpack(record.target);
        return {
          basis: 'record',
          since: record.at,
          source: forward ? recordSource : recordTarget,
          target: forward ? recordTarget : recordSource
        };
      }
      // Whichever copy was made from the other; the later, if both were
      const since = latest(target.localizedAt, source.localizedAt) ||
        target.createdAt;
      const sourceThen = since && await self.versionAsOf(req, source, since);
      if (!sourceThen) {
        return { basis: 'none' };
      }
      return {
        basis: 'versions',
        since,
        source: sourceThen,
        target: await self.versionAsOf(req, target, since)
      };
    },

    // The content of `doc` as of `date` from its version history: the newest
    // version created by then, unless it was saved over afterwards — then
    // the newest one that was not. Comparing from too early lists changes the
    // translation may already have; comparing from too late would hide some,
    // which must never happen. `null` when there is no such version
    async versionAsOf(req, doc, date) {
      const versions = self.apos.docVersions;
      if (versions.isExcludedType(doc)) {
        return null;
      }
      const candidates = await versions.find(req, {
        ...versions.getTimelineCriteria(doc),
        createdAt: { $lte: date }
      }, {
        limit: 50,
        project: {
          _id: 1,
          createdAt: 1,
          updatedAt: 1
        },
        raw: true
      });
      const found = candidates
        .find((version) => (version.updatedAt || version.createdAt) <= date);
      if (!found) {
        return null;
      }
      return (await versions.findOne(req, { _id: found._id })).doc;
    },

    // Core's change list from one stored content to another, as entries the
    // model can act on: the address the write tools take, the place in the
    // editor's words, and the texts on both sides. Up to `budget`
    // characters; `omitted` counts the rest
    async changesBetween(req, older, newer, budget) {
      if (!older) {
        return {
          changes: [],
          omitted: 0
        };
      }
      const { rows } = await self.apos.docVersions.getChangeList(req, [ {
        older,
        newer,
        ai: false
      } ]);
      const changes = [];
      let size = 0;
      for (const row of rows) {
        const change = changeOf(row, req);
        size += JSON.stringify(change).length;
        if (size > budget) {
          break;
        }
        changes.push(change);
      }
      return {
        changes,
        omitted: rows.length - changes.length
      };
    }
  };
};

// One change row as the model can act on it: the innermost widget or array
// item by "@<_id>", then the field path inside it, with the editor's own
// wording of the place beside it, whose labels are mostly i18n keys
function changeOf(row, req) {
  let address = [];
  for (const segment of row.path) {
    address = segment.ordinal === undefined
      ? [ ...address, segment.name ]
      : [ `@${segment.name}` ];
  }
  const leaf = row.path.at(-1);
  // A rich text row stands at its widget; core's rich text keeps the markup
  // in "content"
  if (row.kind === 'richText' && leaf.widgetType === '@apostrophecms/rich-text') {
    address.push('content');
  }
  return {
    change: row.type,
    address: address.join('.'),
    where: row.path
      .map((segment) => segment.title || req.t(segment.label || segment.name))
      .join(' › '),
    kind: row.kind,
    ...(row.oldText && { oldText: clip(row.oldText) }),
    ...(row.oldText?.length > CHANGE_TEXT_MAX_CHARS && { oldTextClipped: true }),
    ...(row.newText && { newText: clip(row.newText) }),
    ...(row.newText?.length > CHANGE_TEXT_MAX_CHARS && { newTextClipped: true })
  };
}

// A long text is cut short for the change list, and marked so: the model
// must read it in full before writing it
function clip(text) {
  return text.length > CHANGE_TEXT_MAX_CHARS
    ? `${text.slice(0, CHANGE_TEXT_MAX_CHARS)}…`
    : text;
}

function latest(...dates) {
  return dates
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
}
