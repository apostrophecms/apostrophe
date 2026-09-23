// Records versions of every localized, manually published document: one on
// each publish and one per handoff of draft work, and lets editors browse
// and restore them.
// Versions live in the `aposDocsVersions` collection. A record's `doc` is
// stored packed (see `pack`) and the finders unpack it, so queries never
// reach into `doc`: everything they need is a top-level field.

const { promisify } = require('node:util');
const zlib = require('node:zlib');
const { createId } = require('@paralleldrive/cuid2');
const { stripIndent } = require('common-tags');
const diff = require('./lib/diff.js');
const text = require('./lib/text.js');
const consolidation = require('./lib/consolidation.js');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// A `versions: false` type still keeps its two newest publication points per
// document and locale: Unpublish returns to the one before the current
const PUBLISHED_ONLY_LIMIT = 2;

// A version as the attachment module knows it: an archived document that
// holds the attachments its content uses
function asAttachmentDoc(version) {
  return {
    ...version.doc,
    _id: version._id,
    archived: true
  };
}

// The versions `criteria` names that are older than `date`
function olderThan(criteria, date) {
  return {
    ...criteria,
    createdAt: { $lt: date }
  };
}

module.exports = {
  options: {
    alias: 'docVersions',
    label: 'apostrophe:versionLabel',
    pluralLabel: 'apostrophe:versionPluralLabel',
    components: {
      versions: 'AposDocVersions'
    },
    // Draft saves replace the newest draft version in place until this much
    // time, in milliseconds, has passed since that version was created. Then
    // a new version starts. One day by default
    draftInterval: 24 * 60 * 60 * 1000,
    // `Intl.DateTimeFormat` options for version timestamps. Unset, the list
    // shows a compact date and time, with the year only when it is not the
    // current one
    dateTimeFormatOptions: null
  },
  icons: {
    'creation-icon': 'Creation',
    'filter-variant-icon': 'FilterVariant',
    'minus-circle-icon': 'MinusCircle',
    'plus-circle-icon': 'PlusCircle'
  },
  async init(self) {
    self.defaultLimit = 10;
    // Versions per query when reading a sequence (see `getSequenceFrom`)
    self.sequenceBatchLimit = 100;
    self.defaultSort = { createdAt: -1 };

    self.addEditorModal();
    self.enableBrowserData();
    await self.enableCollection();
    await self.createIndexes();
    self.addMigrations();
    self.apos.attachment.addDocSource(self.__meta.name, self.eachVersionDoc);
  },

  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        checkLegacyModule() {
          self.checkLegacyModule();
        },
        addContextMenu() {
          self.addContextMenu();
        }
      },
      '@apostrophecms/doc-type:afterSave': {
        async saveVersion(req, doc) {
          await self.saveFor(req, doc, await self.canHaveVersion(req, doc));
        }
      },
      '@apostrophecms/doc:afterAllModesDeleted': {
        async deleteVersion(req, doc) {
          await self.removeAllFor(req, doc);
        }
      },
      '@apostrophecms/doc:afterChangeDocIds': {
        async followDocIds(pairs, { keep, skipReplace }) {
          // The old documents stay, and so do their versions
          if (skipReplace) {
            return;
          }
          const renamed = new Map();
          for (const [ from, to ] of pairs) {
            await self.changeDocId(from, to, { keep });
            const [ oldId ] = from.split(':');
            const [ newId ] = to.split(':');
            if (oldId !== newId) {
              renamed.set(oldId, newId);
            }
          }
          for (const [ oldId, newId ] of renamed) {
            await self.replaceDocIdInVersions(oldId, newId);
          }
        }
      }
    };
  },

  restApiRoutes(self) {
    return {
      // The versions of the document `docId` (its `_id`), newest first, a page at
      // a time. `next` is the `before` of the following page, `null` on the last.
      // `consolidate=1` lists consolidated versions (see `getTimelinePage`).
      // The newest item is `live` when it is the draft, so a restore of it
      // would change nothing
      async getAll(req) {
        const docId = self.apos.launder.id(req.query.docId, '');
        const before = self.apos.launder.string(req.query.before);
        const beforeDate = before ? new Date(before) : null;

        if (!docId || (beforeDate && isNaN(beforeDate))) {
          throw self.apos.error('invalid');
        }
        const doc = await self.getRestDocQuery(req.clone({ mode: 'draft' }))
          .and({ _id: docId.replace(/:[\w]+$/, ':draft') })
          .toObject();

        if (!doc || self.isExcludedType(doc)) {
          throw self.apos.error('notfound');
        }

        const page = await self.getTimelinePage(req, self.getTimelineCriteria(doc), {
          before: beforeDate,
          consolidate: self.apos.launder.boolean(req.query.consolidate)
        });
        // A newest draft version is the draft; a newest publication is the
        // draft unless the draft has unpublished changes
        const [ newest ] = page.results;
        if (!beforeDate && newest && (newest.mode === 'draft' || !doc.modified)) {
          newest.live = true;
        }
        return page;
      },
      // One version with its document. `annotate=1` marks the document with the
      // changes of the version; `consolidate=1` with those of the consolidated
      // version it is the newest of (see `getOne`)
      getOne(req, versionId) {
        return self.getOne(req, versionId, {
          annotate: self.apos.launder.boolean(req.query.annotate),
          consolidate: self.apos.launder.boolean(req.query.consolidate)
        });
      }
    };
  },

  apiRoutes(self) {
    return {
      get: {
        // The change list of a version; with `consolidate=1`, of the consolidated
        // version it is the newest of
        ':versionId/changes': (req) => {
          return self.getVersionChanges(req, req.params.versionId, {
            consolidate: self.apos.launder.boolean(req.query.consolidate)
          });
        }
      }
    };
  },

  tasks(self) {
    return {
      'set-change-count': {
        usage: stripIndent`
          Usage: node app @apostrophecms/document-versions:set-change-count

          This sets the changeCount of all existing document versions.
        `,
        task: self.setChangeCountTask
      },
      'convert-legacy-versions': {
        usage: stripIndent`
          Usage: node app @apostrophecms/document-versions:convert-legacy-versions

          Converts version records still in the legacy format. The
          convert-legacy-versions migration does this once; run this task when legacy
          records were written afterwards, for instance by an instance of the site
          still running older code during a deployment.
        `,
        async task() {
          const converted = await self.convertLegacyVersions();
          self.logInfo(
            'convert-legacy-versions-complete',
            `Converted ${converted} legacy document versions`,
            { converted }
          );
        }
      },
      'rename-locale': {
        usage: stripIndent`
          Usage: node app @apostrophecms/document-versions:rename-locale --old=de-DE --new=de-de

          Renames a locale in the version records only. Optional: --keep=de-de
          The @apostrophecms/i18n:rename-locale task already renames version records;
          use this one to repair versions that were left behind.
        `,
        async task(argv) {
          const oldLocale = self.apos.launder.string(argv.old);
          const newLocale = self.apos.launder.string(argv.new);
          const keep = self.apos.launder.string(argv.keep);

          const {
            renamed,
            kept
          } = await self.renameLocale(oldLocale, newLocale, { keep });
          self.logInfo(
            'rename-locale-complete',
            `Renamed ${renamed} document versions from ${oldLocale} to ${newLocale}`,
            {
              renamed,
              oldLocale,
              newLocale
            }
          );

          if (keep) {
            self.logInfo(
              'rename-locale-conflicts',
              `Due to conflicts, kept ${kept} document versions from ${keep}`,
              {
                kept,
                keep
              }
            );
          }
        }
      }
    };
  },

  methods(self) {
    return {
      async enableCollection() {
        self.db = await self.apos.db.collection('aposDocsVersions');
      },
      async createIndexes() {
        await self.db.createIndex({
          docId: 1,
          createdAt: -1
        });
      },
      addMigrations() {
        self.apos.migration.add('convert-legacy-versions', self.convertLegacyVersions);
        self.apos.migration.add('seed-publication-points', self.seedPublicationPoints);
        self.apos.migration.add('remove-previous-mode-docs', self.removePreviousModeDocs);
        self.apos.migration.add('set-legacy-change-counts', self.setChangeCountTask);
      },
      addContextMenu() {
        self.apos.doc.addContextOperation({
          moduleName: self.__meta.name,
          context: 'update',
          action: 'versions',
          label: self.options.pluralLabel,
          modal: self.getComponentName('versions', 'AposDocVersions'),
          moduleIf: {
            versions: true
          },
          conditions: [ 'canEdit' ]
        });
      },
      addEditorModal() {
        self.apos.modal.add(
          `${self.__meta.name}:editor`,
          self.getComponentName('versions', 'AposDocVersions'),
          { moduleName: self.__meta.name }
        );
      },
      getBrowserData(req) {
        return {
          action: self.action,
          dateTimeFormatOptions: self.options.dateTimeFormatOptions,
          label: self.options.label,
          pluralLabel: self.options.pluralLabel,
          components: {
            versions: 'AposDocVersions'
          },
          name: self.__meta.name
        };
      },
      // The package this module replaces recorded versions of its own into
      // the same collection, in a shape these finders reject. Its deprecation
      // release carries no methods and may stay installed; any earlier
      // release must not run next to this module.
      checkLegacyModule() {
        const legacy = self.apos.modules['@apostrophecms-pro/document-versions'];
        if (legacy && typeof legacy.createFor === 'function') {
          throw new Error(stripIndent`
            @apostrophecms-pro/document-versions is installed alongside the core
            @apostrophecms/document-versions module and would record versions of its own.
            Remove it from the project.
          `);
        }
      },
      // Whether a doc type module records versions, from its options.
      // `versions` wins over `autopublish` and `localized`.
      hasVersions(moduleOptions) {
        const {
          versions,
          autopublish,
          localized
        } = moduleOptions;

        if (versions === false) {
          return false;
        }

        if (versions !== true) {
          if (autopublish === true || localized === false) {
            return false;
          }
        }

        return true;
      },
      // Whether a doc type marked `versions: false` still records its
      // publication points. A localized type published by hand keeps
      // Unpublish, which returns to the previous publication; nothing else
      // is recorded for it and it has no versions UI
      recordsPublishedOnly(moduleOptions) {
        const {
          versions,
          autopublish,
          localized
        } = moduleOptions;
        return versions === false && autopublish !== true && localized !== false;
      },
      // Whether the module keeps this document's full history: its type has
      // versions and it is not archived, which also leaves the archive page out
      isVersioned(doc) {
        const manager = self.apos.doc.getManager(doc.type);
        return Boolean(manager) && self.hasVersions(manager.options) && !doc.archived;
      },
      // Whether the module keeps only this document's publication points
      isPublishedOnly(doc) {
        const manager = self.apos.doc.getManager(doc.type);
        return Boolean(manager) &&
          self.recordsPublishedOnly(manager.options) &&
          !doc.archived;
      },
      // Whether a document's type has no versions to show: its manager is
      // known and does not have them. The records of a type whose module
      // is gone stay readable
      isExcludedType(doc) {
        const manager = self.apos.doc.getManager(doc.type);
        return Boolean(manager) && !self.hasVersions(manager.options);
      },
      // The mode a version records: the document's, or `published` for
      // documents without modes
      getMode(doc) {
        return doc.aposMode || 'published';
      },
      // The locale of a document without its mode suffix, `null` when the
      // type is not localized
      getLocale(doc) {
        return doc.aposLocale
          ? doc.aposLocale.split(':')[0]
          : null;
      },
      // One document's history in one locale. The draft and the published
      // copy share `aposDocId`, so the pair identifies the timeline whatever
      // mode each version was saved in
      getTimelineCriteria(doc) {
        return {
          docId: doc.aposDocId,
          locale: self.getLocale(doc)
        };
      },
      // The `_id` of the user saving, `null` when there is none (system)
      getAuthorId(req) {
        return req.user?._id ?? null;
      },
      // Decides what a save does to the document's history. Returns `false` to
      // record nothing, `true` to record a new version, or the `_id` of the
      // newest draft version for the save to replace in place.
      //
      // "Changed" below means the change list would have a row (see
      // `getChangeCount`), so a recorded version always has a change to show.
      //
      // Nothing is recorded for:
      // - a request flagged `aposSkipVersion`
      // - a save that takes the document out of the archive, whose slug is still
      //   the deduplicated one
      // - an archived document or a type without versions. A `versions: false`
      //   type records its published saves and nothing else
      // - the draft of an autopublish type: its publication is the version
      //
      // A restore always records a new version.
      //
      // A published save, when the newest version is:
      // - a publication point: a new version if the content changed, nothing
      //   otherwise
      // - a draft with the same content: this is the publish of that draft. The
      //   draft becomes the publication point when it has the same author and AI
      //   involvement and is not a restore; otherwise a new version. This
      //   holds even when the content equals the last publication
      // - a draft with other content: the save did not come from that draft (a
      //   page with draft edits was moved). A new version if the content
      //   changed since the newest publication point, nothing otherwise
      //
      // A draft save:
      // - a new version when the document has none
      // - nothing when nothing changed since the newest version
      // - a new version at a handoff: an explicit Save Draft, another author, a
      //   change in AI involvement, a newest version that is a publication point
      //   or a restore, or one older than `draftInterval`
      // - otherwise replaces the newest version
      async canHaveVersion(req, doc) {
        if (req.aposSkipVersion) {
          return false;
        }
        if (!doc.archived && doc.aposWasArchived) {
          return false;
        }
        if (self.isPublishedOnly(doc)) {
          return self.getMode(doc) === 'published';
        }
        if (!self.isVersioned(doc)) {
          return false;
        }
        if (isAutopublishedDraft(doc)) {
          return false;
        }
        if (req.aposRestoreVersion) {
          return true;
        }
        const previous = await self.findOne(req, self.getTimelineCriteria(doc));
        if (self.getMode(doc) === 'published') {
          if (!previous) {
            return true;
          }
          const unchanged = !self.getChangeCount(req, doc, previous.doc);
          if (previous.mode === 'published') {
            // The content already published, saved again
            return !unchanged;
          }
          if (unchanged) {
            // The publish of the newest draft: promote it when allowed
            const promotable = !previous.restoredFrom &&
              previous.authorId === self.getAuthorId(req) &&
              Boolean(previous.ai) === Boolean(req.aposAi);
            return promotable ? previous._id : true;
          }
          // The save did not come from the newest draft: compare with the newest
          // publication point
          const publication = await self.findOne(req, {
            ...self.getTimelineCriteria(doc),
            mode: 'published'
          });
          return !publication ||
            Boolean(self.getChangeCount(req, doc, publication.doc));
        }
        if (!previous) {
          return true;
        }
        if (!self.getChangeCount(req, doc, previous.doc)) {
          return false;
        }
        if (req.aposExplicitSave) {
          return true;
        }
        if (previous.mode === 'published' || previous.restoredFrom) {
          return true;
        }
        if (previous.authorId !== self.getAuthorId(req)) {
          return true;
        }
        if (Boolean(previous.ai) !== Boolean(req.aposAi)) {
          return true;
        }
        const updatedAt = doc.updatedAt || new Date();
        if (updatedAt - previous.createdAt > self.options.draftInterval) {
          return true;
        }
        return previous._id;

        // Whether `doc` is the draft of a type that publishes automatically.
        // Every save of such a draft is republished at once, and that
        // publication is the version
        function isAutopublishedDraft(doc) {
          const manager = self.apos.doc.getManager(doc.type);
          return Boolean(manager?.options.autopublish) && self.getMode(doc) === 'draft';
        }
      },
      // Records a save as `canHaveVersion` decided: nothing for `false`,
      // a new version for `true`, otherwise the replacement of the version
      // whose `_id` the decision is. Returns the version written, if any
      async saveFor(req, doc, decision) {
        if (!decision) {
          return;
        }
        if (typeof decision === 'string') {
          return self.replaceVersion(req, doc, decision);
        }
        const version = await self.insertVersion(req, doc);
        if (self.isPublishedOnly(doc)) {
          await trimPublishedOnly(req, doc);
        }
        return version;

        // Drop the publication points of `doc` beyond the ones Unpublish
        // needs, for a type that records published versions only
        async function trimPublishedOnly(req, doc) {
          const surplus = await self.find(req, {
            ...self.getTimelineCriteria(doc),
            mode: 'published'
          }, {
            skip: PUBLISHED_ONLY_LIMIT,
            project: { _id: 1 },
            raw: true
          });
          if (surplus.length) {
            await self.removeVersions(req, {
              _id: { $in: surplus.map(version => version._id) }
            });
          }
        }
      },
      // Insert a new version of `doc` at the head of its timeline. A
      // restore is a baseline and counts no changes
      async insertVersion(req, doc) {
        const version = await self.newVersion(req, doc);
        const previous = !version.restoredFrom &&
          await self.findOne(req, self.getTimelineCriteria(doc));
        const instance = {
          ...version,
          changeCount: previous
            ? self.getChangeCount(req, doc, previous.doc)
            : 0
        };
        await self.insert(req, instance);
        return self.updateReferencesFor(req, instance._id);
      },
      // Replace the content of the version `versionId` with `doc`; the record
      // keeps its `_id` and author. A draft that becomes a publication point
      // takes the publish time as `createdAt`. The change count is recomputed.
      // Inserts a new version when that one is gone
      async replaceVersion(req, doc, versionId) {
        const version = await self.findOne(req, { _id: versionId }, { raw: true });
        if (!version) {
          return self.insertVersion(req, doc);
        }
        const before = await self.getPreviousVersion(req, version);
        const mode = self.getMode(doc);
        const promoted = mode !== version.mode;
        await self.db.updateOne({ _id: version._id }, {
          $set: {
            doc: await self.pack(self.apos.util.clonePermanent(doc)),
            mode,
            ...(promoted ? { createdAt: new Date() } : { updatedAt: new Date() }),
            changeCount: before
              ? self.getChangeCount(req, doc, before.doc)
              : 0
          },
          ...(promoted && { $unset: { updatedAt: 1 } })
        });
        return self.updateReferencesFor(req, version._id);
      },
      // A new version record of `doc` as saved by `req`. `docId`, `mode`
      // and `locale` identify the document at top level, `author`,
      // `authorId`, `ai` and `restoredFrom` describe the save; `doc` is the
      // packed copy of its content.
      async newVersion(req, doc) {
        if ((typeof req?.clone !== 'function') || (typeof doc?.type !== 'string')) {
          throw new Error('newVersion(req, doc) requires a request and a document');
        }
        const { user } = req;
        const restoredFrom = await getRestoredFrom(req);

        return {
          _id: createId(),
          metaType: 'version',
          createdAt: new Date(),
          docId: doc.aposDocId,
          mode: self.getMode(doc),
          locale: self.getLocale(doc),
          author: user
            ? user.title || user.username
            : 'SYSTEM',
          authorId: self.getAuthorId(req),
          ai: Boolean(req.aposAi),
          ...(restoredFrom && { restoredFrom }),
          doc: await self.pack(self.apos.util.clonePermanent(doc))
        };

        // The `{ _id, createdAt }` of the version a restore returns to,
        // `null` when the request restores nothing or names no stored version
        async function getRestoredFrom(req) {
          if (!req.aposRestoreVersion) {
            return null;
          }
          const version = await self.findOne(req, { _id: req.aposRestoreVersion }, {
            project: {
              _id: 1,
              createdAt: 1
            },
            raw: true
          });
          return version
            ? {
              _id: version._id,
              createdAt: version.createdAt
            }
            : null;
        }
      },
      // Re-read a version just written and register it with the attachment
      // module as an archived holder of the attachments its content uses
      async updateReferencesFor(req, versionId) {
        const version = await self.findOne(req, { _id: versionId });
        await self.apos.attachment.updateDocReferences(asAttachmentDoc(version));
        return version;
      },
      // Emits `beforeInsert`, which may amend the record
      async insert(req, versionDoc) {
        await self.emit('beforeInsert', req, versionDoc);
        return self.db.insertOne(versionDoc);
      },
      // Versions newest first, `doc` unpacked when projected. Options:
      // `limit`, `skip`, `sort` (`false` for none), `project`, and `raw` for
      // the records as stored, for callers that read top-level fields only
      async find(req, criteria, options = {}) {
        if (!req || Object.keys(req).length === 0) {
          throw new Error('req argument is required. Usage: find(req, criteria)');
        }
        const { raw, ...opts } = options;
        if (!opts.sort && opts.sort !== false) {
          opts.sort = self.defaultSort;
        }
        const versions = await self.getFindCursor(criteria, opts)
          .toArray();
        if (raw) {
          return versions;
        }
        return Promise.all(versions.map(unpackVersion));

        // Unpack `doc` in place when the record carries it
        async function unpackVersion(version) {
          if (version.doc !== undefined) {
            version.doc = await self.unpack(version.doc);
          }
          return version;
        }
      },
      // The first version `find` returns
      async findOne(req, criteria, options = {}) {
        const res = await self.find(req, criteria, {
          ...options,
          limit: 1
        });
        return res[0];
      },
      // Takes the options of `find` but `sort` and `project`
      async count(req, criteria, options = {}) {
        if (!req || Object.keys(req).length === 0) {
          throw new Error('req argument is required. Usage: count(req, criteria)');
        }
        const opts = {
          ...options,
          sort: false,
          project: null
        };
        return self.getFindCursor(criteria, opts)
          .count();
      },
      // A cursor over the stored records: `doc` stays packed
      getFindCursor(criteria, options = {}) {
        const cursor = self.db.find(criteria);

        if (options.project) {
          cursor.project(options.project);
        }

        if (typeof options.skip === 'number') {
          cursor.skip(options.skip);
        }
        if (typeof options.limit === 'number') {
          cursor.limit(options.limit);
        }
        if (options.sort) {
          cursor.sort(options.sort);
        }
        return cursor;
      },
      // A version's `doc` is stored as a base64 string of the gzipped Extended
      // JSON of the document, so it survives every database backend without a
      // binary type. Nothing outside the module sees the packed form.
      async pack(doc) {
        const { EJSON } = self.apos.modules['@apostrophecms/db'];
        const buffer = await gzip(EJSON.stringify(doc));
        return buffer.toString('base64');
      },
      // A plain object means a legacy record the migration has not reached;
      // nothing downstream handles that form, so fail loudly
      async unpack(packed) {
        if (typeof packed !== 'string') {
          throw new Error('Version doc is not packed: run the pending migrations');
        }
        const { EJSON } = self.apos.modules['@apostrophecms/db'];
        const buffer = await gunzip(Buffer.from(packed, 'base64'));
        return EJSON.parse(buffer.toString('utf8'));
      },
      // Remove all versions and attachment references of a doc in the
      // locale it was deleted from; the other locales keep their history
      async removeAllFor(req, doc) {
        await self.removeVersions(req, self.getTimelineCriteria(doc));
      },
      // Delete every version matching `criteria` and release its attachment
      // references. Batched so a long history is never loaded at once.
      // Returns the number of versions removed.
      async removeVersions(req, criteria) {
        let removed = 0;
        let versions;
        do {
          versions = await self.find(req, criteria, { limit: 50 });
          for (const version of versions) {
            await self.db.deleteOne({ _id: version._id });
            await self.apos.attachment.updateDocReferences(asAttachmentDoc(version), {
              deleted: true
            });
            removed++;
          }
        } while (versions.length);
        return removed;
      },
      // Apply `rewrite(version)` to every version matching `criteria`, in
      // batches. It receives the version with `doc` unpacked and returns the
      // fields to set, `doc` unpacked, or nothing to leave the version as it
      // is. Returns the number of versions changed.
      async rewriteVersions(req, criteria, rewrite) {
        const ids = (await self.db
          .find(criteria)
          .project({ _id: 1 })
          .toArray())
          .map(version => version._id);

        let changed = 0;
        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
          const versions = await self.find(
            req,
            { _id: { $in: ids.slice(i, i + batchSize) } },
            { sort: false }
          );
          const operations = [];
          for (const version of versions) {
            const rewritten = rewrite(version);
            if (!rewritten) {
              continue;
            }
            const { doc, ...fields } = rewritten;
            operations.push({
              updateOne: {
                filter: { _id: version._id },
                update: {
                  $set: {
                    ...fields,
                    doc: await self.pack(doc)
                  }
                }
              }
            });
          }
          if (!operations.length) {
            continue;
          }
          const result = await self.db.bulkWrite(operations);
          changed += result.modifiedCount;
        }
        return changed;
      },
      // Hand every version to `work` as the attachment module knows it (see
      // `asAttachmentDoc`), so a recount of attachment references includes
      // versions
      async eachVersionDoc(work) {
        await self.apos.migration.each(self.db, {}, async version => {
          await work(asAttachmentDoc({
            ...version,
            doc: await self.unpack(version.doc)
          }));
        });
      },
      // The default REST API query for a given document
      getRestDocQuery(req) {
        return self.apos.doc.find(req)
          .permission('edit')
          .archived(null)
          .areas(false)
          .relationships(false);
      },
      // The default REST API version projection. `updatedAt` and
      // `restoredFrom` are only present on records that have them
      getRestProjection() {
        return {
          _id: 1,
          createdAt: 1,
          updatedAt: 1,
          mode: 1,
          author: 1,
          authorId: 1,
          ai: 1,
          restoredFrom: 1,
          changeCount: 1
        };
      },
      // One page of a timeline, newest first: `{ results, next }`. `before` is a
      // date to start below; `next` is the `before` of the following page, `null`
      // on the last. With `consolidate`, versions that consolidate come as one
      // item (see `lib/consolidation.js`) with a `changeCount` of its own, and a
      // page never ends in the middle of one: it reads on to complete it
      async getTimelinePage(req, criteria, { before, consolidate } = {}) {
        const limit = self.defaultLimit;
        const project = self.getRestProjection();
        const found = await self.find(
          req,
          before ? olderThan(criteria, before) : criteria,
          {
            limit: limit + 1,
            project
          }
        );
        const records = found.slice(0, limit);
        let more = found.length > limit;

        if (
          consolidate && more &&
          consolidation.inSameSequence(records.at(-1), found[limit])
        ) {
          const [ , ...rest ] = await self.getSequenceFrom(
            req,
            criteria,
            records.at(-1)
          );
          const sequence = [
            ...consolidation.getSequences(records).at(-1),
            ...rest
          ];
          if (consolidation.consolidates(sequence)) {
            records.push(...rest);
            more = Boolean(await self.count(
              req,
              olderThan(criteria, records.at(-1).createdAt)
            ));
          }
        }

        const oldestOf = new Map(
          consolidation.getSequences(records)
            .map(sequence => [ sequence[0]._id, sequence.at(-1) ])
        );
        const results = consolidate
          ? consolidation.consolidate(records)
          : records;
        for (const item of results.filter(item => item.versionIds)) {
          item.changeCount = await countChanges(item, oldestOf.get(item._id));
        }

        return {
          results,
          next: more ? records.at(-1).createdAt : null
        };

        // From the version before its oldest version to its newest; from the
        // oldest itself when nothing is before it
        async function countChanges(item, oldest) {
          const [ newest, previous ] = await Promise.all([
            self.findOne(req, { _id: item._id }),
            self.findOne(req, olderThan(criteria, oldest.createdAt))
          ]);
          if (!self.apos.doc.getManager(newest.doc.type)) {
            return 0;
          }
          const base = previous ?? await self.findOne(req, { _id: oldest._id });
          return self.getChangeCount(req, newest.doc, base.doc);
        }
      },
      // The sequence of `version` from it down, newest first, as projected
      // records (see `lib/consolidation.js`); `criteria` names its timeline
      async getSequenceFrom(req, criteria, version) {
        const sequence = [ version ];
        const limit = self.sequenceBatchLimit;
        for (;;) {
          const older = await self.find(
            req,
            olderThan(criteria, sequence.at(-1).createdAt),
            {
              limit,
              project: self.getRestProjection()
            }
          );
          for (const record of older) {
            if (!consolidation.inSameSequence(sequence.at(-1), record)) {
              return sequence;
            }
            sequence.push(record);
          }
          if (older.length < limit) {
            return sequence;
          }
        }
      },
      // A version for display, its document loaded like a regular find.
      // `annotate` marks the document with the changes of the version (see
      // `getAnnotatedDoc`); a first or restored version has none. `consolidate`
      // marks the changes of the whole consolidated version `versionId` is the
      // newest of, AI involvement included
      async getOne(req, versionId, { annotate = false, consolidate = false } = {}) {
        const draftReq = req.clone({ mode: 'draft' });
        const version = await self.getEditableVersion(draftReq, versionId);
        const manager = self.apos.doc.getManager(version.doc.type);

        if (annotate && manager && !version.restoredFrom) {
          const { pairs } = await self.getVersionPairs(
            draftReq,
            version,
            { consolidate }
          );
          if (pairs.length) {
            version.doc = self.getAnnotatedDoc(req, pairs[0].older, version.doc, {
              rows: self.getConsolidatedRows(req, pairs)
            });
          }
        }

        // We must load relationships and areas as if we had done a regular find
        if (manager) {
          self.apos.migration.addMissingSchemaFieldsFor(version.doc, manager.schema, '', {});

          const query = manager.find(draftReq);
          await query.finalize();
          await query.after([ version.doc ]);
        }

        delete version.docId;
        delete version.locale;

        return version;
      },
      // The version record `versionId` with its stored document, `docId` and
      // `locale`, when `req` can edit the document. Throws `invalid` for a
      // malformed id, `notfound` when the version does not exist, belongs to
      // a type without versions or to a document `req` cannot edit
      async getEditableVersion(req, versionId) {
        const docVersionId = self.apos.launder.id(versionId);
        if (!docVersionId) {
          throw self.apos.error('invalid');
        }

        const version = await self.findOne(
          req,
          {
            _id: docVersionId
          },
          {
            project: {
              ...self.getRestProjection(),
              docId: 1,
              locale: 1,
              doc: 1
            }
          }
        );
        if (!version || self.isExcludedType(version.doc)) {
          throw self.apos.error('notfound');
        }

        const draftId = version.locale
          ? `${version.docId}:${version.locale}:draft`
          : version.docId;
        const permissionCheck = await self.getRestDocQuery(req.clone({ mode: 'draft' }))
          .and({ _id: draftId })
          .toCount();

        if (!permissionCheck) {
          throw self.apos.error('notfound');
        }
        return version;
      },
      // The version before `version` on its timeline, `null` for the first.
      // `version` is a record with `docId`, `locale` and `createdAt`
      async getPreviousVersion(req, version) {
        const previous = await self.findOne(req, olderThan({
          docId: version.docId,
          locale: version.locale
        }, version.createdAt));
        return previous ?? null;
      },
      // The publication point Unpublish returns to: the one before the current.
      // `null` when there is none, or when the current one is itself an
      // Unpublish, which only a new publish can undo
      async getPreviousPublication(req, published) {
        const [ current, previous ] = await self.find(req, {
          ...self.getTimelineCriteria(published),
          mode: 'published'
        }, {
          limit: PUBLISHED_ONLY_LIMIT
        });
        if (!previous || current.restoredFrom) {
          return null;
        }
        return previous;
      },
      // `{ members, pairs }` for the version record `last`. `members` are the
      // versions it stands for, oldest first: itself, or with `consolidate` all
      // those of its consolidated version. `pairs` are the `{ older, newer, ai }`
      // of each member, as `getConsolidatedRows` takes them; a first version
      // has none
      async getVersionPairs(req, last, { consolidate = false } = {}) {
        let members = [ last ];
        if (consolidate) {
          const sequence = await self.getSequenceFrom(req, {
            docId: last.docId,
            locale: last.locale
          }, last);
          if (consolidation.consolidates(sequence)) {
            members = await self.find(
              req,
              { _id: { $in: sequence.map(version => version._id) } },
              { sort: { createdAt: 1 } }
            );
          }
        }
        const previous = await self.getPreviousVersion(req, members[0]);
        const pairs = members
          .map((member, i) => ({
            older: i ? members[i - 1].doc : previous?.doc,
            newer: member.doc,
            ai: member.ai
          }))
          .filter(pair => pair.older);
        return {
          members,
          pairs
        };
      },
      // The change list of a version (see `getChangeList`) and the versions it
      // covers, newest first: `{ rows, counts, versionIds, compared }`. With
      // `consolidate` it is that of the consolidated version `versionId` is the
      // newest of. A first or restored version lists nothing and is not
      // `compared`; a version with nothing left to show against the one before
      // it lists nothing and is. Throws like `getEditableVersion`
      async getVersionChanges(req, versionId, { consolidate = false } = {}) {
        const draftReq = req.clone({ mode: 'draft' });
        const last = await self.getEditableVersion(draftReq, versionId);
        const { members, pairs } = await self.getVersionPairs(
          draftReq,
          last,
          { consolidate }
        );
        const compared = last.restoredFrom ? [] : pairs;

        const changeList = await self.getChangeList(draftReq, compared);

        return {
          ...changeList,
          versionIds: members.map(member => member._id).reverse(),
          compared: Boolean(compared.length)
        };
      },
      // The change list between contents of one document, as the modal shows
      // it: `{ rows, counts: { added, modified, deleted, ai } }`. `pairs` are
      // `{ older, newer, ai }`, oldest first; one pair compares two contents,
      // several read as one list (see `getConsolidatedRows`). Rows carry their
      // text, word diff and formatting changes (see `lib/text.js`). Checks no
      // permission on the contents; related documents read as `req` sees them.
      // Empty for no pairs and for a type whose module is gone
      async getChangeList(req, pairs) {
        let rows = [];
        if (pairs.length && self.apos.doc.getManager(pairs.at(-1).newer.type)) {
          const ctx = self.getDiffContext(req, pairs.at(-1).newer);
          rows = text.addWordDiff(await self.addChangeText(
            req,
            text.addFormat(self.getConsolidatedRows(req, pairs), ctx)
          ), ctx);
        }
        return {
          rows,
          counts: {
            added: rows.filter(row => row.type === 'added').length,
            modified: rows.filter(row => row.type === 'modified').length,
            deleted: rows.filter(row => row.type === 'deleted').length,
            ai: rows.filter(row => row.ai).length
          }
        };
      },
      // Every change from `older` to `newer`, two stored versions of one
      // document, as rows at full depth (see `lib/diff.js`)
      getChangeRows(req, older, newer) {
        const manager = self.apos.doc.getManager(newer.type);
        return diff.walk(manager.schema, older, newer, self.getDiffContext(req, newer));
      },
      // The changes of consecutive versions of one document as one list,
      // every row flagged `ai` (see `lib/diff.js`). `pairs` are
      // `{ older, newer, ai }`, oldest first
      getConsolidatedRows(req, pairs) {
        const { newer } = pairs.at(-1);
        const manager = self.apos.doc.getManager(newer.type);
        return diff.consolidate(manager.schema, pairs, self.getDiffContext(req, newer));
      },
      // Sets the display text of change rows (see `addText` in `lib/text.js`).
      // Fetches what the text needs in one query, as `req` sees it: the titles
      // of related documents, the file URL of images and the page URL of other
      // documents, archived ones left out
      async addChangeText(req, rows) {
        const ctx = self.getDiffContext(req);
        const ids = text.getRelatedIds(rows, ctx);
        const titles = {};
        const urls = {};
        const links = {};
        if (ids.length) {
          const related = await self.apos.doc.find(req, { aposDocId: { $in: ids } })
            .project({
              aposDocId: 1,
              title: 1,
              type: 1,
              archived: 1,
              _url: 1
            })
            .archived(null)
            .areas(false)
            .relationships(false)
            .toArray();
          for (const doc of related) {
            titles[doc.aposDocId] = doc.title;
            if ((doc.type === self.apos.image.__meta.name) && !doc.archived) {
              urls[doc.aposDocId] = `${self.apos.image.action}/${doc.aposDocId}/src`;
            }
            if (doc._url && !doc.archived) {
              links[doc.aposDocId] = doc._url;
            }
          }
        }
        return text.addText(rows, ctx, {
          titles,
          urls,
          links
        });
      },
      // A copy of `newer` marked with its changes since `older`, for display in
      // place (see `annotate` in `lib/diff.js`). Pass `rows` when the changes
      // are already listed; rows flagged `ai` mark their changes as AI's
      getAnnotatedDoc(req, older, newer, { rows } = {}) {
        const manager = self.apos.doc.getManager(newer.type);
        return diff.annotate(
          manager.schema,
          older,
          newer,
          self.getDiffContext(req, newer),
          { rows }
        );
      },
      // The number of changes from `previousDoc`, an unpacked version
      // content, to `doc`: the rows its change list shows. Stored as a
      // version's `changeCount`
      getChangeCount(req, doc, previousDoc) {
        return self.getChangeRows(
          req,
          previousDoc,
          self.apos.util.clonePermanent(doc)
        ).length;
      },
      // What the diff engine needs from the rest of Apostrophe. `doc`, the
      // document compared, names it in the log when the engine recovers from
      // a failure: the change is still listed, in less detail
      getDiffContext(req, doc) {
        return {
          req,
          onError: (err, path) => self.logWarn(
            'change-detail-failed',
            'A change could not be read in full detail',
            {
              docId: doc?._id,
              docType: doc?.type,
              path: path.map(segment => segment.name).join('.'),
              stack: err.stack
            }
          ),
          getFieldType: name => self.apos.schema.fieldTypes[name],
          getWidgetManager: type => self.apos.area.getWidgetManager(type),
          setMeta: (doc, ...args) => self.apos.doc.setMeta(doc, ...args),
          htmlToPlaintext: html => self.apos.util.htmlToPlaintext(html),
          t: (key, options = {}) => self.apos.i18n.i18next.t(key, {
            ...options,
            lng: self.apos.i18n.getAdminLocale(req)
          }),
          getRichTextStyles: () => self.apos.modules['@apostrophecms/rich-text-widget']
            .options.defaultOptions.styles || []
        };
      },
      // Recompute `changeCount` for every version, one timeline at a time.
      // Two `distinct` calls rather than a `$group`: every database backend
      // runs `distinct` natively. Also a migration: a legacy record counted
      // the top-level fields that differ, not the rows of its change list
      async setChangeCountTask() {
        const req = self.apos.task.getReq();
        const docIds = await self.db.distinct('docId');

        for (const docId of docIds) {
          const locales = await self.db.distinct('locale', { docId });
          for (const locale of locales) {
            await self.setChangeCountFor(req, {
              docId,
              locale
            });
          }
        }
      },
      // Recompute `changeCount` along one timeline, oldest first, a batch of
      // versions in memory at a time. The oldest version has nothing to
      // count against and keeps its count; a restore counts none
      async setChangeCountFor(req, criteria) {
        const { docId } = criteria;
        const limit = 10;
        let previous = null;

        for (;;) {
          const versions = await self.find(
            req,
            {
              ...criteria,
              ...(previous && { createdAt: { $gt: previous.createdAt } })
            },
            {
              sort: { createdAt: 1 },
              limit
            }
          );
          const updates = [];
          for (const version of versions) {
            const changeCount = countFor(version, previous);
            if ((changeCount !== null) && (changeCount !== version.changeCount)) {
              updates.push({
                _id: version._id,
                changeCount
              });
            }
            previous = version;
          }
          await write(updates);
          if (versions.length < limit) {
            return;
          }
        }

        // `null` when the count stays as it is
        function countFor(version, before) {
          const { type } = version.doc;
          if (!self.apos.doc.getManager(type)) {
            self.logWarn('set-change-count-no-manager', `No manager found for ${type}`, {
              docId,
              docType: type
            });
            return null;
          }
          if (version.restoredFrom) {
            return 0;
          }
          return before
            ? self.getChangeCount(req, version.doc, before.doc)
            : null;
        }

        async function write(updates) {
          if (!updates.length) {
            return;
          }
          try {
            await self.db.bulkWrite(updates.map(({ _id, changeCount }) => ({
              updateOne: {
                filter: { _id },
                update: { $set: { changeCount } }
              }
            })));
          } catch (err) {
            self.logError('set-change-count-failed', `Error while updating versions for ${docId}`, {
              docId,
              stack: err.stack
            });
          }
        }
      },
      // Rename a locale in the version records. Same contract as
      // `@apostrophecms/i18n.rename`, which calls this after renaming the docs.
      // Where a document has versions in both locales, `keep` names the locale
      // whose versions stay; without it the two histories merge
      async renameLocale(oldLocale, newLocale, { keep } = {}) {
        if (!oldLocale) {
          throw new Error('You must specify --old');
        }
        if (!newLocale) {
          throw new Error('You must specify --new');
        }
        if (oldLocale === newLocale) {
          throw new Error('The old and new locales must be different');
        }
        if (keep && (!(keep === oldLocale) && !(keep === newLocale))) {
          throw new Error('--keep must match --old or --new');
        }

        const req = self.apos.task.getReq();
        let kept = 0;
        if (keep) {
          const oldDocIds = await self.db.distinct('docId', { locale: oldLocale });
          const conflicts = await self.db.distinct('docId', {
            locale: newLocale,
            docId: { $in: oldDocIds }
          });
          if (conflicts.length) {
            kept = await self.removeVersions(req, {
              locale: (keep === newLocale) ? oldLocale : newLocale,
              docId: { $in: conflicts }
            });
          }
        }

        const renamed = await self.rewriteVersions(
          req,
          { locale: oldLocale },
          version => ({
            locale: newLocale,
            doc: renameDocLocale(version.doc, oldLocale, newLocale)
          })
        );

        return {
          renamed,
          kept
        };

        // Rewrite the locale inside a version's doc: its `_id`, its
        // `aposLocale` and the document ids its attachment field records
        function renameDocLocale(doc, oldLocale, newLocale) {
          const renameId = id => id.replace(`:${oldLocale}:`, `:${newLocale}:`);
          const prefix = new RegExp(`^${self.apos.util.regExpQuote(oldLocale)}:`);

          doc._id = renameId(doc._id);
          doc.aposLocale = doc.aposLocale.replace(prefix, `${newLocale}:`);
          if (doc.attachment?.docIds) {
            doc.attachment.docIds = doc.attachment.docIds.map(renameId);
          }
          return doc;
        }
      },
      // Move the versions of the document `from` to `to`, two `_id` values
      // of the same mode, after `@apostrophecms/doc.changeDocIds` renamed
      // the document. A change of locale alone is left to `renameLocale`.
      // When `to` already has versions, `keep` decides as it does there.
      async changeDocId(from, to, { keep } = {}) {
        const source = parseDocId(from);
        const target = parseDocId(to);
        if (source.docId === target.docId) {
          return 0;
        }
        const req = self.apos.task.getReq();
        if (keep && await self.db.findOne(target)) {
          if (keep === 'new') {
            return self.removeVersions(req, source);
          }
          await self.removeVersions(req, target);
        }
        return self.rewriteVersions(req, source, ({ doc }) => {
          doc._id = to;
          doc.aposDocId = target.docId;
          if (target.locale) {
            doc.aposLocale = `${target.locale}:${target.mode}`;
          }
          self.apos.doc.replaceDocIdReferences(doc, {
            oldId: source.docId,
            newId: target.docId
          });
          return {
            docId: target.docId,
            locale: target.locale,
            doc
          };
        });

        // The timeline criteria and mode of a document `_id`
        function parseDocId(_id) {
          const [ docId, locale = null, mode = 'published' ] = _id.split(':');
          return {
            docId,
            locale,
            mode
          };
        }
      },
      // Replace the `aposDocId` `oldId` with `newId` wherever the content of a
      // version holds it (a page `path`, relationship ids and fields), as
      // `@apostrophecms/doc.changeDocIds` did in the live documents. Reads the
      // whole store, writes only the versions that change
      async replaceDocIdInVersions(oldId, newId) {
        const req = self.apos.task.getReq();
        return self.rewriteVersions(req, {}, ({ doc }) => {
          const changed = self.apos.doc.replaceDocIdReferences(doc, {
            oldId,
            newId
          });
          return changed ? { doc } : null;
        });
      },
      ...require('./lib/migrations.js')(self)
    };
  }
};
