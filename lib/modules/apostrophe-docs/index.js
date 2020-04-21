const _ = require('lodash');
// This module is responsible for managing all of the documents (apostrophe "docs")
// in the `aposDocs` mongodb collection.
//
// The `getManager` method should be used to obtain a reference to the module
// that manages a particular doc type, so that you can benefit from behavior
// specific to that module. One method of this module that you may sometimes use directly
// is `apos.docs.find()`, which returns a [cursor](server-apostrophe-cursor.html) for
// fetching documents of all types. This is useful when implementing something
// like the [apostrophe-search](../apostrophe-search/index.html) module.
//
// ## Options
//
// **`trashInSchema`: if set to `true`, a "trash" checkbox appears in the
// schema for each doc type, and pieces in the trash can be edited. Pages
// in the trash are visually displayed beneath a trashcan for every "folder"
// (parent page), which is another way of expressing that trash is just a flag.
//
// This allows pages to be restored to their exact previous position and decouples
// moving pages from trashing pages, which is useful for the `apostrophe-workflow`
// module. In addition, it becomes possible to edit the page settings of a page
// that is in the trash. Similar benefits apply to pieces and are needed for the
// workflow module. On the minus side, a trashcan at each level is less intuitive
// to users raised on the traditional shared trashcan.
//
// **`conflictResolution`: by default, Apostrophe will attempt to resolve
// conflicts between users trying to edit the same document by presenting
// the option to take control or leave the other user in control. This
// mechanism can be disabled by explicitly setting `conflictResolution`
// to false. Doing so is *not recommended* for normal operation but has
// valid applications in automated testing.

module.exports = {
  options: { alias: 'docs' },
  async init(self, options) {
    self.trashInSchema = options.trashInSchema;
    self.managers = {};
    self.enableBrowserData();
    await self.enableCollection();
    await self.createIndexes();
  },
  apiRoutes(self, options) {
    return {
      post: {
        async lock(req) {
          await self.lock(req, self.apos.launder.id(req.body._id), req.htmlPageId, { force: !!req.body.force });
        },
        async verifyLock(req) {
          await self.verifyLock(req, self.apos.launder.id(req.body._id), req.htmlPageId);
        },
        async unlock(req) {
          await self.unlock(req, self.apos.launder.id(req.body._id), req.htmlPageId);
        },
        async slugTaken(req) {
          if (!req.user) {
            throw 'notfound';
          }
          const slug = self.apos.launder.string(req.body.slug);
          const _id = self.apos.launder.id(req.body._id);
          const criteria = { slug: slug };
          if (_id) {
            criteria._id = { $ne: _id };
          }
          const doc = await self.find(req, criteria).permission(false).trash(null).published(null).projection({ slug: 1 }).toObject();
          if (doc) {
            return { status: 'taken' };
          } else {
            return { status: 'ok' };
          }
        },
        async deduplicateSlug(req) {
          if (!req.user) {
            throw 'notfound';
          }
          const _id = self.apos.launder.id(req.body._id);
          let slug = self.apos.launder.string(req.body.slug);
          let counter = 1;
          let suffix = '';
          slug = await deduplicate(slug);
          return {
            status: 'ok',
            slug: slug
          };
          async function deduplicate(slug) {
            const criteria = { slug: slug };
            if (_id) {
              criteria._id = { $ne: _id };
            }
            const doc = await self.find(req, criteria).permission(false).trash(null).published(null).projection({ slug: 1 }).toObject();
            if (doc) {
              counter++;
              suffix = '-' + counter;
              slug = slug.replace(/-\d+$/, '') + suffix;
              return deduplicate(slug);
            } else {
              return slug;
            }
          }
        }
      }
    };
  },
  handlers(self, options) {
    return {
      'apostrophe-doc-type-manager:beforeInsert': {
        testPermissionsAndAddIdAndCreatedAt(req, doc, options) {
          self.testInsertPermissions(req, doc, options);
          if (!doc._id) {
            doc._id = self.apos.utils.generateId();
          }
          doc.metaType = 'doc';
          doc.createdAt = new Date();
        }
      },
      'apostrophe-doc-type-manager:beforeSave': {
        ensureSlugSortifyAndUpdatedAt(req, doc, options) {
          self.ensureSlug(doc);
          let manager = self.getManager(doc.type);
          _.each(manager.schema, function (field) {
            if (field.sortify) {
              doc[field.name + 'Sortified'] = self.apos.utils.sortify(doc[field.name] ? doc[field.name] : '');
            }
          });
          doc.updatedAt = new Date();
        }
      },
      'fixUniqueError': {
        async fixUniqueSlug(req, doc) {
          doc.slug += Math.floor(Math.random() * 10).toString();
        }
      },
      'apostrophe-doc-type-manager:beforeUpdate': {
        async checkPermissionsBeforeUpdate(req, doc, options) {
          if (options.permissions !== false) {
            if (!self.apos.permissions.can(req, 'edit-' + doc.type, doc)) {
              throw new Error('forbidden');
            }
          }
        }
      },
      'apostrophe-versions:unversionedFields': {
        baseUnversionedFields(req, doc, fields) {
          fields.push('slug', 'docPermissions', 'viewUserIds', 'viewGroupIds', 'editUserIds', 'editGroupIds', 'loginRequired');
        }
      }
    };
  },
  methods(self, options) {
    return {
      async enableCollection() {
        self.db = await self.apos.db.collection('aposDocs');
      },
      async createSlugIndex() {
        const params = self.getSlugIndexParams();
        return self.db.createIndex(params, { unique: true });
      },
      getSlugIndexParams() {
        return { slug: 1 };
      },
      getPathLevelIndexParams() {
        return {
          path: 1,
          level: 1
        };
      },
      async createIndexes() {
        await self.db.createIndex({ type: 1 }, {});
        await self.createSlugIndex();
        await self.db.createIndex({ titleSortified: 1 }, {});
        await self.db.createIndex({ updatedAt: -1 }, {});
        await self.db.createIndex({ tags: 1 }, {});
        await self.db.createIndex({ published: 1 }, {});
        await self.db.createIndex({ 'advisoryLock._id': 1 }, {});
        await self.ensureTextIndex();
        await self.db.createIndex({ parkedId: 1 }, {});
      },
      async ensureTextIndex() {
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
      },
      async ensurePathLevelIndex() {
        const params = self.getPathLevelIndexParams();
        return self.db.createIndex(params, {});
      },
      // Returns a query based on the permissions
      // associated with the given request. The criteria
      // and projection arguments are optional, you
      // can also call the chainable .criteria() and
      // .projection() methods.
      //
      // If you do not provide criteria or call .criteria()
      // you get every document in Apostrophe, which is
      // too many.
      //
      // If you do not provide `projection` or call
      // `.projection()` you get all properties of
      // the docs, which is fine.
      //
      // This method returns a query, not docs! You
      // need to chain it with toArray() or other
      // query methods:
      //
      // await apos.docs.find(req, { type: 'foobar' }).toArray()

      find(req, criteria, projection) {
        return self.apos.modules['apostrophe-any-doc-type-manager'].find(req, criteria, projection);
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
      // If a unique key error occurs, the `apostrophe-docs:fixUniqueError`
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
        options = options || {};
        const m = self.getManager(doc.type);
        await m.emit('beforeInsert', req, doc, options);
        await m.emit('beforeSave', req, doc, options);
        await self.denormalizePermissions(req, doc, options);
        await self.insertBody(req, doc, options);
        await m.emit('afterInsert', req, doc, options);
        await m.emit('afterSave', req, doc, options);
        await m.emit('afterLoad', req, [doc]);
        return doc;
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
      // The `edit-doc` permission is checked for the
      // specific object passed.
      //
      // If a unique key error occurs, the `apostrophe-docs:fixUniqueError`
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
        options = options || {};
        console.log(doc);
        const m = self.getManager(doc.type);
        await m.emit('beforeUpdate', req, doc, options);
        await m.emit('beforeSave', req, doc, options);
        await self.denormalizePermissions(req, doc, options);
        await self.updateBody(req, doc, options);
        await m.emit('afterUpdate', req, doc, options);
        await m.emit('afterSave', req, doc, options);
        await m.emit('afterLoad', req, [doc]);
        return doc;
      },
      // Apostrophe edits doc editing and viewing permissions via joins,
      // but for query performance then copies them to a single array with entries
      // like: `[ 'edit-xxx', 'view-xxx' ]`, where `xxx` might be a user id
      // or a group id. This method performs that copying. It also invokes
      // the docAfterDenormalizePermissions method of every module that has one,
      // which allows the pages module to piggyback and add `applyToSubpages` behavior.
      //
      // The `options` object is for future extension and is passed on
      // to this method by `insert` and `update`.
      async denormalizePermissions(req, doc, options) {
        let fields = {
          viewGroupsIds: 'view',
          viewUsersIds: 'view',
          editGroupsIds: 'edit',
          editUsersIds: 'edit'
        };
        let docPermissions = [];
        _.each(fields, function (prefix, name) {
          docPermissions = docPermissions.concat(_.map(doc[name] || [], function (id) {
            return prefix + '-' + id;
          }));
        });
        doc.docPermissions = docPermissions;
        return self.emit('afterDenormalizePermissions', req, doc, options);
      },
      // Trash a single document. The second
      // argument may be either an _id, or a MongoDB
      // criteria object. If more than one document
      // matches the criteria only one will be
      // updated. You must have permission to
      // edit the document.
      //
      // `beforeTrash` and `afterTrash` events are emitted by the
      // relevant doc type manager, with `(req, doc)`.
      //
      // If `options.permission` is set, that permission is required
      // (or none if it is set to `false`), otherwise `'edit-doc'` is required.
      //
      // The `options` argument may be omitted entirely.
      //
      // Returns the trashed document.
      async trash(req, idOrCriteria, options) {
        options = options || {};
        const criteria = self.idOrCriteria(idOrCriteria);
        const doc = await self.find(req, criteria).published(null).permission(options.permission !== undefined ? options.permission : 'edit-doc').toObject();
        const m = self.getManager(doc.type);
        await m.emit('beforeTrash', req, doc);
        await self.trashBody(req, doc);
        await m.emit('afterTrash', req, doc);
        return doc;
      },
      // Implementation detail of the `trash` method.
      async trashBody(req, doc) {
        doc.trash = true;
        return self.db.updateOne({ _id: doc._id }, { $set: { trash: true } });
      },
      // Rescue the document matching the specified
      // criteria from the trash. Only one document
      // is rescued regardless of the criteria.
      // You must have permission to edit it.
      //
      // If `options.permission` is set, that permission is required
      // (or none if it is set to `false`), otherwise `'edit-doc'` is required.
      //
      // The module emits `beforeRescue` and `afterRescue`
      // events with `(req, doc)`.
      //
      // Returns the rescued doc.
      async rescue(req, idOrCriteria, options) {
        options = options || {};
        const criteria = self.idOrCriteria(idOrCriteria);
        const doc = await self.find(req, criteria).published(null).permission(options.permission !== undefined ? options.permission : 'edit-doc').trash(true).toObject();
        const m = self.getManager(doc.type);
        await m.emit('beforeRescue', req, doc);
        await self.rescueBody(req, doc);
        await m.emit('afterRescue', req, doc);
        return doc;
      },
      // Remove the given document from the trash. You
      // should call .rescue(), not this method. However
      // you can override this method to alter the
      // implementation.
      async rescueBody(req, doc) {
        delete doc.trash;
        return self.db.updateOne({ _id: doc._id }, { $unset: { trash: 1 } });
      },
      // Forever discard the specified document or
      // documents. All documents matching the criteria
      // are discarded completely.
      //
      // Documents not already marked as trash are
      // not discarded.
      //
      // You must have publish permission
      // for the documents to discard them.
      //
      // The use of this API without extensive user
      // confirmation is strongly discouraged. Users
      // who ask for a way to empty the trash will often
      // ask for a way to un-empty it. There isn't one.
      async deleteFromTrash(req, idOrCriteria) {
        let criteria = self.idOrCriteria(idOrCriteria);
        criteria.trash = true;
        criteria = {
          $and: [
            criteria,
            self.apos.permissions.criteria(req, 'edit-doc')
          ]
        };
        return self.db.deleteMany(criteria);
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
        let remove = [];
        for (let key in doc) {
          const __dotPath = _dotPath + key.toString();
          let ow = '_originalWidgets';
          if (__dotPath === ow || __dotPath.substring(0, ow.length) === ow + '.') {
            continue;
          }
          if (iterator(doc, key, doc[key], __dotPath, _ancestors) === false) {
            remove.push(key);
          } else {
            const val = doc[key];
            if (typeof val === 'object') {
              self.walk(val, iterator, __dotPath, _ancestors.concat([doc]));
            }
          }
        }
        for (let key of remove) {
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
      // Called by `docBeforeInsert` to confirm that the user
      // has the appropriate permissions for the doc's type
      // and, in some extensions of Apostrophe, the new doc's
      // content.
      testInsertPermissions(req, doc, options) {
        if (!(options.permissions === false)) {
          if (!self.apos.permissions.can(req, 'edit-' + doc.type, null, doc)) {
            throw new Error('forbidden');
          }
        }
      },
      // If the doc does not yet have a slug, add one based on the
      // title; throw an error if there is no title
      ensureSlug(doc) {
        if (!doc.slug || doc.slug === 'none') {
          if (doc.title) {
            doc.slug = self.apos.utils.slugify(doc.title);
          } else if (doc.slug !== 'none') {
            throw new Error('Document has neither slug nor title, giving up');
          }
        }
      },
      // Do not call this yourself, it is called
      // by .update(). You will usually want to call the
      // update method of the appropriate doc type manager instead:
      //
      // self.apos.docs.getManager(doc.type).update(...)
      //
      // You may override this method to change the implementation.
      async updateBody(req, doc, options) {
        return self.retryUntilUnique(req, doc, async function () {
          return self.db.replaceOne({ _id: doc._id }, self.apos.utils.clonePermanent(doc));
        });
      },
      // Insert the given document. Called by `.insert()`. You will usually want to
      // call the update method of the appropriate doc type manager instead:
      //
      // ```javascript
      // self.apos.docs.getManager(doc.type).update(...)
      // ```
      //
      // However you can override this method to alter the
      // implementation.
      async insertBody(req, doc, options) {
        return self.retryUntilUnique(req, doc, async function () {
          return self.db.insertOne(self.apos.utils.clonePermanent(doc));
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
      // is a module that subclasses `apostrophe-doc-type-manager`
      // (or its subclasses `apostrophe-pieces` and `apostrophe-custom-pages`).
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
      // with `apostrophe-pages` always have one).
      getManager(type) {
        return self.managers[type];
      },
      // Lock the given doc id to a given `contextId`, such
      // that other calls to `lock` for that doc id will
      // fail unless they have the same `contextId`. If
      // `options.force` is true, any existing lock is
      // overwritten. The `options` argument may be
      // omitted entirely.
      //
      // `id` must be truthy. If a doc is new and therefore
      // has no id yet, you don't need to lock it because
      // it isn't possible that anyone else knows about it.
      //
      // If the `conflictResolution` option is set to false
      // for the docs module, this method returns
      // successfully without actually doing anything.
      // This is *not recommended* but has valid applications
      // in automated testing.
      async lock(req, id, contextId, options) {
        if (!options) {
          options = {};
        }
        if (self.options.conflictResolution === false) {
          return;
        }
        if (!id) {
          throw new Error('no id');
        }
        if (!contextId) {
          throw new Error('no contextId');
        }
        let criteria = { _id: id };
        if (!options.force) {
          criteria.$or = [
            { advisoryLock: { $exists: 0 } },
            { 'advisoryLock._id': contextId }
          ];
        }
        // Prevent nuisance locking by matching only
        // documents the user can edit
        criteria = {
          $and: [
            criteria,
            self.apos.permissions.criteria(req, 'edit')
          ]
        };
        const result = await self.db.updateOne(criteria, {
          $set: {
            advisoryLock: {
              username: req.user && req.user.username,
              title: req.user && req.user.title,
              _id: contextId,
              updatedAt: new Date()
            }
          }
        });
        if (!result.result.nModified) {
          const info = await self.db.findOne({ _id: id }, { projection: { advisoryLock: 1 } });
          const now = new Date().getTime();
          if (!info) {
            throw 'notfound';
          }
          let ago = Math.ceil((now - info.advisoryLock.updatedAt.getTime()) / 1000 / 60);
          if (!info.advisoryLock) {
            // Nobody else has a lock but you couldn't get one —
            // must be permissions
            throw 'forbidden';
          }
          if (info.advisoryLock.username === req.user.username) {
            // TODO add locked (423) to http module when I merge
            // code that is at the office //
            throw self.apos.http.error('locked', {
              me: true,
              ago
            });
          }
          throw self.apos.http.error('locked', {
            name: info.advisoryLock.title,
            username: info.advisoryLock.username,
            ago
          });
        }
      },
      // Verifies that a lock obtained with `lock` is
      // still held by the given context id. If not,
      // the error is the string `locked` and a second
      // argument with an internationalized message
      // is provided also. If the lock was taken
      // by the same user in another tab or window,
      // this is indicated but the error remains.
      //
      // If the `conflictResolution` option is set to false
      // for the docs module, this method returns
      // successfully without actually doing anything.
      // This is *not recommended* but has valid applications
      // in automated testing.
      async verifyLock(req, id, contextId) {
        if (self.options.conflictResolution === false) {
          return;
        }
        const info = await self.db.findOne({ _id: id }, { projection: { advisoryLock: 1 } });
        if (!info) {
          throw 'notfound';
        }
        if (!info.advisoryLock) {
          // We lost our lock unexpectedly, the document
          // is now unlocked. Treat this as a "somebody locked it"
          // situation because we cannot continue as we expected to
          throw self.apos.http.error('locked', { taken: true });
        }
        if (info.advisoryLock._id === contextId) {
          // We still have the lock, all is well
          return;
        }
        if (info.advisoryLock.username !== req.user.username) {
          throw self.apos.http.error('locked', {
            taken: true,
            name: info.advisoryLock.title,
            username: info.advisoryLock.username
          });
        } else {
          throw self.apos.http.error('locked', {
            taken: true,
            me: true
          });
        }
      },
      // Release a document lock set via `lock` for
      // a particular contextId.
      //
      // If the `conflictResolution` option is set to false
      // for the docs module, this method resolves
      // successfully without actually doing anything.
      // This is *not recommended* but has valid applications
      // in automated testing.
      async unlock(req, id, contextId) {
        if (self.options.conflictResolution === false) {
          return;
        }
        if (!id) {
          throw new Error('no id');
        }
        if (!contextId) {
          throw new Error('no contextId');
        }
        await self.db.updateOne({
          _id: id,
          'advisoryLock._id': contextId
        }, { $unset: { advisoryLock: 1 } });
      },
      // Release all document locks set on behalf of
      // the given `contextId`.
      //
      // If the `conflictResolution` option is set to false
      // for the docs module, this method resolves
      // successfully without actually doing anything.
      // This is *not recommended* but has valid applications
      // in automated testing.
      async unlockAll(req, contextId) {
        if (self.options.conflictResolution === false) {
          return;
        }
        if (!contextId) {
          throw new Error('no contextId provided');
        }
        await self.db.updateMany({ 'advisoryLock._id': contextId }, { $unset: { advisoryLock: 1 } });
      },
      // Returns the field names necessary to build URLs
      // for typical doc types. If a cursor specific to a
      // doc type is used, the `getUrlFields` method of
      // that module is called instead. This method is
      // used to implement "projections" for the
      // `_url` computed property
      getDefaultUrlFields() {
        return [
          'type',
          'slug',
          'tags'
        ];
      },
      getBrowserData(req) {
        if (req.user) {
          return {
            action: self.action,
            trashInSchema: self.options.trashInSchema
          };
        }
      }
    };
  }
};