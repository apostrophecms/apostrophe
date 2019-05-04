const _ = require('lodash');

module.exports = function(self, options) {

  self.enableCollection = async function() {
    self.db = await self.apos.db.collection('aposDocs');
  };

  self.ensureSlugIndex = function() {
    const params = self.getSlugIndexParams();

    return self.db.ensureIndex(params, { unique: true });
  };

  self.getSlugIndexParams = function() {
    return { slug: 1 };
  };

  self.getPathLevelIndexParams = function() {
    return { path: 1, level: 1 };
  };

  self.ensureIndexes = async function() {

    await self.db.ensureIndex({ type: 1 }, {});
    await self.ensureSlugIndex();
    await self.db.ensureIndex({ titleSortified: 1 }, {});
    await self.db.ensureIndex({ updatedAt: -1 }, {});
    await self.db.ensureIndex({ tags: 1 }, {});
    await self.db.ensureIndex({ published: 1 }, {});
    await self.db.ensureIndex({ 'advisoryLock._id': 1 }, {});
    await self.ensureTextIndex();
    await self.db.ensureIndex({ parkedId: 1 }, {});
  };

  self.ensureTextIndex = async function() {
    return self.db.ensureIndex({
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
  };

  self.ensurePathLevelIndex = async function() {
    const params = self.getPathLevelIndexParams();
    return self.db.ensureIndex(params, {});
  };

  // Returns a query cursor based on the permissions
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
  // This method returns a cursor, not docs! You
  // need to chain it with toArray() or other
  // cursor methods:
  //
  // apos.docs.find(req, { type: 'foobar' }).toArray(
  //   function(err, docs) { ... }
  // );

  self.find = function(req, criteria, projection) {
    if ((!req) || (!req.res)) {
      throw new Error("I think you forgot to pass req as the first argument to find()!");
    }
    return self.apos.createSync('apostrophe-cursor', { apos: self.apos, req: req, criteria: criteria, projection: projection });
  };

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

  self.insert = async function(req, doc, options) {
    options = options || {};
    const m = self.getManager(doc.type);
    await m.emit('beforeInsert', req, doc, options);
    await m.emit('beforeSave', req, doc, options);
    await self.denormalizePermissions(req, doc, options);
    await self.insertBody(req, doc, options);
    await m.emit('afterInsert', req, doc, options);
    await m.emit('afterSave', req, doc, options);
    await m.emit('afterLoad', req, [ doc ]);
    return doc;
  };

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

  self.update = async function(req, doc, options) {
    options = options || {};
    const m = self.getManager(doc.type);
    await m.emit('beforeUpdate', req, doc, options);
    await m.emit('beforeSave', req, doc, options);
    await self.denormalizePermissions(req, doc, options);
    await self.updateBody(req, doc, options);
    await m.emit('afterUpdate', req, doc, options);
    await m.emit('afterSave', req, doc, options);
    await m.emit('afterLoad', req, [ doc ]);
    return doc;
  };

  // Apostrophe edits doc editing and viewing permissions via joins,
  // but for query performance then copies them to a single array with entries
  // like: `[ 'edit-xxx', 'view-xxx' ]`, where `xxx` might be a user id
  // or a group id. This method performs that copying. It also invokes
  // the docAfterDenormalizePermissions method of every module that has one,
  // which allows the pages module to piggyback and add `applyToSubpages` behavior.
  //
  // The `options` object is for future extension and is passed on
  // to this method by `insert` and `update`.

  self.denormalizePermissions = async function(req, doc, options) {
    let fields = {
      viewGroupsIds: 'view',
      viewUsersIds: 'view',
      editGroupsIds: 'edit',
      editUsersIds: 'edit'
    };
    let docPermissions = [];
    _.each(fields, function(prefix, name) {
      docPermissions = docPermissions.concat(
        _.map(doc[name] || [], function(id) {
          return prefix + '-' + id;
        })
      );
    });
    doc.docPermissions = docPermissions;

    return self.emit('afterDenormalizePermissions', req, doc, options);
  };

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

  self.trash = async function(req, idOrCriteria, options) {
    options = options || {};
    const criteria = self.idOrCriteria(idOrCriteria);
    const doc = await self.find(req, criteria)
      .published(null)
      .permission((options.permission !== undefined) ? options.permission : 'edit-doc')
      .toObject();
    const m = self.getManager(doc.type);
    await m.emit('beforeTrash', req, doc);
    await self.trashBody(req, doc);
    await m.emit('afterTrash', req, doc);
    return doc;
  };

  // Implementation detail of the `trash` method.

  self.trashBody = async function(req, doc) {
    doc.trash = true;
    return self.db.updateOne({
      _id: doc._id
    }, {
      $set: {
        trash: true
      }
    });
  };

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

  self.rescue = async function(req, idOrCriteria, options) {
    options = options || {};
    const criteria = self.idOrCriteria(idOrCriteria);
    const doc = await self.find(req, criteria)
      .published(null)
      .permission((options.permission !== undefined) ? options.permission : 'edit-doc')
      .trash(true)
      .toObject();
    const m = self.getManager(doc.type);
    await m.emit('beforeRescue', req, doc);
    await self.rescueBody(req, doc);
    await m.emit('afterRescue', req, doc);
    return doc;
  };

  // Remove the given document from the trash. You
  // should call .rescue(), not this method. However
  // you can override this method to alter the
  // implementation.

  self.rescueBody = async function(req, doc) {
    delete doc.trash;
    return self.db.updateOne({ _id: doc._id }, { $unset: { trash: 1 } });
  };

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

  self.deleteFromTrash = async function(req, idOrCriteria) {
    let criteria = self.idOrCriteria(idOrCriteria);
    criteria.trash = true;
    criteria = {
      $and: [ criteria, self.apos.permissions.criteria(req, 'edit-doc') ]
    };
    return self.db.remove(criteria);
  };

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

  self.walk = function(doc, iterator, _dotPath, _ancestors) {
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
      if ((__dotPath === ow) || (__dotPath.substring(0, ow.length) === (ow + '.'))) {
        continue;
      }
      if (iterator(doc, key, doc[key], __dotPath, _ancestors) === false) {
        remove.push(key);
      } else {
        const val = doc[key];
        if (typeof (val) === 'object') {
          self.walk(val, iterator, __dotPath, _ancestors.concat([ doc ]));
        }
      }
    }
    for (let key of remove) {
      delete doc[key];
    }
  };

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

  self.retryUntilUnique = async function(req, doc, actor) {
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
  };

  // Invoked before any doc is inserted. Checks
  // that the user has general permission to
  // create docs of that type, generates an _id if needed,
  // and sets createdAt to the current Date.
  //
  // If `options.permissions` is explicitly `false`,
  // permissions checks are not performed.

  self.on('apostrophe-doc-type-manager:beforeInsert', 'testPermissionsAndAddIdAndCreatedAt', function(req, doc, options) {
    self.testInsertPermissions(req, doc, options);
    if (!doc._id) {
      doc._id = self.apos.utils.generateId();
    }
    doc.createdAt = new Date();
  });

  // Called by `docBeforeInsert` to confirm that the user
  // has the appropriate permissions for the doc's type
  // and, in some extensions of Apostrophe, the new doc's
  // content.

  self.testInsertPermissions = function(req, doc, options) {
    if (!(options.permissions === false)) {
      if (!self.apos.permissions.can(req, 'edit-' + doc.type, null, doc)) {
        throw new Error('forbidden');
      }
    }
  };

  // Invoked before any doc is saved (either
  // updated or inserted). Generates a slug
  // from the title if needed, throwing an
  // error if there is neither slug nor title.
  //
  // Also implements the "sortify" behavior for
  // fields that specify it in the schema.

  self.on('apostrophe-doc-type-manager:beforeSave', 'ensureSlugSortifyAndUpdatedAt', function(req, doc, options) {
    self.ensureSlug(doc);
    let manager = self.getManager(doc.type);
    _.each(manager.schema, function(field) {
      if (field.sortify) {
        doc[field.name + 'Sortified'] = self.apos.utils.sortify(doc[field.name] ? doc[field.name] : '');
      }
    });
    doc.updatedAt = new Date();
  });

  // If the doc does not yet have a slug, add one based on the
  // title; throw an error if there is no title
  self.ensureSlug = function(doc) {
    if ((!doc.slug) || (doc.slug === 'none')) {
      if (doc.title) {
        doc.slug = self.apos.utils.slugify(doc.title);
      } else if (doc.slug !== 'none') {
        throw new Error('Document has neither slug nor title, giving up');
      }
    }
  };

  // Invoked when a MongoDB index uniqueness error
  // occurs, such as when the slug property is
  // not unique. Modifies the slug to be more unique.
  // Apostrophe then retries the operation. This
  // quickly converges on a unique slug without
  // adding a large number of characters every time.

  self.on('fixUniqueError', 'fixUniqueSlug', async function(req, doc) {
    doc.slug += (Math.floor(Math.random() * 10)).toString();
  });

  // Invoked when a doc is about to be updated
  // (not inserted for the first time). Checks
  // permissions on that document and refuses
  // to update it if the user lacks permission to
  // do so.
  //
  // If `options.permissions` is explicitly `false`,
  // permissions checks are not performed.

  self.on('apostrophe-doc-type-manager:beforeUpdate', 'checkPermissionsBeforeUpdate', async function(req, doc, options) {
    if (options.permissions !== false) {
      if (!self.apos.permissions.can(req, 'edit-' + doc.type, doc)) {
        throw new Error('forbidden');
      }
    }
  });

  // Do not call this yourself, it is called
  // by .update(). You will usually want to call the
  // update method of the appropriate doc type manager instead:
  //
  // self.apos.docs.getManager(doc.type).update(...)
  //
  // You may override this method to change the implementation.

  self.updateBody = async function(req, doc, options) {
    return self.retryUntilUnique(req, doc, async function() {
      return self.db.updateOne({ _id: doc._id }, self.apos.utils.clonePermanent(doc));
    });
  };

  // Insert the given document. Called by `.insert()`. You will usually want to
  // call the update method of the appropriate doc type manager instead:
  //
  // ```javascript
  // self.apos.docs.getManager(doc.type).update(...)
  // ```
  //
  // However you can override this method to alter the
  // implementation.

  self.insertBody = async function(req, doc, options) {
    return self.retryUntilUnique(req, doc, async function() {
      return self.db.insert(self.apos.utils.clonePermanent(doc));
    });
  };

  // Given either an id (as a string) or a criteria
  // object, return a criteria object.

  self.idOrCriteria = function(idOrCriteria) {
    if (typeof (idOrCriteria) === 'object') {
      return idOrCriteria;
    } else {
      return { _id: idOrCriteria };
    }
  };

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

  self.isUniqueError = function(err) {
    if (!err) {
      return false;
    }
    return ((err.code === 13596) || (err.code === 13596) || (err.code === 11000) || (err.code === 11001));
  };

  self.managers = {};

  // Set the manager object corresponding
  // to a given doc type. Typically `manager`
  // is a module that subclasses `apostrophe-doc-type-manager`
  // (or its subclasses `apostrophe-pieces` and `apostrophe-custom-pages`).

  self.setManager = function(type, manager) {
    self.managers[type] = manager;
  };

  // Returns an array of all of the doc types that have a registered manager.

  self.getManaged = function() {
    return Object.keys(self.managers);
  };

  // Fetch the manager object corresponding to a given
  // doc type. The manager object provides methods such
  // as find() specific to that type.
  //
  // If no manager has been registered, this method will
  // return undefined. **All** doc types used in your project must
  // have a registered manager (hint: all subclasses of
  // pieces, the `data.global` doc, and page types registered
  // with `apostrophe-pages` always have one).

  self.getManager = function(type) {
    return self.managers[type];
  };

  // Add several standard fields to the list of those unsuitable for
  // rollback due to knock-on effects, permissions checks,
  // etc.

  self.on('apostrophe-versions:unversionedFields', 'baseUnversionedFields', function(req, doc, fields) {
    fields.push('slug', 'docPermissions', 'viewUserIds', 'viewGroupIds', 'editUserIds', 'editGroupIds', 'loginRequired');
  });

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

  self.lock = async function(req, id, contextId, options) {

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

    let criteria = {
      _id: id
    };

    if (!options.force) {
      criteria.$or = [
        {
          advisoryLock: { $exists: 0 }
        },
        {
          'advisoryLock._id': contextId
        }
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
      const info = await self.db.findOne({ _id: id }, { advisoryLock: 1 });
      const now = (new Date()).getTime();
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
        throw self.apos.http.error('locked', { me: true, ago });
      }
      throw self.apos.http.error('locked', { name: info.advisoryLock.title, username: info.advisoryLock.username, ago });
    }
  };

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

  self.verifyLock = async function(req, id, contextId) {
    if (self.options.conflictResolution === false) {
      return;
    }
    const info = await self.db.findOne(
      { _id: id },
      { advisoryLock: 1 });
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
      throw self.apos.http.error('locked', { taken: true, name: info.advisoryLock.title, username: info.advisoryLock.username });
    } else {
      throw self.apos.http.error('locked', { taken: true, me: true });
    }
  };

  // Release a document lock set via `lock` for
  // a particular contextId.
  //
  // If the `conflictResolution` option is set to false
  // for the docs module, this method resolves
  // successfully without actually doing anything.
  // This is *not recommended* but has valid applications
  // in automated testing.

  self.unlock = async function(req, id, contextId) {

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
    }, {
      $unset: {
        advisoryLock: 1
      }
    });
  };

  // Release all document locks set on behalf of
  // the given `contextId`.
  //
  // If the `conflictResolution` option is set to false
  // for the docs module, this method resolves
  // successfully without actually doing anything.
  // This is *not recommended* but has valid applications
  // in automated testing.

  self.unlockAll = async function(req, contextId) {

    if (self.options.conflictResolution === false) {
      return;
    }

    if (!contextId) {
      throw new Error('no contextId provided');
    }
    await self.db.updateMany({
      'advisoryLock._id': contextId
    }, {
      $unset: {
        advisoryLock: 1
      }
    });
  };

  // Returns the field names necessary to build URLs
  // for typical doc types. If a cursor specific to a
  // doc type is used, the `getUrlFields` method of
  // that module is called instead. This method is
  // used to implement "projections" for the
  // `_url` computed property

  self.getDefaultUrlFields = function() {
    return [ 'type', 'slug', 'tags' ];
  };

};
