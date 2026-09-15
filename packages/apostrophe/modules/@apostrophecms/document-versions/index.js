// Records a version of every localized, manually published document each
// time it is published, and lets editors browse, compare and restore them.
// Versions live in the `aposDocsVersions` collection. A record's `doc` is
// stored packed (see `pack`) and the finders unpack it, so queries never
// reach into `doc`: everything they need is a top-level field.

const { promisify } = require('node:util');
const zlib = require('node:zlib');
const { createId } = require('@paralleldrive/cuid2');
const _ = require('lodash');
const { stripIndent } = require('common-tags');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

module.exports = {
  options: {
    alias: 'docVersions',
    label: 'apostrophe:versionLabel',
    pluralLabel: 'apostrophe:versionPluralLabel',
    components: {
      versions: 'AposDocVersions'
    },
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
  icons: {
    'view-split-vertical-icon': 'ViewSplitVertical'
  },
  async init(self) {
    self.defaultLimit = 10;
    self.defaultSort = { createdAt: -1 };

    self.addEditorModal();
    self.enableBrowserData();
    await self.enableCollection();
    await self.createIndexes();
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
        async createVersion(req, doc, options) {
          await self.createFor(req, doc);
        }
      },
      '@apostrophecms/doc:afterAllModesDeleted': {
        async deleteVersion(req, doc) {
          await self.removeAllFor(req, doc);
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

        if (!doc) {
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
      async getOne(req, versionId) {
        try {
          const version = await self.getOne(req, versionId);

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
        'compare/:vid1/:vid2': async (req) => {
          try {
            // Sequential on purpose: Promise.all would miss the _images relationship
            const v1 = await self.getOne(req, self.apos.launder.id(req.params.vid1));
            const v2 = await self.getOne(req, self.apos.launder.id(req.params.vid2));

            const schema = self.getCompareSchema(v1, v2);
            const { version, document } = self.getCompareData(v1, v2, schema);

            return {
              schema,
              version,
              document
            };
          } catch (error) {
            const errorName = error.name === 'ReferenceError'
              ? 'notfound'
              : 'invalid';

            throw self.apos.error(errorName);
          }
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
      // Checks if a version for a given doc should be created
      canHaveVersion(doc) {
        const manager = self.apos.doc.getManager(doc.type);

        if (!self.hasVersions(manager.options)) {
          return false;
        }

        // This also handles the auto-insert of
        // the core @apostrophecms/archive-page
        if (doc.archived) {
          return false;
        }

        return (doc.aposMode === null || doc.aposMode === 'published');
      },
      // Create new version for a given doc after performing
      // the necessary checks
      async createFor(req, doc) {
        if (!self.canHaveVersion(doc)) {
          return;
        }
        const manager = self.apos.doc.getManager(doc.type);
        if (!manager) {
          throw self.apos.error('notfound', `Manager not found for doc type: ${doc.type}`);
        }

        const lastVersion = await self.findOne(req, self.getTimelineCriteria(doc));

        const changeCount = lastVersion
          ? self.apos.schema.getChanges(
            req,
            manager.schema,
            self.apos.util.clonePermanent(doc),
            lastVersion.doc
          )
          : [];

        const instance = {
          ...await self.newInstance(doc, req.user),
          changeCount: changeCount.length
        };

        const res = await self.insert(req, instance);
        const version = await self.findOne(req, { _id: res.insertedId });
        await self.apos.attachment.updateDocReferences({
          ...version.doc,
          _id: version._id,
          archived: true
        });
        return version;
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
      // The default REST API version projection
      getRestProjection() {
        return {
          _id: 1,
          createdAt: 1,
          author: 1,
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

      // Create a new version record from a doc and the current user (optional).
      // `docId`, `mode` and `locale` identify the document at top level;
      // `doc` is the packed copy of its content.
      async newInstance(doc, currentUser) {
        const author = currentUser
          ? currentUser.title || currentUser.username
          : 'SYSTEM';

        return {
          _id: createId(),
          metaType: 'version',
          createdAt: new Date(),
          docId: doc.aposDocId,
          mode: doc.aposMode || 'published',
          locale: self.getLocale(doc),
          author,
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
      async getOne(req, versionId) {
        const draftReq = req.clone({ mode: 'draft' });
        const docVersionId = self.apos.launder.id(versionId);
        if (!docVersionId) {
          throw new TypeError('versionId');
        }

        const version = await self.findOne(
          draftReq,
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
        if (!version) {
          throw new ReferenceError('version');
        }

        const draftId = version.locale
          ? `${version.docId}:${version.locale}:draft`
          : version.docId;
        const permissionCheck = await self.getRestDocQuery(draftReq)
          .and({ _id: draftId })
          .toCount();

        if (!permissionCheck) {
          throw new ReferenceError('permissionCheck');
        }

        // We must load relationships and areas as if we had done a regular find
        const manager = self.apos.doc.getManager(version.doc.type);
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
      getCompareSchema(v1, v2) {
        const v1Manager = self.apos.doc.getManager(v1.doc.type) || { schema: [] };
        const v2Manager = self.apos.doc.getManager(v2.doc.type) || { schema: [] };
        const fields = v1Manager.schema.map(field => field.name);

        const schema = v2Manager.schema
          .reduce(
            (acc, current) => fields.includes(current.name) === false
              ? acc.concat(current)
              : acc,
            v1Manager.schema
          )
          .map(self.removeIfFrom);

        return schema;
      },
      getCompareData(v1, v2, schema = []) {
        const version = { ...v1 };
        const document = { ...v1.doc };

        const req = self.apos.task.getReq();

        schema.forEach(field => {
          self.apos.doc.setMeta(
            document,
            '@apostrophecms/schema',
            field.name,
            'compare',
            v2.doc[field.name]
          );
          self.apos.doc.setMeta(
            document,
            '@apostrophecms/schema',
            field.name,
            'highlight',
            !self.apos.schema.isEqual(req, [ field ], document, v2.doc)
          );
        });

        return {
          version,
          document
        };
      },
      removeIfFrom({ if: _, ...field }) {
        const add = field.fields?.add
          ? Object.fromEntries(
            Object.entries(field.fields.add)
              .map(([ key, value ]) => [ key, self.removeIfFrom(value) ])
          )
          : {};
        const schema = field.schema
          ? field.schema.map(self.removeIfFrom)
          : [];

        return {
          ...field,
          ...(field.fields?.add && {
            fields: {
              add
            }
          }),
          ...(field.schema && {
            schema
          })
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

        const ids = (await self.db
          .find({ locale: oldLocale })
          .project({ _id: 1 })
          .toArray())
          .map(version => version._id);

        let renamed = 0;
        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
          const versions = await self.find(
            req,
            { _id: { $in: ids.slice(i, i + batchSize) } },
            { sort: false }
          );
          const operations = await Promise.all(versions.map(async version => {
            const doc = self.renameDocLocale(version.doc, oldLocale, newLocale);
            return {
              updateOne: {
                filter: { _id: version._id },
                update: {
                  $set: {
                    locale: newLocale,
                    doc: await self.pack(doc)
                  }
                }
              }
            };
          }));
          const result = await self.db.bulkWrite(operations);
          renamed += result.modifiedCount;
        }

        return {
          renamed,
          kept
        };
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
