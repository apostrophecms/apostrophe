var async = require('async');
var _ = require('@sailshq/lodash');
var Promise = require('bluebird');

module.exports = function(self, options) {

  self.enableCollection = function(callback) {
    self.apos.db.collection('aposDocs', function(err, collection) {
      self.db = collection;
      return callback(err);
    });
  };

  // Index on the slug property. Emits a slugIndex event with a params object
  // so it can be altered by other listening modules

  self.ensureSlugIndex = function(callback) {
    var params = self.getSlugIndexParams();
    return self.db.ensureIndex(params, { unique: true }, callback);
  };

  self.getSlugIndexParams = function() {
    return { slug: 1 };
  };

  self.getPathLevelIndexParams = function() {
    return { path: 1, level: 1 };
  };

  self.ensureIndexes = function(callback) {

    async.series([ indexType, self.ensureSlugIndex, indexTitleSortified, indexUpdatedAt, indexTags, indexPublished, indexText, indexParkedId, indexAdvisoryLockId, self.ensurePathLevelIndex ], callback);

    function indexType(callback) {
      self.db.ensureIndex({ type: 1 }, {}, callback);
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

    function indexAdvisoryLockId(callback) {
      self.db.ensureIndex({ 'advisoryLock._id': 1 }, { }, callback);
    }

    function indexText(callback) {
      return self.ensureTextIndex(function(err) {
        if (err) {
          self.apos.utils.error('WARNING: unable to ensure text index, apostrophe:migrate can fix that');
        }
        return callback(null);
      });
    }

    function indexParkedId(callback) {
      self.db.ensureIndex({ parkedId: 1 }, { }, callback);
    }

  };

  self.ensureTextIndex = function(callback) {
    return self.db.ensureIndex({ highSearchText: 'text', lowSearchText: 'text', title: 'text', searchBoost: 'text' }, { default_language: self.options.searchLanguage || 'none', weights: { title: 100, searchBoost: 150, highSearchText: 10, lowSearchText: 2 } }, callback);
  };

  self.ensurePathLevelIndex = function(callback) {
    var params = self.getPathLevelIndexParams();
    return self.db.ensureIndex(params, {}, callback);
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
  //
  // If `callback` is omitted, a promise is returned.

  self.insert = function(req, doc, options, callback) {
    if (typeof (arguments[2]) !== 'object') {
      callback = options;
      options = {};
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }
    function body(callback) {
      if (!(req && req.res)) {
        return callback(new Error('You forgot to pass req as the first argument to insert()'));
      }
      if (!doc) {
        return callback(new Error('The doc argument to insert() must be an object'));
      }
      if (!(options && ((typeof options) === 'object'))) {
        return callback(new Error('If the options argument to insert() is passed it must be an object'));
      }
      return async.series({
        beforeInsert: function(callback) {
          return self.callAllAndEmit('docBeforeInsert', 'beforeInsert', req, doc, options, callback);
        },
        beforeSave: function(callback) {
          return self.callAllAndEmit('docBeforeSave', 'beforeSave', req, doc, options, callback);
        },
        denormalizePermissions: function(callback) {
          return self.denormalizePermissions(req, doc, options, callback);
        },
        insert: function(callback) {
          return self.insertBody(req, doc, options, callback);
        },
        afterInsert: function(callback) {
          return self.callAllAndEmit('docAfterInsert', 'afterInsert', req, doc, options, callback);
        },
        afterSave: function(callback) {
          return self.callAllAndEmit('docAfterSave', 'afterSave', req, doc, options, callback);
        },
        load: function(callback) {
          // since we deliver the new doc to the callback,
          // we should call its loaders so it can be
          // used in the expected ways
          self.callAllAndEmit('docsAfterLoad', 'afterLoad', req, [ doc ], function(err) {
            return callback(err);
          });
        }
      }, function(err) {
        return callback(err, (!err) && doc);
      });
    }
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
  //
  // If `callback` is omitted, a promise is returned.

  self.update = function(req, doc, options, callback) {
    if (typeof (arguments[2]) !== 'object') {
      callback = options;
      options = {};
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }
    function body(callback) {
      if (!(req && req.res)) {
        return callback(new Error('You forgot to pass req as the first argument'));
      }
      if (!doc) {
        return callback(new Error('The doc argument must be an object'));
      }
      if (!(options && ((typeof options) === 'object'))) {
        return callback(new Error('If the options argument is passed it must be an object'));
      }
      return async.series({
        beforeUpdate: function(callback) {
          return self.callAllAndEmit('docBeforeUpdate', 'beforeUpdate', req, doc, options, callback);
        },
        beforeSave: function(callback) {
          return self.callAllAndEmit('docBeforeSave', 'beforeSave', req, doc, options, callback);
        },
        denormalizePermissions: function(callback) {
          return self.denormalizePermissions(req, doc, options, callback);
        },
        update: function(callback) {
          return self.updateBody(req, doc, options, callback);
        },
        afterUpdate: function(callback) {
          return self.callAllAndEmit('docAfterUpdate', 'afterUpdate', req, doc, options, callback);
        },
        afterSave: function(callback) {
          return self.callAllAndEmit('docAfterSave', 'afterSave', req, doc, options, callback);
        }
      }, function(err) {
        return callback(err, (!err) && doc);
      });
    }
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
  //
  // This method also repairs any properties related to these which are null
  // rather than a properly empty array or object.

  self.denormalizePermissions = function(req, doc, options, callback) {
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!doc) {
      return callback(new Error('The doc argument must be an object'));
    }
    if (!(options && ((typeof options) === 'object'))) {
      return callback(new Error('The options argument must be an object'));
    }
    var fields = {
      viewGroupsIds: 'view',
      viewUsersIds: 'view',
      editGroupsIds: 'edit',
      editUsersIds: 'edit'
    };
    var docPermissions = [];
    _.each(fields, function(prefix, name) {
      doc[name] = doc[name] || [];
      docPermissions = docPermissions.concat(
        _.map(doc[name] || [], function(id) {
          return prefix + '-' + id;
        })
      );
    });
    doc.docPermissions = docPermissions;
    return self.callAllAndEmit('docAfterDenormalizePermissions', 'afterDenormalizePermissions', req, doc, options, callback);
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
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!(idOrCriteria && (((typeof idOrCriteria) === 'string') || ((typeof idOrCriteria) === 'object')))) {
      return callback(new Error('The idOrCriteria argument must be either an id or a criteria object'));
    }
    if (!(options && ((typeof options) === 'object'))) {
      return callback(new Error('The options argument must be an object'));
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
        return self.callAllAndEmit('docBeforeTrash', 'beforeTrash', req, doc, callback);
      },
      trash: function(callback) {
        return self.trashBody(req, doc, callback);
      },
      afterTrash: function(callback) {
        return self.callAllAndEmit('docAfterTrash', 'afterTrash', req, doc, callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, doc);
    });
  };

  self.trashBody = function(req, doc, callback) {
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!doc) {
      return callback(new Error('The doc argument must be an object'));
    }
    doc.trash = true;
    return self.db.update({ _id: doc._id }, { $set: { trash: true } }, callback);
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
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!(idOrCriteria && (((typeof idOrCriteria) === 'string') || ((typeof idOrCriteria) === 'object')))) {
      return callback(new Error('The idOrCriteria argument must be either an id or a criteria object'));
    }
    if (!(options && ((typeof options) === 'object'))) {
      return callback(new Error('The options argument must be an object'));
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
        return self.callAllAndEmit('docBeforeRescue', 'beforeRescue', req, doc, callback);
      },
      rescue: function(callback) {
        return self.rescueBody(req, doc, callback);
      },
      // Actual implementation of rescue is in our own
      // docAfterRescue method, which runs first
      afterRescue: function(callback) {
        return self.callAllAndEmit('docAfterRescue', 'afterRescue', req, doc, callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, doc);
    });
  };

  // Remove the given document from the trash. You
  // should call .rescue(), not this method. However
  // you can override this method to alter the
  // implementation.

  self.rescueBody = function(req, doc, callback) {
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!doc) {
      return callback(new Error('The doc argument must be an object'));
    }
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
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!(idOrCriteria && (((typeof idOrCriteria) === 'string') || ((typeof idOrCriteria) === 'object')))) {
      return callback(new Error('The idOrCriteria argument must be either an id or a criteria object'));
    }
    var criteria = self.idOrCriteria(idOrCriteria);
    criteria.trash = true;
    criteria = {
      $and: [ criteria, self.apos.permissions.criteria(req, 'publish-doc') ]
    };
    return self.db.remove(criteria, callback);
  };

  // bc wrapper for self.deleteFromTrash

  self.emptyTrash = function(req, idOrCriteria, callback) {
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!(idOrCriteria && (((typeof idOrCriteria) === 'string') || ((typeof idOrCriteria) === 'object')))) {
      return callback(new Error('The idOrCriteria argument must be either an id or a criteria object'));
    }
    return self.deleteFromTrash(req, idOrCriteria, callback);
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
  // Then when the callback is invoked for b, the
  // object will be { b: 5 }, the key
  // will be `b`, the value will be `5`, the dotPath
  // will be the string `a.b`, and ancestors will be
  // [ { a: { b: 5 } } ].
  //
  // You do not need to pass the `_dotPath` and `_ancestors` arguments.
  // They are used for recursive invocation.

  self.walk = function(doc, iterator, _dotPath, _ancestors) {
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
      var ow = '_originalWidgets';
      if ((__dotPath === ow) || (__dotPath.substring(0, ow.length) === (ow + '.'))) {
        continue;
      }
      if (iterator(doc, key, doc[key], __dotPath, _ancestors) === false) {
        remove.push(key);
      } else {
        val = doc[key];
        if (typeof (val) === 'object') {
          self.walk(val, iterator, __dotPath, _ancestors.concat([ doc ]));
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
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!doc) {
      return callback(new Error('The doc argument must be an object'));
    }
    if ((typeof actor) !== 'function') {
      return callback(new Error('The actor argument must be a function'));
    }
    var done = false;
    var maxAttempts = 20;
    var attempt = 0;
    var firstError;
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
            firstError.aposAddendum = 'retryUntilUnique failed, most likely you need another docFixUniqueError method to handle another property that has a unique index, reporting original error, see also aposLatestError property';
            firstError.aposLatestError = err;
            return callback(firstError);
          }
          return self.callAllAndEmit('docFixUniqueError', 'fixUniqueError', req, doc, callback);
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
    if (!(req && req.res)) {
      throw new Error('You forgot to pass req as the first argument');
    }
    if (!doc) {
      throw new Error('The doc argument must be an object');
    }
    if (!(options && ((typeof options) === 'object'))) {
      throw new Error('The options argument must be an object');
    }
    self.testInsertPermissions(req, doc, options);
    if (!doc._id) {
      doc._id = self.apos.utils.generateId();
    }
    doc.createdAt = new Date();
  };

  // Called by `docBeforeInsert` to confirm that the user
  // has the appropriate permissions for the doc's type
  // and, in some extensions of Apostrophe, the new doc's
  // content.

  self.testInsertPermissions = function(req, doc, options) {
    if (!(req && req.res)) {
      throw new Error('You forgot to pass req as the first argument');
    }
    if (!doc) {
      throw new Error('The doc argument must be an object');
    }
    if (!(options && ((typeof options) === 'object'))) {
      return new Error('The options argument must be an object');
    }
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
  //
  // Note that methods of this name are invoked
  // on ALL modules that have them, starting with
  // this one. Although this method takes no
  // callback, other implementations MAY
  // take a callback and are invoked in series.

  self.docBeforeSave = function(req, doc, options) {
    if (!(req && req.res)) {
      throw new Error('You forgot to pass req as the first argument');
    }
    if (!doc) {
      throw new Error('The doc argument must be an object');
    }
    if (!(options && ((typeof options) === 'object'))) {
      throw new Error('The options argument must be an object');
    }
    self.ensureSlug(doc);
    var manager = self.getManager(doc.type);
    _.each(manager.schema, function(field) {
      if (field.sortify) {
        doc[field.name + 'Sortified'] = self.apos.utils.sortify(doc[field.name] ? doc[field.name] : '');
      }
    });
    doc.updatedAt = new Date();
  };

  // If the doc does not yet have a slug, add one based on the
  // title; throw an error if there is no title or no doc
  self.ensureSlug = function(doc) {
    if (!doc) {
      throw new Error('The doc argument must be an object');
    }
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
  // not unique. Modifies the slug to be unique.
  // Apostrophe then retries the operation.
  //
  // Note that methods of this name are invoked
  // on ALL modules that have them, starting with
  // this one. Although this method takes no
  // callback, other implementations MAY
  // take a callback and are invoked in series.

  self.docFixUniqueError = function(req, doc) {
    if (!(req && req.res)) {
      throw new Error('You forgot to pass req as the first argument');
    }
    if (!doc) {
      throw new Error('The doc argument must be an object');
    }
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
    if (!(req && req.res)) {
      throw new Error('You forgot to pass req as the first argument');
    }
    if (!doc) {
      throw new Error('The doc argument must be an object');
    }
    if (!(options && ((typeof options) === 'object'))) {
      throw new Error('The options argument must be an object');
    }
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
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!doc) {
      return callback(new Error('The doc argument must be an object'));
    }
    if (!(options && ((typeof options) === 'object'))) {
      return callback(new Error('The options argument must be an object'));
    }
    return self.retryUntilUnique(req, doc, function(callback) {
      return self.db.update({ _id: doc._id }, self.apos.utils.clonePermanent(doc), callback);
    }, callback);
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

  self.insertBody = function(req, doc, options, callback) {
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!doc) {
      return callback(new Error('The doc argument must be an object'));
    }
    if (!(options && ((typeof options) === 'object'))) {
      return callback(new Error('The options argument must be an object'));
    }
    return self.retryUntilUnique(req, doc, function(callback) {
      return self.db.insert(self.apos.utils.clonePermanent(doc), callback);
    }, callback);
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
    return _.keys(self.managers);
  };

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
  // for the docs module, this method invokes its callback
  // successfully without actually doing anything.
  // This is *not recommended* but has valid applications
  // in automated testing.

  self.lock = function(req, id, contextId, options, callback) {

    if (!callback) {
      callback = options;
      options = {};
    }

    if (self.options.conflictResolution === false) {
      return setImmediate(callback);
    }

    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }

    if (!(options && ((typeof options) === 'object'))) {
      return callback(new Error('The options argument must be an object'));
    }

    if (!id) {
      return callback('no id');
    }

    if (!contextId) {
      return callback('no contextId');
    }

    var criteria = {
      _id: id
    };

    if (!options.force) {
      criteria.$or = [
        {
          advisoryLock: { $exists: 0 }
        },
        {
          'advisoryLock._id': contextId
        },
        {
          'advisoryLock.updatedAt': { $lt: self.getAdvisoryLockExpiration() }
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
    return self.db.update(criteria, {
      $set: {
        advisoryLock: {
          username: req.user && req.user.username,
          title: req.user && req.user.title,
          _id: contextId,
          updatedAt: new Date()
        }
      }
    }, function(err, result) {
      if (err) {
        return callback(err);
      }
      if (!result.result.nModified) {
        return self.db.findOne({ _id: id }, { advisoryLock: 1 }, function(err, info) {
          if (err) {
            return callback(err);
          }
          if (!info) {
            return callback('notfound');
          }
          if (!info.advisoryLock) {
            // Nobody else has a lock but you couldn't get one —
            // must be permissions
            return callback('forbidden');
          }
          if (info.advisoryLock.username === req.user.username) {
            return callback('locked-by-me', req.__ns('apostrophe', 'You may be editing that document in another tab or window.\nIf you take control, you could lose work in that tab or window.\nDo you want to take control?'));
          }
          return callback('locked', req.__ns('apostrophe',
            'That document may be being edited by %s (%s).\nIf you take control, they could lose unsaved work.\nDo you want to take control?',
            info.advisoryLock.title, info.advisoryLock.username
          ));
        });
      }
      return callback(null);
    });

  };

  // Verifies that a lock obtained with `lock` is
  // still held by the given context id. If not,
  // the error is the string `locked` and a second
  // argument with an internationalized message
  // is provided also. If the lock was taken
  // by the same user in another tab or window,
  // the error is `locked-by-me`.
  //
  // If the `conflictResolution` option is set to false
  // for the docs module, this method invokes its callback
  // successfully without actually doing anything.
  // This is *not recommended* but has valid applications
  // in automated testing.

  self.verifyLock = function(req, id, contextId, callback) {

    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }

    if (!id) {
      return callback('no id');
    }

    if (!contextId) {
      return callback('no contextId');
    }

    var message;
    if (self.options.conflictResolution === false) {
      return setImmediate(callback);
    }
    return async.series([ refresh, check ], function(err) {
      return callback(err, message);
    });

    function refresh(callback) {
      // Refresh the timestamp of an existing lock, if we still hold it
      var criteria = {
        _id: id,
        'advisoryLock._id': contextId,
        'advisoryLock.updatedAt': { $gte: self.getAdvisoryLockExpiration() }
      };
      return self.db.update(criteria, {
        $set: {
          'advisoryLock.updatedAt': new Date()
        }
      }, callback);
    }

    function check(callback) {
      return self.db.findOne(
        { _id: id },
        { advisoryLock: 1 },
        function(err, info) {
          if (err) {
            return callback(err);
          }
          if (!info) {
            return callback('notfound');
          }
          // A stale lock is effectively a missing lock
          if (info.advisoryLock && info.advisoryLock.updatedAt < self.getAdvisoryLockExpiration()) {
            return callback('notfound');
          }
          if ((!info.advisoryLock) || (info.advisoryLock._id !== contextId)) {
            if (info.advisoryLock && info.advisoryLock.username === req.user.username) {
              message = req.__ns('apostrophe', 'You are now editing this document in another tab or window.');
              return callback('locked-by-me');
            }
            message = req.__ns('apostrophe', 'Control of this document has been taken by another user.');
            return callback('locked');
          }
          return callback(null);
        }
      );
    }
  };

  self.getAdvisoryLockExpiration = function() {
    return new Date(Date.now() - 1000 * self.options.advisoryLockTimeout);
  };

  // Release a document lock set via `lock` for
  // a particular contextId.
  //
  // If the `conflictResolution` option is set to false
  // for the docs module, this method invokes its callback
  // successfully without actually doing anything.
  // This is *not recommended* but has valid applications
  // in automated testing.

  self.unlock = function(req, id, contextId, callback) {

    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }

    if (self.options.conflictResolution === false) {
      return setImmediate(callback);
    }

    if (!id) {
      return callback('no id');
    }
    if (!contextId) {
      return callback('no contextId');
    }
    return self.db.update({
      _id: id,
      'advisoryLock._id': contextId
    }, {
      $unset: {
        advisoryLock: 1
      }
    }, callback);
  };

  // Release all document locks set on behalf of
  // the given `contextId`.
  //
  // If the `conflictResolution` option is set to false
  // for the docs module, this method invokes its callback
  // successfully without actually doing anything.
  // This is *not recommended* but has valid applications
  // in automated testing.

  self.unlockAll = function(req, contextId, callback) {

    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument'));
    }
    if (!contextId) {
      return callback('no contextId');
    }

    if (self.options.conflictResolution === false) {
      return setImmediate(callback);
    }

    if (!contextId) {
      return callback('no contextId provided');
    }
    return self.db.update({
      'advisoryLock._id': contextId
    }, {
      $unset: {
        advisoryLock: 1
      }
    },
    {
      multi: true
    },
    callback);
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

  // Useful middleware when we want to reject a user who does not at least
  // have editing permissions for at least one doc type, but we don't care what
  // doc type it is. This is just for defense in depth, of course you still need
  // to be sensible about what you return or permit for individual situations.
  // It is a good gate for access to the manage view of pages when editing a join
  // with pages, for instance
  self.requireEditorOfSomething = function(req, res, next) {
    var something = false;
    _.each(_.keys(self.apos.docs.managers), function(type) {
      if (self.apos.permissions.can(req, 'edit-' + type)) {
        something = true;
        return false;
      }
    });
    if (!something) {
      return res.send({ status: 'forbidden' });
    }
    return next();
  };

};
