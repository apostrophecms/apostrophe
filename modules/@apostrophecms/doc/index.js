const _ = require('lodash');
const cuid = require('cuid');
const { SemanticAttributes } = require('@opentelemetry/semantic-conventions');
const { klona } = require('klona');

// This module is responsible for managing all of the documents (apostrophe "docs")
// in the `aposDocs` mongodb collection.
//
// The `getManager` method should be used to obtain a reference to the module
// that manages a particular doc type, so that you can benefit from behavior
// specific to that module. One method of this module that you may sometimes use directly
// is `apos.doc.find()`, which returns a query[query](server-@apostrophecms/query.html) for
// fetching documents of all types. This is useful when implementing something
// like the [@apostrophecms/search](../@apostrophecms/search/index.html) module.
//
// ## Options
//
// ** `advisoryLockTimeout`: Apostrophe locks documents while they are
// being edited so that another user, or another tab for the same user,
// does not inadvertently interfere. These locks are refreshed frequently
// by the browser while they are held. By default, if the browser
// is not heard from for 15 seconds, the lock expires. Note that
// the browser refreshes the lock every 5 seconds. This timeout should
// be quite short as there is no longer any reliable way to force a browser
// to unlock the document when leaving the page.

module.exports = {
  options: {
    alias: 'doc',
    advisoryLockTimeout: 15
  },
  async init(self) {
    self.managers = {};
    self.contextOperations = [];
    self.enableBrowserData();
    await self.enableCollection();
    self.apos.isNew = await self.detectNew();
    await self.createIndexes();
    self.addLegacyMigrations();
    self.addCacheFieldMigration();
    self.addSetPreviousDocsAposModeMigration();
  },
  restApiRoutes(self) {
    return {
      // GET /api/v1/@apostrophecms/doc/_id supports only the universal query
      // features, but works for any document type. Simplifies browser-side
      // logic for redirects to foreign documents. The frontend only has to
      // know the doc _id.
      //
      // Since this API is solely for editing purposes you will receive
      // a 404 if you request a document you cannot edit.
      async getOne(req, _id) {
        _id = self.apos.i18n.inferIdLocaleAndMode(req, _id);
        const doc = await self.find(req, { _id }).permission('edit').toObject();
        if (!doc) {
          throw self.apos.error('notfound');
        }
        return doc;
      }
    };
  },
  apiRoutes(self) {
    return {
      post: {
        async slugTaken(req) {
          if (!req.user) {
            throw self.apos.error('notfound');
          }
          const slug = self.apos.launder.string(req.body.slug);
          const _id = self.apos.launder.id(req.body._id);
          const criteria = { slug: slug };
          if (_id) {
            criteria._id = { $ne: _id };
          }
          const doc = await self.find(req, criteria).permission(false).archived(null).project({ slug: 1 }).toObject();
          if (doc) {
            throw self.apos.error('conflict');
          } else {
            return {
              available: true
            };
          }
        },
        // Fast bulk query for doc `ids` that the user is permitted to edit.
        //
        // IDs should be sent as an array in the `ids` property of the POST
        // request.
        //
        // The response object contains an `editable` array made up of
        // the ids of those documents in the original set that the user
        // is actually permitted to edit. Those the user cannot edit
        // are not included. The original order is preserved.
        //
        // This route is a POST route because large numbers of ids
        // might not be accepted as a query string.
        async editable(req) {
          if (!req.user) {
            throw self.apos.error('notfound');
          }
          const ids = self.apos.launder.ids(req.body.ids);
          if (!ids.length) {
            return {
              editable: []
            };
          }
          const found = await self.apos.doc.find(req, {
            _id: {
              $in: ids
            }
          }).project({ _id: 1 }).permission('edit').toArray();
          return {
            editable: self.apos.util.orderById(ids, found).map(doc => doc._id)
          };
        }
      }
    };
  },
  handlers(self) {
    return {
      '@apostrophecms/doc-type:beforeInsert': {
        setLocaleAndMode(req, doc, options) {
          const manager = self.getManager(doc.type);
          if (manager.isLocalized()) {
            doc.aposLocale = doc.aposLocale || `${req.locale}:${req.mode}`;
            doc.aposMode = req.mode;
          }
        },
        testPermissionsAndAddIdAndCreatedAt(req, doc, options) {
          self.testInsertPermissions(req, doc, options);
          const manager = self.getManager(doc.type);
          if (doc._id && manager.isLocalized()) {
            if (!doc.aposDocId) {
              const components = doc._id.split(':');
              if (components.length < 3) {
                throw new Error('If you supply your own _id it must end with :locale:mode, like :en:published');
              }
              doc.aposDocId = components[0];
              doc.aposLocale = `${components[1]}:${components[2]}`;
            }
          }
          if (!doc.aposDocId) {
            doc.aposDocId = self.apos.util.generateId();
          }
          if (!doc._id) {
            if (!doc.aposLocale) {
              if (manager.isLocalized()) {
                doc.aposLocale = `${req.locale}:${req.mode}`;
              }
            }
            if (doc.aposLocale) {
              doc._id = `${doc.aposDocId}:${doc.aposLocale}`;
            } else {
              doc._id = doc.aposDocId;
            }
          }
          doc.metaType = 'doc';
          doc.createdAt = new Date();
          if (doc.archived == null) {
            // Not always in the schema, so ensure it's true or false
            // to simplify queries and indexing
            doc.archived = false;
          }
        },
        // Makes using our model APIs directly less tedious
        ensureAreaAndWidgetIds(req, doc, options) {
          self.apos.area.walk(doc, area => {
            if (!area._id) {
              area._id = self.apos.util.generateId();
            }
            for (const item of (area.items || [])) {
              if (!item._id) {
                item._id = self.apos.util.generateId();
              }
            }
          });
        }
      },
      '@apostrophecms/doc-type:beforeDelete': {
        testPermissions(req, doc, options) {
          if (!(options.permissions === false)) {
            if (!self.apos.permission.can(req, 'delete', doc)) {
              throw self.apos.error('forbidden');
            }
          }
        }
      },
      '@apostrophecms/doc-type:beforePublish': {
        testPermissions(req, info) {
          if (info.options.permissions !== false) {
            if (!self.apos.permission.can(req, info.options.autopublishing ? 'edit' : 'publish', info.draft)) {
              throw self.apos.error('forbidden');
            }
          }
        }
      },
      '@apostrophecms/doc-type:beforeSave': {
        ensureSlugSortifyAndUpdatedAt(req, doc, options) {
          const manager = self.getManager(doc.type);
          manager.ensureSlug(doc);
          _.each(manager.schema, function (field) {
            if (field.sortify) {
              doc[field.name + 'Sortified'] = self.apos.util.sortify(doc[field.name] ? doc[field.name] : '');
            }
          });
          if (options.setUpdatedAtAndBy !== false) {
            const date = new Date();
            doc.updatedAt = date;
            doc.cacheInvalidatedAt = date;
            doc.updatedBy = req.user ? {
              _id: req.user._id,
              title: req.user.title || null,
              username: req.user.username
            } : {
              username: 'ApostropheCMS'
            };
          }
        },
        deduplicateWidgetIds(req, doc, options) {
          this.deduplicateWidgetIds(doc);
        }
      },
      '@apostrophecms/doc-type:afterInsert': {
        async ensureDraftExists(req, doc, options) {
          const manager = self.getManager(doc.type);
          if (!manager.isLocalized()) {
            return;
          }
          if (self.isDraft(doc)) {
            return;
          }
          const draftLocale = doc.aposLocale.replace(':published', ':draft');
          const draftId = `${doc.aposDocId}:${draftLocale}`;
          if (await self.db.findOne({
            _id: draftId
          }, {
            projection: {
              _id: 1
            }
          })) {
            return;
          }
          const draft = {
            ...doc,
            _id: draftId,
            aposLocale: draftLocale,
            lastPublishedAt: doc.createdAt || new Date()
          };
          return manager.insertDraftOf(req, doc, draft, options);
        }
      },
      fixUniqueError: {
        async fixUniqueSlug(req, doc) {
          doc.slug += Math.floor(Math.random() * 10).toString();
        }
      },
      '@apostrophecms/doc-type:beforeUpdate': {
        async checkPermissionsBeforeUpdate(req, doc, options) {
          if (options.permissions !== false) {
            if (!self.apos.permission.can(req, 'edit', doc)) {
              throw new Error('forbidden');
            }
          }
        }
      },
      '@apostrophecms/version:unversionedFields': {
        baseUnversionedFields(req, doc, fields) {
          fields.push('visibility');
        }
      },
      '@apostrophecms/doc-type:afterDelete': {
        // Deleting a draft implies deleting the document completely, since
        // a draft must always exist. Deleting a published doc implies deleting
        // the "previous" copy, since it only makes sense as a tool to revert
        // the published doc's content. Note that deleting a draft recursively
        // deletes both the published and previous docs.
        async deleteOtherModes(req, doc, options) {
          if (doc.aposLocale && doc.aposLocale.endsWith(':draft')) {
            await cleanup('published');
            await self.emit('afterAllModesDeleted', req, doc, options);
            return;
          }
          if (doc.aposLocale && doc.aposLocale.endsWith(':published')) {
            return cleanup('previous');
          }
          async function cleanup(mode) {
            const peer = await self.apos.doc.db.findOne({
              _id: doc._id.replace(/:[\w]+$/, `:${mode}`)
            });
            if (peer) {
              const manager = peer.slug.startsWith('/') ? self.apos.page : self.getManager(peer.type);
              await manager.delete(req, peer, options);
            }
          }
        }
      }
    };
  },
  methods(self) {
    return {
      // `pairs` is an array of arrays, each containing an old _id
      // and a new _id that should replace it.
      //
      // `aposDocId` is implicitly updated, `path` is updated if a page,
      // and all references found in relationships are updated via reverse
      // relationship id lookups, after which attachment references are updated.
      // This is a slow operation, which is why this method should be called only
      // by migrations and tasks that remedy an unexpected situation. _id is
      // meant to be an immutable property, this method is a workaround
      // for situations like a renamed locale or a replication bug fix.
      //
      // If `keep` is set to `'old'` the old document's content wins
      // in the event of a conflict. If `keep` is set to `'new'` the
      // new document's content wins in the event of a conflict.
      // If `keep` is not set, a `conflict` error is thrown in the
      // event of a conflict.

      async changeDocIds(pairs, { keep } = {}) {
        let renamed = 0;
        let kept = 0;
        // Get page paths up front so we can avoid multiple queries when working on path changes
        const pages = await self.apos.doc.db.find({
          path: { $exists: 1 },
          slug: /^\//
        }).project({
          path: 1,
          aposLastTargetId: 1
        }).toArray();
        for (const pair of pairs) {
          const [ from, to ] = pair;
          const existing = await self.apos.doc.db.findOne({ _id: from });
          if (!existing) {
            throw self.apos.error('notfound');
          }
          const replacement = klona(existing);
          await self.apos.doc.db.removeOne({ _id: from });
          const oldAposDocId = existing.aposDocId;
          replacement._id = to;
          const parts = to.split(':');
          replacement.aposDocId = parts[0];
          // Watch out for nonlocalized types, don't set aposLocale for them
          if (parts.length > 1) {
            replacement.aposLocale = parts.slice(1).join(':');
          }
          const isPage = self.apos.page.isPage(existing);
          if (isPage) {
            replacement.path = existing.path.replace(existing.aposDocId, replacement.aposDocId);
          }
          try {
            await self.apos.doc.db.insertOne(replacement);
            renamed++;
          } catch (e) {
            // First reinsert old doc to prevent content loss on new doc insert failure
            await self.apos.doc.db.insertOne(existing);
            if (!self.apos.doc.isUniqueError(e)) {
              // We cannot fix this error
              throw e;
            }
            const existingReplacement = await self.apos.doc.db.findOne({ _id: replacement._id });
            if (!existingReplacement) {
              // We don't know the cause of this error
              throw e;
            }
            if (keep === 'new') {
              // New content already exists in new locale, delete old locale
              // and keep new
              await self.apos.doc.db.removeOne({ _id: existing._id });
              kept++;
            } else if (keep === 'old') {
              // We want to keep the old content, but with the new
              // identifiers. Once again we need to remove the old doc first
              // to cut down on conflicts
              try {
                await self.apos.doc.db.deleteOne({ _id: existing._id });
                await self.apos.doc.db.deleteOne({ _id: replacement._id });
                await self.apos.doc.db.insertOne(replacement);
                renamed++;
              } catch (e) {
                // Reinsert old doc to prevent content loss on new doc insert failure
                await self.apos.doc.db.insertOne(existing);
                throw e;
              }
              kept++;
            } else {
              throw self.apos.error('conflict');
            }
          }
          if (isPage) {
            for (const page of pages) {
              if (page.aposLastTargetId === from) {
                await self.apos.doc.db.updateOne({
                  _id: page._id
                }, {
                  $set: {
                    aposLastTargetId: to
                  }
                });
              }
              if (page.path.includes(oldAposDocId)) {
                await self.apos.doc.db.updateOne({
                  _id: page._id
                }, {
                  $set: {
                    path: page.path.replace(oldAposDocId, replacement.aposDocId)
                  }
                });
              }
            }
          }
          if (existing.relatedReverseIds?.length) {
            const relatedDocs = await self.apos.doc.db.find({
              aposDocId: { $in: existing.relatedReverseIds }
            }).toArray();
            for (const doc of relatedDocs) {
              replaceId(doc, oldAposDocId, replacement.aposDocId);
              await self.apos.doc.db.replaceOne({
                _id: doc._id
              }, doc);
            }
          }
        }
        await self.apos.attachment.recomputeAllDocReferences();
        return {
          renamed,
          kept
        };
        function replaceId(obj, oldId, newId) {
          if (obj == null) {
            return;
          }
          if ((typeof obj) !== 'object') {
            return;
          }
          for (const key of Object.keys(obj)) {
            if (obj[key] === oldId) {
              obj[key] = newId;
            } else {
              replaceId(obj[key], oldId, newId);
            }
          }
        }
      },
      async enableCollection() {
        self.db = await self.apos.db.collection('aposDocs');
      },
      // Detect whether the database is brand new (zero documents).
      // This can't be done later because after this point init()
      // functions are permitted to insert documents
      async detectNew() {
        const existing = await self.db.countDocuments();
        return !existing;
      },
      async createSlugIndex() {
        const params = self.getSlugIndexParams();
        return self.db.createIndex(params, { unique: true });
      },
      getSlugIndexParams() {
        return {
          slug: 1,
          aposLocale: 1
        };
      },
      getPathLevelIndexParams() {
        return {
          path: 1,
          level: 1,
          aposLocale: 1
        };
      },
      async createIndexes() {
        await self.db.createIndex({
          type: 1,
          aposLocale: 1
        }, {});
        await self.createSlugIndex();
        await self.db.createIndex({
          titleSortified: 1,
          aposLocale: 1
        }, {});
        await self.db.createIndex({
          updatedAt: -1,
          aposLocale: 1
        }, {});
        await self.db.createIndex({
          relatedReverseIds: 1,
          aposLocale: 1
        }, {});
        await self.db.createIndex({ 'advisoryLock._id': 1 }, {});
        await self.createTextIndex();
        await self.db.createIndex({ parkedId: 1 }, {});
        await self.db.createIndex({
          submitted: 1,
          aposLocale: 1
        });
        await self.db.createIndex({
          type: 1,
          aposDocId: 1,
          aposLocale: 1
        });
        await self.db.createIndex({
          aposDocId: 1,
          aposLocale: 1
        });
        await self.createPathLevelIndex();
      },
      async createTextIndex() {
        try {
          return await attempt();
        } catch (e) {
          // We are experiencing what may be a mongodb bug in which these indexes
          // have different weights than expected and the createIndex call fails.
          // If this happens drop and recreate the text index
          if (e.toString().match(/different options/)) {
            self.apos.util.warn('Text index has unexpected weights or other misconfiguration, reindexing');
            await self.db.dropIndex('highSearchText_text_lowSearchText_text_title_text_searchBoost_text');
            return await attempt();
          } else {
            throw e;
          }
        }
        function attempt() {
          return self.db.createIndex({
            highSearchText: 'text',
            lowSearchText: 'text',
            title: 'text',
            searchBoost: 'text'
          }, {
            default_language: self.options.searchLanguage || 'none',
            weights: {
              title: 100,
              searchBoost: 150,
              highSearchText: 10,
              lowSearchText: 2
            }
          });
        }
      },
      async createPathLevelIndex() {
        const params = self.getPathLevelIndexParams();
        return self.db.createIndex(params, {});
      },

      // Returns a query based on the permissions
      // associated with the given request. You can then
      // invoke chainable query builders like `.project()`,
      // `limit()`, etc. to alter the query before ending
      // the chain with an awaitable method like `toArray()`
      // to obtain documents.
      //
      // `req` determines what documents the user is allowed
      // to see. `criteria` is a MongoDB criteria object,
      // see the MongoDB documentation for basics on this.
      // If an `options` object is present, query builder
      // methods with the same name as each property are
      // invoked, with the value of that property. This is
      // an alternative to chaining methods.
      //
      // This method returns a query, not docs! You
      // need to chain it with toArray() or other
      // query methods and await the result:
      //
      // await apos.doc.find(req, { type: 'foobar' }).toArray()

      find(req, criteria = {}, options = {}) {
        return self.apos.modules['@apostrophecms/any-doc-type'].find(req, criteria, options);
      },

      // **Most often you will insert or update docs via the
      // insert and update methods of the appropriate doc manager.**
      // This method is for implementation use in those objects,
      // and for times when you wish to explicitly bypass type-specific
      // lifecycle events.
      //
      // Insert the given document. If the slug is not
      // unique it is made unique. `beforeInsert`, `beforeSave`, `afterInsert`
      // and `afterSave` events are emitted via the appropriate doc type manager,
      // then awaited. They receive `(req, doc, options)`.
      //
      // Returns the inserted document.
      //
      // If the slug property is not set, the title
      // property is converted to a slug. If neither
      // property is set, an error is thrown.
      //
      // The `edit-type-name` permission is checked based on
      // doc.type.
      //
      // If a unique key error occurs, the `@apostrophecms/doc:fixUniqueError`
      // event is emitted and the doc is passed to all handlers.
      // Modify the document to fix any properties that may need to be
      // more unique due to a unique index you have added. It is
      // not possible to know which property was responsible. This method
      // takes care of the slug property directly.
      //
      // The `options` object may be omitted completely.
      //
      // If `options.permissions` is set explicitly to
      // `false`, permissions checks are bypassed.
      async insert(req, doc, options) {
        const telemetry = self.apos.telemetry;
        return telemetry.startActiveSpan(`model:${doc.type}:insert`, async (span) => {
          span.setAttribute(SemanticAttributes.CODE_FUNCTION, 'insert');
          span.setAttribute(SemanticAttributes.CODE_NAMESPACE, self.__meta.name);
          span.setAttribute(telemetry.Attributes.TARGET_NAMESPACE, doc.type);
          span.setAttribute(telemetry.Attributes.TARGET_FUNCTION, 'insert');

          try {
            options = options || {};
            const m = self.getManager(doc.type);
            await m.emit('beforeInsert', req, doc, options);
            await m.emit('beforeSave', req, doc, options);

            await telemetry.startActiveSpan(`db:${doc.type}:insert`, async (spanInsert) => {
              spanInsert.setAttribute(SemanticAttributes.CODE_FUNCTION, 'insertBody');
              spanInsert.setAttribute(SemanticAttributes.CODE_NAMESPACE, self.__meta.name);
              spanInsert.setAttribute(telemetry.Attributes.TARGET_NAMESPACE, doc.type);
              spanInsert.setAttribute(telemetry.Attributes.TARGET_FUNCTION, 'insert');
              try {
                const result = await self.insertBody(req, doc, options);
                spanInsert.setStatus({ code: telemetry.api.SpanStatusCode.OK });
                return result;
              } catch (e) {
                telemetry.handleError(spanInsert, e);
                throw e;
              } finally {
                spanInsert.end();
              }
            }, span, {});

            await m.emit('afterInsert', req, doc, options);
            await m.emit('afterSave', req, doc, options);
            // TODO: Remove `afterLoad` in next major version. Deprecated.
            await m.emit('afterLoad', req, [ doc ]);
            span.setStatus({ code: telemetry.api.SpanStatusCode.OK });
            return doc;
          } catch (err) {
            telemetry.handleError(span, err);
            throw err;
          } finally {
            span.end();
          }
        });
      },
      // Updates the given document. If the slug is not
      // unique it is made unique. `beforeUpdate`, `beforeSave`,
      // `afterUpdate` and `afterSave` events are emitted
      // via the appropriate doc type manager.
      //
      // The second argument must be the document itself.
      // `$set`, `$inc`, etc. are NOT available via
      // this interface. This simplifies the implementation
      // of permissions and workflow. If you need to
      // update an object, find it first and then update it.
      //
      // Returns the updated doc.
      //
      // If a unique key error occurs, the `@apostrophecms/doc:fixUniqueError`
      // event is emitted and the doc is passed to all handlers.
      // Modify the document to fix any properties that may need to be
      // more unique due to a unique index you have added. It is
      // not possible to know which property was responsible. This method
      // takes care of the slug property directly.
      //
      // The `options` object may be omitted completely.
      //
      // If `options.permissions` is set explicitly to
      // `false`, permissions checks are bypassed.
      async update(req, doc, options) {
        const telemetry = self.apos.telemetry;
        return telemetry.startActiveSpan(`model:${doc.type}:update`, async (span) => {
          span.setAttribute(SemanticAttributes.CODE_FUNCTION, 'update');
          span.setAttribute(SemanticAttributes.CODE_NAMESPACE, self.__meta.name);
          span.setAttribute(telemetry.Attributes.TARGET_NAMESPACE, doc.type);
          span.setAttribute(telemetry.Attributes.TARGET_FUNCTION, 'update');

          try {
            options = options || {};
            const m = self.getManager(doc.type);
            await m.emit('beforeUpdate', req, doc, options);
            await m.emit('beforeSave', req, doc, options);

            await telemetry.startActiveSpan(`db:${doc.type}:update`, async (spanUpdate) => {
              spanUpdate.setAttribute(SemanticAttributes.CODE_FUNCTION, 'updateBody');
              spanUpdate.setAttribute(SemanticAttributes.CODE_NAMESPACE, self.__meta.name);
              spanUpdate.setAttribute(telemetry.Attributes.TARGET_NAMESPACE, doc.type);
              spanUpdate.setAttribute(telemetry.Attributes.TARGET_FUNCTION, 'update');
              try {
                const result = await self.updateBody(req, doc, options);
                spanUpdate.setStatus({ code: telemetry.api.SpanStatusCode.OK });
                return result;
              } catch (e) {
                telemetry.handleError(spanUpdate, e);
                throw e;
              } finally {
                spanUpdate.end();
              }
            }, span, {});

            await m.emit('afterUpdate', req, doc, options);
            await m.emit('afterSave', req, doc, options);
            // TODO: Remove `afterLoad` in next major version. Deprecated.
            await m.emit('afterLoad', req, [ doc ]);
            span.setStatus({ code: telemetry.api.SpanStatusCode.OK });
            return doc;
          } catch (err) {
            telemetry.handleError(span, err);
            throw err;
          } finally {
            span.end();
          }
        });
      },

      // True delete. To place a document in the archive,
      // update the archived property (for a piece) or move it
      // to be a child of the archive (for a page). True delete
      // cannot be undone.
      //
      // This operation ignores the locale and mode of `req`
      // in favor of the actual document's locale and mode.
      async delete(req, doc, options = {}) {
        options = options || {};
        const m = self.getManager(doc.type);
        await m.emit('beforeDelete', req, doc, options);
        await self.deleteBody(req, doc, options);
        await m.emit('afterDelete', req, doc, options);
      },

      // Publish the given draft. If `options.permissions` is explicitly
      // set to `false`, permissions checks are bypassed.
      async publish(req, draft, options = {}) {
        const m = self.getManager(draft.type);
        return m.publish(req, draft, options);
      },

      // Unpublish a given document.
      async unpublish(req, doc) {
        const m = self.getManager(doc.type);
        return m.unpublish(req, doc);
      },

      // Revert to the previously published content, or if
      // already equal to the previously published content, to the
      // publication before that. Returns `false` if the draft
      // cannot be reverted any further.
      async revert(req, draft) {
        const m = self.getManager(draft.type);
        return m.revert(req, draft);
      },

      // Recursively visit every property of a doc,
      // invoking an iterator function for each one. Optionally
      // deletes properties.
      //
      // The `_originalWidgets` property and its subproperties
      // are not walked because they are temporary information
      // present only to preserve widgets during save operations
      // performed by users without permissions for those widgets.
      //
      // The second argument must be a function that takes
      // an object, a key, a value, a "dot path" and an
      // array containing the ancestors of this property
      // (beginning with the original `doc` and including
      // "object") and explicitly returns `false` if that property
      // should be discarded. If any other value is returned the
      // property remains.
      //
      // Remember, keys can be numbers; toString() is
      // your friend.
      //
      // If the original object looks like:
      //
      // { a: { b: 5 } }
      //
      // Then when the iterator is invoked for b, the
      // object will be { b: 5 }, the key
      // will be `b`, the value will be `5`, the dotPath
      // will be the string `a.b`, and ancestors will be
      // [ { a: { b: 5 } } ].
      //
      // You do not need to pass the `_dotPath` and `_ancestors` arguments.
      // They are used for recursive invocation.
      walk(doc, iterator, _dotPath, _ancestors) {
        // We do not use lodash here because of
        // performance issues.
        //
        // Pruning big nested objects is not something we
        // can afford to do slowly. -Tom
        if (_dotPath !== undefined) {
          _dotPath += '.';
        } else {
          _dotPath = '';
        }
        _ancestors = (_ancestors || []).concat(doc);
        const remove = [];
        for (const key in doc) {
          const __dotPath = _dotPath + key.toString();
          const ow = '_originalWidgets';
          if (__dotPath === ow || __dotPath.substring(0, ow.length) === ow + '.') {
            continue;
          }
          if (iterator(doc, key, doc[key], __dotPath, _ancestors) === false) {
            remove.push(key);
          } else {
            const val = doc[key];
            if (typeof val === 'object') {
              self.walk(val, iterator, __dotPath, _ancestors.concat([ doc ]));
            }
          }
        }
        for (const key of remove) {
          delete doc[key];
        }
      },
      // Retry the given "actor" async function until it
      // does not yield a MongoDB error related to
      // unique indexes. The actor is not passed
      // any arguments and it will be awaited. If
      // an error related to uniqueness does occur, this module emits the
      // `fixUniqueError` event with `req, doc` before
      // the next retry. This is your opportunity to
      // tweak properties relating to unique indexes
      // this module does not know about.
      //
      // Passes on the return value of `actor`.
      //
      // Will make no more than 20 attempts, which statistically eliminates
      // any chance we just didn't try hard enough while avoiding
      // an infinite loop if the unique key error is due to a property
      // there is no handling for.
      async retryUntilUnique(req, doc, actor) {
        const maxAttempts = 20;
        let attempt = 0;
        let firstError;
        while (true) {
          try {
            return await actor();
          } catch (err) {
            if (!self.isUniqueError(err)) {
              throw err;
            }
            if (!firstError) {
              firstError = err;
            }
            attempt++;
            if (attempt === maxAttempts) {
              // Odds are now 1 in 100000000000000000000 that it is really due
              // to a duplicate path or slug; a far more likely explanation is
              // that another docFixUniqueError handler is needed to address
              // an additional property that has to be unique. Report the
              // original error to avoid confusion ("ZOMG, what are all these digits!")
              firstError.aposAddendum = 'retryUntilUnique failed, most likely you need another docFixUniqueError method to handle another property that has a unique index, reporting original error';
              throw firstError;
            }
            await self.emit('fixUniqueError', req, doc);
          }
        }
      },
      // Called by an `@apostrophecms/doc-type:insert` event handler to confirm that the user
      // has the appropriate permissions for the doc's type and content.
      testInsertPermissions(req, doc, options) {
        if (!(options.permissions === false)) {
          if (!self.apos.permission.can(req, 'edit', doc)) {
            throw self.apos.error('forbidden');
          }
        }
      },
      // Do not call this yourself, it is called
      // by .update(). You will usually want to call the
      // update method of the appropriate doc type manager instead:
      //
      // self.apos.doc.getManager(doc.type).update(...)
      //
      // You may override this method to change the implementation.
      async updateBody(req, doc, options) {
        const manager = self.apos.doc.getManager(doc.type);
        if (manager.isLocalized(doc.type)) {
          // Performance hit now at write time is better than inaccurate
          // indicators of which docs are modified later (per Ben)
          if (doc.aposLocale.endsWith(':draft') && (options.setModified !== false)) {
            doc.modified = await manager.isModified(req, doc);
          }
        }
        const result = await self.retryUntilUnique(req, doc, async () => {
          return self.db.replaceOne({ _id: doc._id }, self.apos.util.clonePermanent(doc));
        });
        if (manager.isLocalized(doc.type)) {
          if (doc.aposLocale.endsWith(':published')) {
            // The reverse can happen too: published changes
            // (for instance because a move operation gets
            // repeated on it) and draft is no longer out of sync
            const modified = await manager.isModified(req, doc);
            await self.apos.doc.db.updateOne({
              _id: doc._id.replace(':published', ':draft')
            }, {
              $set: {
                modified
              }
            });
          }
        }
        return result;
      },

      async deleteBody(req, doc, options) {
        if ((options.permissions !== false) && (!self.apos.permission.can(req, 'delete', doc))) {
          throw self.apos.error('forbidden');
        }
        return self.db.removeOne({
          _id: doc._id
        });
      },

      // Insert the given document. Called by `.insert()`. You will usually want to
      // call the insert method of the appropriate doc type manager instead:
      //
      // ```javascript
      // self.apos.doc.getManager(doc.type).insert(...)
      // ```
      //
      // However you can override this method to alter the
      // implementation.
      async insertBody(req, doc, options) {
        const manager = self.apos.doc.getManager(doc.type);
        if (manager.isLocalized(doc.type) && doc.aposLocale.endsWith(':draft')) {
          // We are inserting the draft for the first time so it is always
          // different from the published, which won't exist yet. An exception
          // is when the published doc is inserted first (like a parked page)
          // in which case setModified: false will be passed in
          if (options.setModified !== false) {
            doc.modified = true;
          }
        }
        if (!doc.visibility) {
          // If the visibility property has been removed from the schema
          // (images and files), make sure public queries can still match this type
          doc.visibility = 'public';
        }
        return self.retryUntilUnique(req, doc, async function () {
          return self.db.insertOne(self.apos.util.clonePermanent(doc));
        });
      },

      // Given either an id (as a string) or a criteria
      // object, return a criteria object.
      idOrCriteria(idOrCriteria) {
        if (typeof idOrCriteria === 'object') {
          return idOrCriteria;
        } else {
          return { _id: idOrCriteria };
        }
      },
      // Is this MongoDB error related to uniqueness? Great for retrying on duplicates.
      // Used heavily by the pages module and no doubt will be by other things.
      //
      // There are three error codes for this: 13596 ("cannot change _id of a document")
      // and 11000 and 11001 which specifically relate to the uniqueness of an index.
      // 13596 can arise on an upsert operation, especially when the _id is assigned
      // by the caller rather than by MongoDB.
      //
      // IMPORTANT: you are responsible for making sure ALL of your unique indexes
      // are accounted for before retrying... otherwise an infinite loop will
      // likely result.
      isUniqueError(err) {
        if (!err) {
          return false;
        }
        return err.code === 13596 || err.code === 13596 || err.code === 11000 || err.code === 11001;
      },
      // Set the manager object corresponding
      // to a given doc type. Typically `manager`
      // is a module that subclasses `@apostrophecms/doc-type`
      // (or its subclasses `@apostrophecms/piece-type` and `@apostrophecms/page-type`).
      setManager(type, manager) {
        self.managers[type] = manager;
      },
      // Returns an array of all of the doc types that have a registered manager.
      getManaged() {
        return Object.keys(self.managers);
      },
      // Fetch the manager object corresponding to a given
      // doc type. The manager object provides methods such
      // as find() specific to that type.
      //
      // If no manager has been registered, this method will
      // return undefined. **All** doc types used in your project must
      // have a registered manager (hint: all subclasses of
      // pieces, the `data.global` doc, and page types registered
      // with `@apostrophecms/page` always have one).
      getManager(type) {
        return self.managers[self.normalizeType(type)];
      },
      // Lock the given doc to a given `tabId`, such
      // that other calls to `apos.doc.lock` for that doc id will
      // fail unless they have the same `tabId`. If
      // `options.force` is true, any existing lock is
      // overwritten. The `options` argument may be
      // omitted entirely.
      //
      // You cannot lock a document that has not yet been inserted,
      // nor do you need to.
      //
      // If a lock cannot be obtained due to a conflict
      // a 'locked' error is thrown, with the `me: true` property if
      // the lock is held by the same user in another tab, or
      // `username` and `title` properties if the lock is held
      // by someone else. Other errors are thrown as appropriate.
      //
      // If you need to refresh a lock in order to avoid
      // expiration, just lock it again. As long as the tabId
      // is the same as the current lock holder you will receive
      // another successful response.
      //
      // This method will set the `advisoryLock` property of the
      // document both in the database and in the `doc` object
      // that you pass to it. This ensures it is present if you
      // follow this call up with an `update()` of the document.

      async lock(req, doc, tabId, options) {
        if (!options) {
          options = {};
        }
        if (!(req && req.res)) {
          // Use 'error' because this is always a code bug, not a bad
          // HTTP request, and the message should not be disclosed to the client
          throw self.apos.error('error', 'You forgot to pass req as the first argument');
        }
        if (!doc && doc._id) {
          throw self.apos.error('invalid', 'No doc was passed');
        }
        const _id = doc._id;
        if (!tabId) {
          throw self.apos.error('invalid', 'no tabId was passed');
        }
        let criteria = { _id };
        if (!options.force) {
          criteria.$or = [
            {
              advisoryLock: {
                $exists: 0
              }
            },
            {
              'advisoryLock.updatedAt': {
                $lt: self.getAdvisoryLockExpiration()
              }
            },
            {
              'advisoryLock._id': tabId
            }
          ];
        }
        // Prevent nuisance locking by matching only
        // documents the user can edit
        criteria = {
          $and: [
            criteria,
            self.apos.permission.criteria(req, 'edit')
          ]
        };
        doc.advisoryLock = {
          username: req.user && req.user.username,
          title: req.user && req.user.title,
          _id: tabId,
          updatedAt: new Date()
        };
        const result = await self.db.updateOne(criteria, {
          $set: {
            advisoryLock: doc.advisoryLock
          }
        });
        if (!result.result.nModified) {
          const info = await self.db.findOne({
            _id
          }, {
            projection: {
              advisoryLock: 1
            }
          });
          if (!info) {
            throw self.apos.error('notfound');
          }
          if (!info.advisoryLock) {
            // Nobody else has a lock but you couldn't get one —
            // must be permissions
            throw self.apos.error('forbidden');
          }
          if (!info.advisoryLock) {
            // Nobody else has a lock but you couldn't get one —
            // must be permissions
            throw self.apos.error('forbidden');
          }
          if (info.advisoryLock.username === req.user.username) {
            throw self.apos.error('locked', {
              me: true
            });
          }
          throw self.apos.error('locked', {
            title: info.advisoryLock.title,
            username: info.advisoryLock.username
          });
        }
      },
      // Any advisory lock whose `updatedAt` time is older than the Date
      // object returned by this method should be considered expired
      getAdvisoryLockExpiration() {
        return new Date(Date.now() - 1000 * self.options.advisoryLockTimeout);
      },
      // Release a document lock set via `lock` for a particular tabId.
      // If the lock is already gone no error occurs.
      //
      // This method will unset the `advisoryLock` property of the
      // document both in the database and in the `doc` object
      // that you pass to it. This ensures it is present if you
      // follow this call up with an `update()` of the document.
      async unlock(req, doc, tabId) {
        if (!(req && req.res)) {
          // Use 'error' because this is always a code bug, not a bad
          // HTTP request, and the message should not be disclosed to the client
          throw self.apos.error('error', 'You forgot to pass req as the first argument');
        }
        const id = doc && doc._id;
        if (!id) {
          throw self.apos.error('invalid', 'no doc');
        }
        if (!tabId) {
          throw self.apos.error('invalid', 'no tabId');
        }
        await self.db.updateOne({
          _id: id,
          'advisoryLock._id': tabId
        }, {
          $unset: {
            advisoryLock: 1
          }
        });
        delete doc.advisoryLock;
      },
      // Returns the field names necessary to build URLs
      // for typical doc types. If a query specific to a
      // doc type is used, the `getUrlFields` method of
      // that module is called instead. This method is
      // used to implement "projections" for the
      // `_url` computed property
      getDefaultUrlFields() {
        return [
          'type',
          'slug'
        ];
      },
      // Add context menu operation to be used in AposDocContextMenu.
      // Expected operation format is:
      // {
      //   context: 'update',
      //   action: 'someAction',
      //   modal: 'ModalComponent',
      //   label: 'Context Menu Label'
      // }
      // All properties are required.
      // The only supported `context` for now is `update`.
      // `action` is the operation identifier and should be globally unique.
      // Overriding existing custom actions is possible (the last wins).
      // `modal` is the name of the modal component to be opened.
      // `label` is the menu label to be shown when expanding the context menu.
      // Additional optional `modifiers` property is supported - button modifiers
      // as supported by `AposContextMenu` (e.g. modifiers: [ 'danger' ]).
      // An optional `manuallyPublished` boolean property is supported - if true
      // the menu will be shown only for docs which have `autopublish: false` and
      // `localized: true` options.
      addContextOperation(moduleName, operation) {
        self.contextOperations = [
          ...self.contextOperations
            .filter(op => op.action !== operation.action),
          {
            ...operation,
            moduleName
          }
        ];
      },
      getBrowserData(req) {
        return {
          action: self.action,
          contextOperations: self.contextOperations
        };
      },
      migrateRelationshipIds(doc) {
        if (doc.metaType === 'doc') {
          const manager = self.apos.doc.getManager(doc.type);
          if (!manager) {
            return false;
          }
          return forSchema(manager.schema, doc);
        } else if (doc.metaType === 'widget') {
          const manager = self.apos.area.getWidgetManager(doc.type);
          if (!manager) {
            return false;
          }
          return forSchema(manager.schema, doc);
        }
        function forSchema(schema, doc) {
          let needed = false;
          for (const field of schema) {
            if (field.type === 'area') {
              if (doc[field.name] && doc[field.name].items) {
                for (const widget of doc[field.name].items) {
                  self.migrateRelationshipIds(widget);
                }
              }
            } else if (field.type === 'array') {
              if (doc[field.name]) {
                doc[field.name].forEach(item => {
                  item.metaType = 'arrayItem';
                  item.scopedArrayName = field.scopedArrayName;
                  forSchema(field.schema, item);
                });
              }
            } else if (field.type === 'object') {
              const value = doc[field.name];
              if (value) {
                value.metaType = 'object';
                value.scopedObjectName = field.scopedObjectName;
                forSchema(field.schema, value);
              }
            } else if (field.type === 'relationship') {
              doc[field.idsStorage] = (doc[field.idsStorage] || []).map(self.apos.doc.toAposDocId);
              if (field.fieldsStorage) {
                doc[field.fieldsStorage] = Object.fromEntries(Object.entries(doc[field.fieldsStorage] || {}).map(([ key, value ]) => [ self.apos.doc.toAposDocId(key), value ]));
              }
              needed = true;
            }
          }
          return needed;
        }
      },
      isDraft(doc) {
        return doc.aposLocale.endsWith(':draft');
      },
      // Given a type name, normalize for any backwards compatibility
      // provisions such as accepting @apostrophecms/page for
      // @apostrophecms/any-page-type
      normalizeType(type) {
        if (type === '@apostrophecms/page') {
          // Backwards compatible
          return '@apostrophecms/any-page-type';
        }

        return type;
      },
      // Given a doc, an _id, or an aposDocId, this method
      // will return the aposDocId (the _id without the
      // mode and locale parts). This will work on a doc
      // even if the projection did not include aposDocId
      toAposDocId(input) {
        if (typeof input === 'object') {
          return input.aposDocId || self.toAposDocId(input._id);
        }
        const index = input.indexOf(':');
        if (index > -1) {
          return input.substring(0, index);
        } else {
          return input;
        }
      },
      // Replicate all documents that should automatically be replicated
      // across all locales: parked pages, and piece types with the
      // replicate: true option. The latter currently must be singletons
      // like the global doc or the palette doc, they cannot be types
      // with more than one instance per locale. Emits
      // `@apostrophecms/doc:beforeReplicate` with an array of criteria
      // to be used to locate docs that require replication, which can
      // be modified by event handlers. Also emits `@apostrophecms/doc:afterReplicate`
      // when replication is complete.
      async replicate() {
        const localeNames = Object.keys(self.apos.i18n.locales);
        const criteria = [];
        self.apos.page.parked.forEach(pushParkedPageAndParkedChildren);
        function pushParkedPageAndParkedChildren(page) {
          criteria.push({
            parkedId: page.parkedId
          });
          (page._children || []).forEach(pushParkedPageAndParkedChildren);
        }
        const pieceModules = Object.values(self.apos.modules).filter(module => self.apos.instanceOf(module, '@apostrophecms/piece-type') && module.options.replicate);
        for (const module of pieceModules) {
          criteria.push({
            type: module.name
          });
        }
        self.replicateReached = true;
        // Include the criteria array in the event so that more entries can be pushed to it
        await self.emit('beforeReplicate', criteria);
        // We can skip the core work of this method if there is only one locale,
        // but the events should always be emitted as the guarantee is still there
        // ("this is before replication if any," "this is after replication if any")
        // and we otherwise complicate modules that mainly care about not missing
        // out if there *is* replication
        if (localeNames.length > 1) {
          for (const criterion of criteria) {
            const existing = await self.apos.doc.db.find({
              ...criterion,
              aposLocale: {
                // Only interested in valid draft locales
                $in: Object.keys(self.apos.i18n.locales).map(locale => `${locale}:draft`)
              }
            }).project({
              _id: 1,
              aposLocale: 1
            }).toArray();
            for (const info of existing) {
              info.aposLocale = info.aposLocale.replace(':draft', '');
            }
            if ((existing.length > 0) && (existing.length < localeNames.length)) {
              const sourceInfo = self.apos.util.orderById(localeNames, existing, 'aposLocale')[0];
              const req = self.apos.task.getReq({
                locale: sourceInfo.aposLocale,
                mode: 'draft'
              });
              const sourceDoc = await self.apos.doc.find(req, {
                _id: sourceInfo._id
              }).archived(null).toObject();
              for (const locale of localeNames) {
                if (!existing.find(doc => doc.aposLocale === locale)) {
                  const module = self.getManager(sourceDoc.type);
                  const localized = await module.localize(req, sourceDoc, locale);
                  await module.publish(req.clone({ locale }), localized);
                }
              }
            }
          }
        }
        await self.emit('afterReplicate');
      },
      // Determine which locales exist for the given doc _id
      async getLocales(req, _id) {
        const criteria = {
          aposDocId: _id.split(':')[0]
        };
        if (!self.apos.permission.can(req, 'view-draft')) {
          criteria.aposMode = 'published';
        }
        const existing = await self.apos.doc.db.find(criteria).project({
          _id: 1,
          aposLocale: 1
        }).toArray();
        return existing;
      },
      deduplicateWidgetIds(doc) {
        const seen = new Set();
        self.apos.area.walk(doc, (area, dotPath) => {
          if (dotPath.includes('_')) {
            // Ignore relationships so recursive references from a
            // doc to itself can't result in random regeneration of
            // widget ids in the doc proper
            return;
          }
          for (const widget of area.items || []) {
            if ((!widget._id) || seen.has(widget._id)) {
              widget._id = cuid();
            } else {
              seen.add(widget._id);
            }
          }
        });
      },

      // Iterate through the document fields and call the provided handlers
      // for each item of an array, object and relationship field type.
      walkByMetaType(doc, handlers) {
        const defaultHandlers = {
          arrayItem: () => {},
          object: () => {},
          relationship: () => {}
        };

        handlers = {
          ...defaultHandlers,
          ...handlers
        };

        if (doc.metaType === 'doc') {
          const manager = self.getManager(doc.type);
          if (!manager) {
            return;
          }
          forSchema(manager.schema, doc);
        } else if (doc.metaType === 'widget') {
          const manager = self.apos.area.getWidgetManager(doc.type);
          if (!manager) {
            return;
          }
          forSchema(manager.schema, doc);
        }

        function forSchema(schema, doc) {
          for (const field of schema) {
            if (field.type === 'area' && doc[field.name] && doc[field.name].items) {
              for (const widget of doc[field.name].items) {
                self.walkByMetaType(widget, {
                  arrayItem: handlers.arrayItem,
                  object: handlers.object,
                  relationship: handlers.relationship
                });
              }
            } else if (field.type === 'array') {
              if (doc[field.name]) {
                doc[field.name].forEach(item => {
                  handlers.arrayItem(field, item);
                  forSchema(field.schema, item);
                });
              }
            } else if (field.type === 'object') {
              const value = doc[field.name];
              if (value) {
                handlers.object(field, value);
                forSchema(field.schema, value);
              }
            } else if (field.type === 'relationship') {
              if (Array.isArray(doc[field.name])) {
                handlers.relationship(field, doc);
              }
            }
          }
        }
      },
      // Add the "cacheInvalidatedAt" field to the documents that do not have it yet,
      // and set it to equal doc.updatedAt.
      setCacheField() {
        return self.apos.migration.eachDoc({ cacheInvalidatedAt: { $exists: 0 } }, 5, async doc => {
          await self.apos.doc.db.updateOne({ _id: doc._id }, {
            $set: { cacheInvalidatedAt: doc.updatedAt }
          });
        });
      },
      addCacheFieldMigration() {
        self.apos.migration.add('add-cache-invalidated-at-field', self.setCacheField);
      },

      async addSetPreviousDocsAposModeMigration () {
        self.apos.migration.add('set-previous-docs-apos-mode', async () => {
          await self.apos.doc.db.updateMany({
            _id: { $regex: ':previous$' },
            aposMode: { $ne: 'previous' }
          }, {
            $set: {
              aposMode: 'previous'
            }
          });
        });
      },

      async bestAposDocId(criteria) {
        const existing = await self.apos.doc.db.findOne(criteria, { projection: { aposDocId: 1 } });
        return existing?.aposDocId || self.apos.util.generateId();
      },

      ...require('./lib/legacy-migrations')(self)
    };
  }
};
