// Records a version of every localized, manually published document each
// time it is published, and lets editors browse, compare and restore them.
// Versions live in the `aposDocsVersions` collection.

const { createId } = require('@paralleldrive/cuid2');
const _ = require('lodash');
const { stripIndent } = require('common-tags');

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
      async getAll(req) {
        const docId = self.apos.launder
          .id(req.query.docId, '')
          .replace(/:[\w]+$/, ':published');

        if (!docId) {
          throw self.apos.error('invalid');
        }
        const permissionCheck = await self.getRestDocQuery(req.clone({ mode: 'draft' }))
          .and({ _id: docId.replace(':published', ':draft') })
          .toCount();

        if (!permissionCheck) {
          throw self.apos.error('notfound');
        }

        const pager = await self.getRestPager(req, docId);
        const versions = await self.find(
          req,
          { docId },
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

        const lastVersion = await self.findOne(req, { docId: doc._id });

        const changeCount = lastVersion
          ? self.apos.schema.getChanges(
            req,
            manager.schema,
            self.apos.util.clonePermanent(doc),
            lastVersion.doc
          )
          : [];

        const instance = {
          ...self.newInstance(doc, req.user),
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
      // Remove all versions and attachment references for a given doc
      async removeAllFor(req, doc) {
        const docId = doc._id.replace(/:[\w]+$/, ':published');
        const cursor = self.getFindCursor({ docId });
        while (await cursor.hasNext()) {
          const version = await cursor.next();
          await self.db.deleteOne({ _id: version._id });
          await self.apos.attachment.updateDocReferences({
            ...version.doc,
            _id: version._id
          }, {
            deleted: true
          });
        }
      },
      // Insert new version into the DB
      async insert(req, versionDoc) {
        await self.emit('beforeInsert', req, versionDoc);
        return self.db.insertOne(versionDoc);
      },
      // Retrieve versions from the DB.
      // options.limit can be used for pagination, not set by default.
      // Sort option (options.sort) defaults to (descending) version.createdAt.
      // options.skip can be used for pagination, not set by default.
      // MongoDB projection is provided via `options.project`.
      async find(req, criteria, options = {}) {
        if (!req || Object.keys(req).length === 0) {
          throw new Error('req argument is required. Usage: find(req, criteria)');
        }
        const opts = { ...options };
        if (!opts.sort && opts.sort !== false) {
          opts.sort = self.defaultSort;
        }
        return self.getFindCursor(criteria, opts)
          .toArray();
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
      async getRestPager(req, docId) {
        const perPage = self.defaultLimit;
        const total = await self.count(req, { docId });
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

      // Create new version doc instance from a given doc and the current user.
      // The current user is optional.
      newInstance(doc, currentUser) {
        const author = currentUser
          ? currentUser.title || currentUser.username
          : 'SYSTEM';
        const docId = doc._id;

        return {
          _id: createId(),
          metaType: 'version',
          createdAt: new Date(),
          docId,
          author,
          doc: self.apos.util.clonePermanent(doc)
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
              doc: 1
            }
          }
        );
        if (!version) {
          throw new ReferenceError('version');
        }

        const permissionCheck = await self.getRestDocQuery(draftReq)
          .and({ _id: version.docId.replace(':published', ':draft') })
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
      async setChangeCountTask() {
        const req = self.apos.task.getReq();
        const docIds = await self.db.distinct('docId');

        for (const docId of docIds) {
          const versions = await self.db.find({ docId })
            .sort({ createdAt: -1 })
            .toArray();

          if (!versions.length) {
            continue;
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
            continue;
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
        }
      },
      // Rename a locale in the version records. Same contract as
      // `@apostrophecms/i18n.rename`, which calls this after renaming the docs.
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

        const docIds = await self.db
          .aggregate([
            {
              $match: {
                docId: new RegExp(`:${self.apos.util.regExpQuote(oldLocale)}:`),
                'doc.aposLocale': new RegExp(`^${self.apos.util.regExpQuote(oldLocale)}:`)
              }
            },
            {
              $group: {
                _id: {
                  docId: '$docId'
                }
              }
            },
            {
              $project: {
                _id: 0,
                docId: '$_id.docId'
              }
            }
          ])
          .toArray();

        const { renamed, kept } = await self.changeDocIds(
          docIds.map(doc => [
            doc.docId,
            doc.docId.replace(`:${oldLocale}`, `:${newLocale}`)
          ]),
          {
            keep: (keep === oldLocale)
              ? 'old'
              : (keep === newLocale)
                ? 'new'
                : false
          }
        );

        return {
          renamed,
          kept
        };
      },

      // `pairs` is an array of arrays, each containing an old _id
      // and a new _id that should replace it.
      //
      // `aposDocId` is implicitly updated, `path` is updated if a page,
      // after which attachment references are updated.
      // This is a slow operation, which is why this method should be called only
      // by migrations and tasks that remedy an unexpected situation. _id is
      // meant to be an immutable property, this method is a workaround
      // for situations like a renamed locale or a replication bug fix.
      //
      // If `skipReplace` is set to `true`, the method will exit without updating anything
      async changeDocIds(pairs, { skipReplace = false } = {}) {
        if (skipReplace) {
          // Callers use skipReplace to keep both ids side by side;
          // versions follow one id only
          return {
            renamed: 0,
            kept: 0
          };
        }

        let renamed = 0;

        for (const pair of pairs) {
          const [ from, to ] = pair;
          const existing = await self.db.findOne({ docId: from });
          if (!existing) {
            throw self.apos.error('notfound');
          }

          try {
            const parts = to.split(':');
            const $set = {
              docId: to,
              'doc._id': to,
              'doc.aposDocId': parts[0]
            };

            // Watch out for nonlocalized types, don't set aposLocale for them
            if (parts.length > 1) {
              $set['doc.aposLocale'] = parts.slice(1).join(':');
            }

            const isPage = self.apos.page.isPage(existing.doc);
            if (isPage) {
              $set['doc.path'] = existing.doc.path?.replace(existing.doc.aposDocId, parts[0]);
            }

            const result = await self.db.updateMany(
              {
                docId: from
              },
              {
                $set
              }
            );
            renamed += result.modifiedCount;
          } catch (error) {
            if (!self.apos.doc.isUniqueError(error)) {
              // We cannot fix this error
              throw error;
            }

            throw self.apos.error('conflict');
          }
        }

        await self.changeAttachmentDocIds(pairs);

        return {
          renamed,
          kept: 0
        };
      },
      // Point the attachment references stored inside version records at the new ids
      async changeAttachmentDocIds(pairs) {
        for (const pair of pairs) {
          const [ from, to ] = pair;

          await self.db.updateMany(
            {
              docId: to,
              'doc.attachment.docIds': from
            },
            {
              $set: {
                'doc.attachment.docIds.$': to
              }
            }
          );
        }
      }
    };
  }
};
