// Records versions of every localized, manually published document: one on
// each publish and one per handoff of draft work, and lets editors browse
// and restore them.
// Versions live in the `aposDocsVersions` collection. A record's `doc` is
// stored packed (see `pack`) and the finders unpack it, so queries never
// reach into `doc`: everything they need is a top-level field.

const { promisify } = require('node:util');
const zlib = require('node:zlib');
const { createId } = require('@paralleldrive/cuid2');
const _ = require('lodash');
const { stripIndent } = require('common-tags');
const diff = require('./lib/diff.js');
const text = require('./lib/text.js');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// A type set to `versions: false` asked for no versions at all, but Unpublish
// needs the previous publication to return to. So we keep as little as that
// allows: the current publication and the one before it, per document and
// locale, and nothing else
const PUBLISHED_ONLY_LIMIT = 2;

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
    // Passed to `Intl.DateTimeFormat` when displaying version timestamps
    dateTimeFormatOptions: {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
  },
  async init(self) {
    self.defaultLimit = 10;
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
        async addContextMenu() {
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
      // `docId` is the live document's `_id`
      async getAll(req) {
        const docId = self.apos.launder.id(req.query.docId, '');

        if (!docId) {
          throw self.apos.error('invalid');
        }
        const doc = await self.getRestDocQuery(req.clone({ mode: 'draft' }))
          .and({ _id: docId.replace(/:[\w]+$/, ':draft') })
          .toObject();

        if (!doc || self.isExcludedType(doc)) {
          throw self.apos.error('notfound');
        }

        const criteria = self.getTimelineCriteria(doc);
        const pager = await self.getRestPager(req, criteria);
        const versions = await self.find(
          req,
          criteria,
          {
            skip: pager.skip,
            limit: pager.perPage,
            project: self.getRestProjection()
          }
        );

        return {
          pages: pager.pages,
          currentPage: pager.currentPage,
          perPage: pager.perPage,
          total: pager.total,
          results: versions
        };
      },
      // `annotate=1` marks the version's document with its changes since
      // the version before it (see `getAnnotatedDoc`)
      async getOne(req, versionId) {
        try {
          const version = await self.getOne(req, versionId, {
            annotate: self.apos.launder.boolean(req.query.annotate)
          });

          return version;
        } catch (error) {
          const errorName = error.name === 'ReferenceError'
            ? 'notfound'
            : 'invalid';

          throw self.apos.error(errorName);
        }
      }
    };
  },

  apiRoutes(self) {
    return {
      get: {
        // The changes of the versions `ids`, comma separated: consecutive
        // versions of one document, listed as one (see `getVersionChanges`)
        changes: async (req) => {
          const ids = self.apos.launder.string(req.query.ids).split(',');
          return changesOrRestError(() => self.getVersionChanges(req, ids));
        },
        // The changes of a version since the one before it
        ':versionId/changes': async (req) => {
          return changesOrRestError(
            () => self.getVersionChanges(req, [ req.params.versionId ])
          );
        }
      }
    };

    async function changesOrRestError(getChanges) {
      try {
        return await getChanges();
      } catch (error) {
        if (error instanceof TypeError) {
          throw self.apos.error('invalid');
        }
        if (error instanceof ReferenceError) {
          throw self.apos.error('notfound');
        }
        throw error;
      }
    }
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
        }, {});
      },
      addMigrations() {
        self.apos.migration.add('convert-legacy-versions', self.convertLegacyVersions);
        self.apos.migration.add('seed-publication-points', self.seedPublicationPoints);
        self.apos.migration.add('remove-previous-mode-docs', self.removePreviousModeDocs);
      },
      // Records written before this module hold `doc` as a plain object, are
      // keyed by the document's full `_id` and have no `mode`, `locale`,
      // `authorId` or `ai`. The author is the user the saved document names
      // in `updatedBy`: the request that saved it recorded the version.
      // A converted record always has `mode`, so a rerun resumes where the
      // last one stopped. Returns the number of records converted.
      async convertLegacyVersions() {
        let converted = 0;
        await self.apos.migration.each(
          self.db,
          { mode: { $exists: false } },
          5,
          async version => {
            const packed = typeof version.doc === 'string';
            const doc = packed
              ? await self.unpack(version.doc)
              : version.doc;
            await self.db.updateOne({ _id: version._id }, {
              $set: {
                ...self.getTimelineCriteria(doc),
                mode: self.getMode(doc),
                authorId: doc.updatedBy?._id ?? null,
                ai: false,
                doc: packed
                  ? version.doc
                  : await self.pack(doc)
              }
            });
            converted++;
          }
        );
        return converted;
      },
      // Before this module, the content live before the newest publish was
      // kept as a document in `previous` mode. A project upgrading from
      // there has no publication points in the store, so Unpublish would
      // have nothing to return to until its second publish after the
      // upgrade. Record what is published now, and what the `previous`
      // document holds, for every timeline that has no publication point
      // yet. Returns the number of records written.
      async seedPublicationPoints() {
        const req = self.apos.task.getReq({ mode: 'published' });
        let seeded = 0;
        await self.apos.migration.each(
          self.apos.doc.db,
          { aposMode: 'published' },
          5,
          async published => {
            if (!self.isVersioned(published) && !self.isPublishedOnly(published)) {
              return;
            }
            const existing = await self.db.countDocuments({
              ...self.getTimelineCriteria(published),
              mode: 'published'
            });
            if (existing) {
              return;
            }
            const stored = await self.apos.doc.db.findOne({
              _id: published._id.replace(':published', ':previous')
            });
            const previous = stored && await asPublishedDoc(stored);
            const publishedAt = publicationTime(published);
            if (previous) {
              await insertPublicationPoint(previous, new Date(Math.min(
                publicationTime(previous).getTime(),
                publishedAt.getTime() - 1
              )));
              seeded++;
            }
            await insertPublicationPoint(published, publishedAt, previous);
            seeded++;
          }
        );
        return seeded;

        // When a document became what it is now. Publication points seeded
        // from documents have no record of their own to date them
        function publicationTime(doc) {
          const at = new Date(doc.lastPublishedAt || doc.updatedAt || doc.createdAt);
          return isNaN(at) ? new Date() : at;
        }

        // A `previous` mode document as the published document it was: its
        // identity restored, and the slug and other conflicting fields back
        // to the values they had while it was live
        async function asPublishedDoc(previous) {
          const manager = self.apos.doc.getManager(previous.type);
          const reduplicated = manager
            ? await manager.getRevertDeduplicationSet(req, previous)
            : null;
          return {
            ...previous,
            ...reduplicated || {},
            _id: previous._id.replace(':previous', ':published'),
            aposLocale: previous.aposLocale.replace(':previous', ':published'),
            aposMode: 'published'
          };
        }

        // Record `doc` as a publication point made at `createdAt`, attributed
        // to whoever last saved it. Counts its changes against `previousDoc`
        // when one is given
        async function insertPublicationPoint(doc, createdAt, previousDoc) {
          const content = self.apos.util.clonePermanent(doc);
          const version = {
            _id: createId(),
            metaType: 'version',
            createdAt,
            docId: doc.aposDocId,
            mode: 'published',
            locale: self.getLocale(doc),
            author: doc.updatedBy?.title || doc.updatedBy?.username || 'SYSTEM',
            authorId: doc.updatedBy?._id ?? null,
            ai: false,
            changeCount: previousDoc
              ? self.getChanges(req, content, previousDoc).length
              : 0,
            doc: await self.pack(content)
          };
          await self.insert(req, version);
          return self.updateReferencesFor(req, version._id);
        }
      },
      // Drop the `previous` mode documents the store now replaces, releasing
      // the attachment references they hold. Returns the number removed.
      async removePreviousModeDocs() {
        let removed = 0;
        await self.apos.migration.each(
          self.apos.doc.db,
          { aposMode: 'previous' },
          5,
          async doc => {
            await self.apos.attachment.updateDocReferences(doc, { deleted: true });
            await self.apos.doc.db.deleteOne({ _id: doc._id });
            removed++;
          }
        );
        return removed;
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
      // Whether the module keeps this document's full history: its type
      // has versions and it is not archived. This also handles the
      // auto-insert of the core @apostrophecms/archive-page
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
      // Decides what a save does to the document's history. Returns `false`
      // for nothing, `true` for a new version, or the `_id` of the newest
      // version, a draft, which the save then replaces in place.
      //
      // A restore always starts a version. So does a publish, unless the
      // newest version is a draft of the same content by the same author
      // with the same AI involvement: a publish saves the draft first, so
      // that draft becomes the publication point instead. A draft save with
      // no change to any schema field never starts one. Otherwise a draft
      // starts one at every handoff: an explicit Save Draft, a first version,
      // a previous version that was a publication point, a different author,
      // AI involvement changing, or more than `draftInterval` since the
      // previous version was created. Between handoffs it replaces the
      // previous draft.
      //
      // A request flagged `aposSkipVersion` records nothing: core sets it on
      // a save that is a side effect of an operation already recorded. A
      // save that takes the document out of the archive records nothing
      // either: it still carries the deduplicated slug, which core reverts
      // after this save
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
        if (req.aposRestoreVersion) {
          return true;
        }
        const previous = await self.findOne(req, self.getTimelineCriteria(doc));
        if (self.getMode(doc) === 'published') {
          const promotable = previous &&
            previous.mode === 'draft' &&
            !previous.restoredFrom &&
            previous.authorId === self.getAuthorId(req) &&
            Boolean(previous.ai) === Boolean(req.aposAi) &&
            !self.getChanges(req, doc, previous.doc).length;
          return promotable ? previous._id : true;
        }
        if (!previous) {
          return true;
        }
        if (!self.getChanges(req, doc, previous.doc).length) {
          return false;
        }
        if (req.aposExplicitSave) {
          return true;
        }
        if (previous.mode === 'published') {
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
          await self.trimPublishedOnly(req, doc);
        }
        return version;
      },
      // Drop the publication points of `doc` beyond the ones Unpublish
      // needs, for a type that records published versions only
      async trimPublishedOnly(req, doc) {
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
      },
      // The version Unpublish returns `published` to: the publication point
      // before the current one, with its `doc` unpacked. `null` when there
      // is none, or when the current publication is itself an Unpublish,
      // which can be undone only by publishing again
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
      // Insert a new version of `doc` at the head of its timeline
      async insertVersion(req, doc) {
        const previous = await self.findOne(req, self.getTimelineCriteria(doc));
        const instance = {
          ...await self.newVersion(req, doc),
          changeCount: previous
            ? self.getChanges(req, doc, previous.doc).length
            : 0
        };
        await self.insert(req, instance);
        return self.updateReferencesFor(req, instance._id);
      },
      // Replace the content of an existing version with `doc`, keeping the
      // record's identity and author. The mode follows `doc`; a draft
      // promoted to a publication point takes the publish time as its
      // creation time. The change count is recomputed against the version
      // before it. Inserts instead when the version is gone
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
              ? self.getChanges(req, doc, before.doc).length
              : 0
          },
          ...(promoted && { $unset: { updatedAt: 1 } })
        });
        return self.updateReferencesFor(req, version._id);
      },
      // Re-read a version just written and register it with the attachment
      // module as an archived holder of the attachments its content uses
      async updateReferencesFor(req, versionId) {
        const version = await self.findOne(req, { _id: versionId });
        await self.apos.attachment.updateDocReferences({
          ...version.doc,
          _id: version._id,
          archived: true
        });
        return version;
      },
      // Hand the content of every version to `work`, one version at a time,
      // as the archived document the attachment module knows it as (see
      // `updateReferencesFor`). Registered with the attachment module so a
      // recount of attachment references includes versions
      async eachVersionDoc(work) {
        await self.apos.migration.each(self.db, {}, async version => {
          const doc = await self.unpack(version.doc);
          await work({
            ...doc,
            _id: version._id,
            archived: true
          });
        });
      },
      // The top-level schema fields of `doc` whose values differ from
      // `previousDoc`, an unpacked version content, by the schema of `doc`
      getChanges(req, doc, previousDoc) {
        const manager = self.apos.doc.getManager(doc.type);
        return self.apos.schema.getChanges(
          req,
          manager.schema,
          self.apos.util.clonePermanent(doc),
          previousDoc
        );
      },
      // What the diff engine needs from the rest of Apostrophe
      getDiffContext(req) {
        return {
          req,
          getFieldType: name => self.apos.schema.fieldTypes[name],
          getWidgetManager: type => self.apos.area.getWidgetManager(type),
          setMeta: (doc, ...args) => self.apos.doc.setMeta(doc, ...args),
          htmlToPlaintext: html => self.apos.util.htmlToPlaintext(html)
        };
      },
      // Every change from `older` to `newer`, two stored versions of one
      // document, as rows at full depth (see `lib/diff.js`)
      getChangeRows(req, older, newer) {
        const manager = self.apos.doc.getManager(newer.type);
        return diff.walk(manager.schema, older, newer, self.getDiffContext(req));
      },
      // Sets `oldText` and `newText` on change rows (see `lib/text.js`).
      // Related document titles are fetched in one query, as `req` sees them;
      // a document it cannot see has no title
      async addChangeText(req, rows) {
        const ctx = self.getDiffContext(req);
        const ids = text.getRelatedIds(rows, ctx);
        const titles = {};
        if (ids.length) {
          const related = await self.apos.doc.find(req, { aposDocId: { $in: ids } })
            .project({
              aposDocId: 1,
              title: 1
            })
            .archived(null)
            .areas(false)
            .relationships(false)
            .toArray();
          for (const doc of related) {
            titles[doc.aposDocId] = doc.title;
          }
        }
        return text.addText(rows, ctx, { titles });
      },
      // The changes of consecutive versions of one document as one list,
      // every row flagged `ai` (see `lib/diff.js`). `pairs` are
      // `{ older, newer, ai }`, oldest first
      getConsolidatedRows(req, pairs) {
        const manager = self.apos.doc.getManager(pairs.at(-1).newer.type);
        return diff.consolidate(manager.schema, pairs, self.getDiffContext(req));
      },
      // A copy of `newer` marked with its changes since `older`, for
      // WYSIWYG display (see `lib/diff.js`)
      getAnnotatedDoc(req, older, newer) {
        const manager = self.apos.doc.getManager(newer.type);
        return diff.annotate(manager.schema, older, newer, self.getDiffContext(req));
      },
      // The `_id` of the user saving, `null` when there is none (system)
      getAuthorId(req) {
        return req.user?._id ?? null;
      },
      // The `{ _id, createdAt }` of the version a restore returns to,
      // `null` when the request restores nothing or names no stored version
      async getRestoredFrom(req) {
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
            await self.apos.attachment.updateDocReferences({
              ...version.doc,
              _id: version._id
            }, {
              deleted: true
            });
            removed++;
          }
        } while (versions.length);
        return removed;
      },
      // Insert new version into the DB
      async insert(req, versionDoc) {
        await self.emit('beforeInsert', req, versionDoc);
        return self.db.insertOne(versionDoc);
      },
      // Retrieve versions from the DB, with `doc` unpacked when projected.
      // options.limit can be used for pagination, not set by default.
      // Sort option (options.sort) defaults to (descending) version.createdAt.
      // options.skip can be used for pagination, not set by default.
      // MongoDB projection is provided via `options.project`.
      // `options.raw` returns the records as stored, for callers that read
      // top-level fields only.
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
        return Promise.all(versions.map(self.unpackVersion));
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
      // Unpack `doc` in place when the record carries it
      async unpackVersion(version) {
        if (version.doc !== undefined) {
          version.doc = await self.unpack(version.doc);
        }
        return version;
      },
      // Same options as find() but no options.sort
      // and options.project are available
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
      // Retrieve a single version doc from the DB
      async findOne(req, criteria, options = {}) {
        const res = await self.find(req, criteria, {
          ...options,
          limit: 1
        });
        return res[0];
      },
      // A cursor over the stored records: `doc` stays packed
      getFindCursor(criteria, options = {}) {
        const cursor = self.db.find(criteria);

        if (options.project) {
          cursor.project(options.project);
        }

        if (_.isNumber(options.skip)) {
          cursor.skip(options.skip);
        }
        if (_.isNumber(options.limit)) {
          cursor.limit(options.limit);
        }
        if (options.sort) {
          cursor.sort(options.sort);
        }
        return cursor;
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
      // Find the total versions count and do the pagination related math
      async getRestPager(req, criteria) {
        const perPage = self.defaultLimit;
        const total = await self.count(req, criteria);
        const currentPage = self.apos.launder.integer(req.query.page, 1);
        const pages = Math.ceil(total / perPage);
        const skip = perPage * (currentPage - 1);
        return {
          currentPage,
          pages,
          perPage,
          total,
          skip
        };
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
        const restoredFrom = await self.getRestoredFrom(req);

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
        const browserOptions = {
          action: self.action,
          dateTimeFormatOptions: self.options.dateTimeFormatOptions
        };
        _.defaults(browserOptions, {
          label: self.options.label,
          pluralLabel: self.options.pluralLabel,
          components: {}
        });
        _.defaults(browserOptions.components, {
          versions: 'AposDocVersions'
        });
        browserOptions.name = self.__meta.name;
        return browserOptions;
      },
      // A version for display, its document loaded like a regular find.
      // `annotate` marks the document with its changes since the version
      // before it; a first or restored version stays unmarked
      async getOne(req, versionId, { annotate = false } = {}) {
        const draftReq = req.clone({ mode: 'draft' });
        const version = await self.getEditableVersion(draftReq, versionId);
        const manager = self.apos.doc.getManager(version.doc.type);

        if (annotate && manager && !version.restoredFrom) {
          const previous = await self.getPreviousVersion(draftReq, version);
          if (previous) {
            version.doc = self.getAnnotatedDoc(req, previous.doc, version.doc);
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
      // `locale`, when `req` can edit the document. Throws a `TypeError` for
      // a malformed id, a `ReferenceError` when the version does not exist,
      // belongs to a type without versions or to a document `req` cannot edit
      async getEditableVersion(req, versionId) {
        const docVersionId = self.apos.launder.id(versionId);
        if (!docVersionId) {
          throw new TypeError('versionId');
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
          throw new ReferenceError('version');
        }

        const draftId = version.locale
          ? `${version.docId}:${version.locale}:draft`
          : version.docId;
        const permissionCheck = await self.getRestDocQuery(req.clone({ mode: 'draft' }))
          .and({ _id: draftId })
          .toCount();

        if (!permissionCheck) {
          throw new ReferenceError('permissionCheck');
        }
        return version;
      },
      // The version before `version` on its timeline, `null` for the first.
      // `version` is a record with `docId`, `locale` and `createdAt`
      async getPreviousVersion(req, version) {
        const previous = await self.findOne(req, {
          docId: version.docId,
          locale: version.locale,
          createdAt: { $lt: version.createdAt }
        });
        return previous ?? null;
      },
      // The changes of consecutive versions of one document as one list
      // (see `getConsolidatedRows`), with display text, and their counts
      // per change type and of those involving AI:
      // `{ rows, counts: { added, modified, deleted, ai } }`. One id is a
      // single version against the one before it. A first version counts
      // no changes of its own and a restored version shows none; a group
      // cannot hold a restored version. Throws like `getEditableVersion`,
      // and a `TypeError` when the ids are not consecutive versions of
      // one document
      async getVersionChanges(req, versionIds) {
        const draftReq = req.clone({ mode: 'draft' });
        const ids = _.uniq(versionIds);
        if (!ids.length) {
          throw new TypeError('versionIds');
        }
        const members = await Promise.all(
          ids.map(id => self.getEditableVersion(draftReq, id))
        );
        members.sort((a, b) => a.createdAt - b.createdAt);
        const first = members[0];
        const last = members.at(-1);

        if (members.length > 1) {
          const oneTimeline = members.every(member => (
            (member.docId === first.docId) && (member.locale === first.locale)
          ));
          if (!oneTimeline || members.some(member => member.restoredFrom)) {
            throw new TypeError('versionIds');
          }
          const span = await self.count(draftReq, {
            docId: first.docId,
            locale: first.locale,
            createdAt: {
              $gte: first.createdAt,
              $lte: last.createdAt
            }
          });
          if (span !== members.length) {
            throw new TypeError('versionIds');
          }
        }

        let rows = [];
        if (self.apos.doc.getManager(last.doc.type) && !last.restoredFrom) {
          const previous = await self.getPreviousVersion(draftReq, first);
          const pairs = members
            .map((member, i) => ({
              older: i ? members[i - 1].doc : previous?.doc,
              newer: member.doc,
              ai: member.ai
            }))
            .filter(pair => pair.older);
          if (pairs.length) {
            rows = await self.addChangeText(
              draftReq,
              self.getConsolidatedRows(req, pairs)
            );
          }
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
      // Recompute `changeCount` for every version, one timeline at a time.
      // Two `distinct` calls rather than a `$group`: every database backend
      // runs `distinct` natively
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
      // Recompute `changeCount` along one timeline, newest first
      async setChangeCountFor(req, criteria) {
        const { docId } = criteria;
        const versions = await self.find(req, criteria);
        if (!versions.length) {
          return;
        }

        const updates = [];
        for (const [ i, version ] of versions.entries()) {
          const { type } = version.doc;
          const manager = self.apos.doc.getManager(type);
          if (!manager) {
            self.logWarn('set-change-count-no-manager', `No manager found for ${type}`, {
              docId,
              docType: type
            });
            continue;
          }

          const nextVersion = versions[i + 1];
          if (!nextVersion) {
            continue;
          }

          const changes = self.apos.schema.getChanges(
            req,
            manager.schema,
            version.doc,
            nextVersion.doc
          );
          updates.push({
            _id: version._id,
            changeCount: changes.length
          });
        }

        if (!updates.length) {
          return;
        }

        const bulkOperations = updates.map(({ _id, changeCount }) => ({
          updateOne: {
            filter: { _id },
            update: { $set: { changeCount } }
          }
        }));

        try {
          await self.db.bulkWrite(bulkOperations);
        } catch (err) {
          self.logError('set-change-count-failed', `Error while updating versions for ${docId}`, {
            docId,
            stack: err.stack
          });
        }
      },
      // Rename a locale in the version records. Same contract as
      // `@apostrophecms/i18n.rename`, which calls this after renaming the docs.
      // A document's records in both locales share `docId`, so where both
      // exist `keep` decides: the old locale's records are dropped when the
      // new locale is kept, the new locale's when the old one is, and the
      // two histories merge into one timeline when `keep` is unset.
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
            doc: self.renameDocLocale(version.doc, oldLocale, newLocale)
          })
        );

        return {
          renamed,
          kept
        };
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
      // Rewrite every reference to the document `oldId` (an `aposDocId`) in
      // the content of every version to `newId`, after
      // `@apostrophecms/doc.changeDocIds` did the same to the live documents:
      // the ancestor in a page's `path`, the ids a relationship stores, and
      // the keys of its `fields` storage.
      // Reads the whole store, writes only the versions that hold one
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
      // Rewrite the locale inside a version's doc: its `_id`, its
      // `aposLocale` and the document ids its attachment field records
      renameDocLocale(doc, oldLocale, newLocale) {
        const renameId = id => id.replace(`:${oldLocale}:`, `:${newLocale}:`);
        const prefix = new RegExp(`^${self.apos.util.regExpQuote(oldLocale)}:`);

        doc._id = renameId(doc._id);
        doc.aposLocale = doc.aposLocale.replace(prefix, `${newLocale}:`);
        if (doc.attachment?.docIds) {
          doc.attachment.docIds = doc.attachment.docIds.map(renameId);
        }
        return doc;
      }
    };
  }
};
