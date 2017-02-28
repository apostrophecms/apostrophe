var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  self.enableCollection = function(callback) {
    self.apos.db.collection('aposDocs', function(err, collection) {
      self.db = collection;
      return callback(err);
    });
  };

  self.ensureIndexes = function(callback) {

    async.series([ indexType, indexSlug, indexTitleSortified, indexUpdatedAt, indexTags, indexPublished, indexText ], callback);

    function indexType(callback) {
      self.db.ensureIndex({ type: 1 }, {}, callback);
    }

    function indexSlug(callback) {
      self.db.ensureIndex({ slug: 1 }, { unique: true }, callback);
    }

    function indexTitleSortified(callback) {
      self.db.ensureIndex({ titleSortified: 1 }, { }, callback);
    }

    function indexUpdatedAt(callback) {
      self.db.ensureIndex({ updatedAt: -1 }, { }, callback);
    }

    function indexTags(callback) {
      self.db.ensureIndex({ tags: 1 }, { }, callback);
    }
    function indexPublished(callback) {
      self.db.ensureIndex({ published: 1 }, { }, callback);
    }

    function indexText(callback) {
      return self.ensureTextIndex(function(err) {
        if (err) {
          console.error('WARNING: unable to ensure text index, apostrophe:migrate can fix that');
        }
        return callback(null);
      });
    }
  };

  self.ensureTextIndex = function(callback) {
    return self.db.ensureIndex( { highSearchText: 'text', lowSearchText: 'text', title: 'text', searchBoost: 'text' }, { default_language: self.options.searchLanguage || 'none', weights: { title: 100, searchBoost: 150, highSearchText: 10, lowSearchText: 2 } }, callback);
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
    return self.apos.create('apostrophe-cursor', { apos: self.apos, req: req, criteria: criteria, projection: projection });
  };

  // **Most often you will insert or update docs via the
  // insert and update methods of the appropriate doc manager.**
  // This method is for implementation use in those objects,
  // and for times when you wish to explicitly bypass most type-specific
  // callbacks such as the `beforeInsert` method of the
  // doc manager.
  //
  // Insert the given document. If the slug is not
  // unique it is made unique. docBeforeInsert,
  // docBeforeSave, docAfterInsert
  // and docAfterSave are called on all modules that have them.
  // These have a performance impact so they should only be used
  // for critical matters and cross-cutting concerns such as versioning
  // and security.
  //
  // On success the callback is invoked with
  // (null, doc).
  //
  // If the slug property is not set, the title
  // property is converted to a slug. If neither
  // property is set, an error occurs.
  //
  // The `edit-type-name` permission is checked based on
  // doc.type.
  //
  // If a unique key error occurs,
  // apos.*.docFixUniqueError is called with the
  // document. Modify the document to fix any
  // properties that may need to be more unique
  // due to a unique index you have added. It is
  // not possible to know which property was
  // responsible. This method takes care of
  // the slug property directly.
  //
  // The `options` object may be omitted completely.
  //
  // If `options.permissions` is set explicitly to
  // `false`, permissions checks are bypassed.

  self.insert = function(req, doc, options, callback) {
    if (arguments.length === 3) {
      callback = arguments[2];
      options = {};
    }
    return async.series({
      beforeInsert: function(callback) {
        return self.apos.callAll('docBeforeInsert', req, doc, options, callback);
      },
      beforeSave: function(callback) {
        return self.apos.callAll('docBeforeSave', req, doc, options, callback);
      },
      denormalizePermissions: function(callback) {
        return self.denormalizePermissions(req, doc, options, callback);
      },
      insert: function(callback) {
        return self.insertBody(req, doc, options, callback);
      },
      afterInsert: function(callback) {
        return self.apos.callAll('docAfterInsert', req, doc, options, callback);
      },
      afterSave: function(callback) {
        return self.apos.callAll('docAfterSave', req, doc, options, callback);
      },
      load: function(callback) {
        // since we deliver the new doc to the callback,
        // we should call its loaders so it can be
        // used in the expected ways
        self.apos.callAll('docsAfterLoad', req, [ doc ], function(err) {
          return callback(err);
        });
      }
    }, function(err) {
      return callback(err, (!err) && doc);
    });
  };

  // **Most often you will insert or update docs via the
  // insert and update methods of the appropriate doc manager.**
  // This method is for implementation use in those objects,
  // and for times when you wish to explicitly bypass most type-specific
  // callbacks such as the `beforeUpdate` method of the
  // doc manager.
  //
  // Update the given document. If the slug is not
  // unique it is made unique. docBeforeInsert,
  // docBeforeSave, docAfterInsert
  // and docAfterSave are called on all modules that have them.
  //
  // Update a single document.
  //
  // The second argument must be the document itself.
  // $set, $inc, etc. are NOT available via
  // this interface. This simplifies the implementation
  // of permissions and workflow. If you need to
  // update an object, find it first and then update it.
  //
  // docBeforeSave, docBeforeUpdate,
  // docAfterSave and docAfterUpdate are invoked on
  // all modules that have them. These have a performance
  // impact, so they should be used only to implement
  // cross-cutting concerns like versioning and address security matters.
  //
  // On success the callback is invoked with
  // (null, doc).
  //
  // The `edit-doc` permission is checked for the
  // specific object passed.
  //
  // `docBeforeUpdate` methods can be used to
  // enforce other restrictions.
  //
  // If a unique key error occurs,
  // apos.*.docFixUniqueError is called with the
  // document. Modify the document to fix any
  // properties that may need to be more unique
  // due to a unique index you have added. It is
  // not possible to know which property was
  // responsible. This method takes care of
  // the slug property directly.
  //
  // The `options` object may be omitted completely.
  //
  // If `options.permissions` is set explicitly to
  // `false`, permissions checks are bypassed.

  self.update = function(req, doc, options, callback) {
    if (arguments.length === 3) {
      callback = arguments[2];
      options = {};
    }
    return async.series({
      beforeUpdate: function(callback) {
        return self.apos.callAll('docBeforeUpdate', req, doc, options, callback);
      },
      beforeSave: function(callback) {
        return self.apos.callAll('docBeforeSave', req, doc, options, callback);
      },
      denormalizePermissions: function(callback) {
        return self.denormalizePermissions(req, doc, options, callback);
      },
      update: function(callback) {
        return self.updateBody(req, doc, options, callback);
      },
      afterUpdate: function(callback) {
        return self.apos.callAll('docAfterUpdate', req, doc, options, callback);
      },
      afterSave: function(callback) {
        return self.apos.callAll('docAfterSave', req, doc, options, callback);
      },
    }, function(err) {
      return callback(err, (!err) && doc);
    });
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

  self.denormalizePermissions = function(req, doc, options, callback) {
    var admin = req.user && req.user._permissions.admin;
    var fields = {
      viewGroupsIds: 'view',
      viewUsersIds: 'view',
      editGroupsIds: 'edit',
      editUsersIds: 'edit'
    };
    var docPermissions = [];
    _.each(fields, function(prefix, name) {
      docPermissions = docPermissions.concat(
        _.map(doc[name] || [], function(id) {
          return prefix + '-' + id;
        })
      );
    });
    doc.docPermissions = docPermissions;
    return self.apos.callAll('docAfterDenormalizePermissions', req, doc, options, callback);
  };

  // Trash a single document. The second
  // argument may be either an _id, or a MongoDB
  // criteria object. If more than one document
  // matches the criteria only one will be
  // updated. You must have permission to
  // edit the document.
  //
  // docBeforeTrash and docAfterTrash
  // are invoked on all modules.
  //
  // If `options.permission` is set, that permission is required
  // (or none if it is set to `false`), otherwise `'edit-doc'` is required.
  //
  // The `options` argument may be omitted entirely.
  //
  // On success the callback receives `(null, doc)`.

  self.trash = function(req, idOrCriteria, options, callback) {
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }
    var criteria = self.idOrCriteria(idOrCriteria);
    var doc;
    return async.series({
      find: function(callback) {
        return self.find(req, criteria)
          .published(null)
          .permission((options.permission !== undefined) ? options.permission : 'edit-doc')
          .toObject(function(err, _doc) {
            if (err) {
             return callback(err);
            }
            if (!_doc) {
             return callback(new Error('notfound'));
            }
            doc = _doc;
            return callback(null);
        }
       );
      },
      beforeTrash: function(callback) {
        return self.apos.callAll('docBeforeTrash', req, doc, callback);
      },
      trash: function(callback) {
        return self.trashBody(req, doc, callback);
      },
      afterTrash: function(callback) {
        return self.apos.callAll('docAfterTrash', req, doc, callback);
      },
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, doc);
    });
  };

  self.trashBody = function(req, doc, callback) {
    doc.trash = true;
    return self.db.update( { _id: doc._id }, { $set: { trash: true } }, callback);
  };

  // Rescue the document matching the specified
  // criteria from the trash. Only one document
  // is rescued regardless of the criteria.
  // You must have permission to edit it.
  //
  // If `options.permission` is set, that permission is required
  // (or none if it is set to `false`), otherwise `'edit-doc'` is required.
  //
  // docBeforeRescue and docAfterRescue are
  // invoked on all modules.
  //
  // On success the callback receives `(null, doc)`.

  self.rescue = function(req, idOrCriteria, options, callback) {
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }
    var criteria = self.idOrCriteria(idOrCriteria);
    var doc;
    return async.series({
      find: function(callback) {
        return self.find(req, criteria)
          .permission((options.permission !== undefined) ? options.permission : 'edit-doc')
          .published(null)
          .trash(true)
          .toObject(function(err, _doc) {
            if (err) {
              return callback(err);
            }
            if (!_doc) {
              return callback(new Error('notfound'));
            }
            doc = _doc;
            return callback(null);
          }
        );
      },
      beforeRescue: function(callback) {
        return self.apos.callAll('docBeforeRescue', req, doc, callback);
      },
      rescue: function(callback) {
        return self.rescueBody(req, doc, callback);
      },
      // Actual implementation of rescue is in our own
      // docAfterRescue method, which runs first
      afterRescue: function(callback) {
        return self.apos.callAll('docAfterRescue', req, doc, callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, doc);
    });
  };

  // Move the given document to the trash. You
  // should call .rescue(), not this method. However
  // you can override this method to alter the
  // implementation.

  self.rescueBody = function(req, doc, callback) {
    delete doc.trash;
    return self.db.update({ _id: doc._id }, { $unset: { trash: 1 } }, callback);
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

  self.deleteFromTrash = function(req, idOrCriteria, callback) {
    var criteria = self.idOrCriteria(idOrCriteria);
    criteria.trash = true;
    criteria = {
      $and: [ criteria, self.apos.permissions.criteria(req, 'publish-doc') ]
    };
    return self.db.remove(criteria, callback);
  };
  
  // bc wrapper for self.deleteFromTrash

  self.emptyTrash = function(req, idOrCriteria, callback) {
    return self.deleteFromTrash(req, idOrCriteria, callback);
  };

  // Recursively visit every property of a doc,
  // invoking a callback for each one. Optionally
  // deletes properties.
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
  // Then when the callback is invoked for b, the
  // object will be { b: 5 }, the key
  // will be `b`, the value will be `5`, the dotPath
  // will be the string `a.b`, and ancestors will be
  // [ { a: { b: 5 } } ].
  //
  // You do not need to pass the `_dotPath` and `_ancestors` arguments.
  // They are used for recursive invocation.

  self.walk = function(doc, callback, _dotPath, _ancestors) {
    // We do not use underscore here because of
    // performance issues.
    //
    // Pruning big nested objects is not something we
    // can afford to do slowly. -Tom
    var key;
    var val;
    var __dotPath;
    if (_dotPath !== undefined) {
      _dotPath += '.';
    } else {
      _dotPath = '';
    }
    _ancestors = (_ancestors || []).concat(doc);
    var remove = [];
    for (key in doc) {
      __dotPath = _dotPath + key.toString();
      if (callback(doc, key, doc[key], __dotPath, _ancestors) === false) {
        remove.push(key);
      } else {
        val = doc[key];
        if (typeof(val) === 'object') {
          self.walk(val, callback, __dotPath, _ancestors.concat([ doc ]));
        }
      }
    }
    _.each(remove, function(key) {
      delete doc[key];
    });
  };

  // "Protected" API: methods typically invoked
  // by the public API, although you may invoke
  // and override them

  // Retry the given "actor" function until it
  // does not yield a MongoDB error related to
  // unique indexes. The actor is not passed
  // any arguments other than a callback. If
  // an error does occur, docFixUniqueError is
  // invoked on all modules with `doc` and an
  // optional callback before the next retry.

  self.retryUntilUnique = function(req, doc, actor, callback) {
    var done = false;
    return async.whilst(
      function() { return !done; },
      function(callback) {
        return actor(function(err) {
          if (!err) {
            done = true;
            return callback(null);
          }
          if (!self.isUniqueError(err)) {
            return callback(err);
          }
          return self.apos.callAll('docFixUniqueError', req, doc, callback);
        });
      },
      callback
    );
  };

  // Invoked before any doc is inserted. Checks
  // that the user has general permission to
  // create docs of that type, generates an _id if needed,
  // and sets createdAt to the current Date.
  // Note that methods of this name are invoked
  // on ALL modules that have them, starting with
  // this one. Although this method takes no
  // callback, other implementations MAY
  // take a callback and are invoked in series.
  //
  // If `options.permissions` is explicitly `false`,
  // permissions checks are not performed.

  self.docBeforeInsert = function(req, doc, options) {
    if (!(options.permissions === false)) {
      if (!self.apos.permissions.can(req, 'edit-' + doc.type)) {
        throw new Error('forbidden');
      }
    }
    if (!doc._id) {
      doc._id = self.apos.utils.generateId();
    }
    doc.createdAt = new Date();
  };

  // Invoked before any doc is saved (either
  // updated or inserted). Generates a slug
  // from the title if needed, throwing an
  // error if there is neither slug nor title.
  //
  // Also implements the "sortify" behavior for
  // fields that specify it in the schema.
  //
  // Note that methods of this name are invoked
  // on ALL modules that have them, starting with
  // this one. Although this method takes no
  // callback, other implementations MAY
  // take a callback and are invoked in series.

  self.docBeforeSave = function(req, doc, options) {
    if ((!doc.slug) || (doc.slug === 'none')) {
      if (doc.title) {
        doc.slug = self.apos.utils.slugify(doc.title);
      } else if (doc.slug !== 'none') {
        throw new Error('Document has neither slug nor title, giving up');
      }
    }
    var manager = self.getManager(doc.type);
    _.each(manager.schema, function(field) {
      if (field.sortify) {
        doc[field.name + 'Sortified'] = self.apos.utils.sortify(doc[field.name] ? doc[field.name] : '');
      }
    });
    doc.updatedAt = new Date();
  };

  // Invoked when a MongoDB index uniqueness error
  // occurs, such as when the slug property is
  // not unique. Modifies the slug to be unique.
  // Apostrophe then retries the operation.
  //
  // Note that methods of this name are invoked
  // on ALL modules that have them, starting with
  // this one. Although this method takes no
  // callback, other implementations MAY
  // take a callback and are invoked in series.

  self.docFixUniqueError = function(req, doc) {
    var num = (Math.floor(Math.random() * 10)).toString();
    doc.slug += num;
  };

  // Invoked when a doc is about to be updated
  // (not inserted for the first time). Checks
  // permissions on that document and refuses
  // to update it if the user lacks permission to
  // do so.
  //
  // Note that methods of this name are invoked
  // on ALL modules that have them, starting with
  // this one. Although this method takes no
  // callback, other implementations MAY
  // take a callback and are invoked in series.
  //
  // If `options.permissions` is explicitly `false`,
  // permissions checks are not performed.

  self.docBeforeUpdate = function(req, doc, options) {
    if (options.permissions !== false) {
      if (!self.apos.permissions.can(req, 'edit-' + doc.type, doc)) {
        throw new Error('forbidden');
      }
    }
  };

  // Do not call this yourself, it is called
  // by .update(). You will usually want to call the
  // update method of the appropriate doc type manager instead:
  //
  // self.apos.docs.getManager(doc.type).update(...)
  //
  // You may override this method to change the implementation.

  self.updateBody = function(req, doc, options, callback) {
    return self.retryUntilUnique(req, doc, function(callback) {
      return self.db.update({ _id: doc._id }, self.apos.utils.clonePermanent(doc), callback);
    }, callback);
  };

  // Insert the given document. Called by `.insert()`. You will usually want to
  // call the update method of the appropriate doc type manager instead:
  //
  //```javascript
  //self.apos.docs.getManager(doc.type).update(...)
  //```
  //
  // However you can override this method to alter the
  // implementation.

  self.insertBody = function(req, doc, options, callback) {
    return self.retryUntilUnique(req, doc, function(callback) {
      return self.db.insert(self.apos.utils.clonePermanent(doc), callback);
    }, callback);
  };

  // Given either an id (as a string) or a criteria
  // object, return a criteria object.

  self.idOrCriteria = function(idOrCriteria) {
    var criteria;
    if (typeof(idOrCriteria) === 'object') {
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
    return _.keys(self.managers);
  }

  // Fetch the manager object corresponding to a given
  // doc type. The manager object provides methods such
  // as find() specific to that type.
  //
  // If no manager has been registered, this method will
  // return null. **All** doc types used in your project must
  // have a registered manager (hint: all subclasses of
  // pieces, the `data.global` doc, and page types registered
  // with `apostrophe-pages` always have one).

  self.getManager = function(type) {
    // if (!_.has(self.managers, type)) {
    //   console.error(type);
    //   console.trace();
    // }
    return self.managers[type];
  };

  // Add fields to the list of those unsuitable for
  // rollback due to knock-on effects, permissions checks,
  // etc.

  self.docUnversionedFields = function(req, doc, fields) {
    fields.push('slug', 'docPermissions', 'viewUserIds', 'viewGroupIds', 'editUserIds', 'editGroupIds', 'loginRequired');
  };

};
