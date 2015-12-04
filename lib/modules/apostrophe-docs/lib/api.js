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
      self.db.ensureIndex({ type: 1 }, { safe: true }, callback);
    }

    function indexSlug(callback) {
      self.db.ensureIndex({ slug: 1 }, { safe: true, unique: true }, callback);
    }

    function indexTitleSortified(callback) {
      self.db.ensureIndex({ titleSortified: 1 }, { safe: true }, callback);
    }

    function indexUpdatedAt(callback) {
      self.db.ensureIndex({ updatedAt: -1 }, { safe: true }, callback);
    }

    function indexTags(callback) {
      self.db.ensureIndex({ tags: 1 }, { safe: true }, callback);
    }
    function indexPublished(callback) {
      self.db.ensureIndex({ published: 1 }, { safe: true }, callback);
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
    return self.db.ensureIndex( { highSearchText: 'text', lowSearchText: 'text', title: 'text', searchBoost: 'text' }, { default_language: self.options.searchLanguage || 'none', weights: { title: 100, searchBoost: 150, highSearchText: 10, lowSearchText: 2 }, safe: true }, callback);
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
    var cursor = self.apos.create('apostrophe-cursor', { docs: self });
    cursor.set('req', req);
    cursor.set('criteria', criteria);
    cursor.set('projection', projection);
    return cursor;
  };

  // Insert the given document. If the slug is not
  // unique it is made unique. docBeforeInsert,
  // docBeforeSave, docAfterInsert
  // and docAfterSave are called on all modules.
  // On success the callback is invoked with
  // (null, doc).
  //
  // If the slug property is not set, the title
  // property is converted to a slug. If neither
  // property is set, an error occurs.
  //
  // The `edit-doc` permission is checked for the
  // general case. `beforeInsertDoc` methods can
  // be used to enforce other restrictions.
  //
  // If a unique key error occurs,
  // apos.*.docFixUniqueError is called with the
  // document. Modify the document to fix any
  // properties that may need to be more unique
  // due to a unique index you have added. It is
  // not possible to know which property was
  // responsible. This method takes care of
  // the slug property directly.

  self.insert = function(req, doc, callback) {
    return async.series({
      beforeInsert: function(callback) {
        return self.apos.callAll('docBeforeInsert', req, doc, callback);
      },
      beforeSave: function(callback) {
        return self.apos.callAll('docBeforeSave', req, doc, callback);
      },
      insert: function(callback) {
        return self.insertBody(req, doc, callback);
      },
      afterInsert: function(callback) {
        return self.apos.callAll('docAfterInsert', req, doc, callback);
      },
      afterSave: function(callback) {
        return self.apos.callAll('docAfterSave', req, doc, callback);
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
  // all modules.
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

  self.update = function(req, doc, callback) {
    return async.series({
      beforeUpdate: function(callback) {
        return self.apos.callAll('docBeforeUpdate', req, doc, callback);
      },
      beforeSave: function(callback) {
        return self.apos.callAll('docBeforeSave', req, doc, callback);
      },
      update: function(callback) {
        return self.updateBody(req, doc, callback);
      },
      afterUpdate: function(callback) {
        return self.apos.callAll('docAfterUpdate', req, doc, callback);
      },
      afterSave: function(callback) {
        return self.apos.callAll('docAfterSave', req, doc, callback);
      },
    }, function(err) {
      return callback(err, (!err) && doc);
    });
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

  self.trash = function(req, idOrCriteria, callback) {
    var criteria = self.idOrCriteria(idOrCriteria);
    var doc;
    return async.series({
      find: function(callback) {
        return self.find(req, criteria)
          .published(null)
          .permission('edit-doc')
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
    }, callback);
  };

  self.trashBody = function(req, doc, callback) {
    return self.db.update( { _id: doc._id }, { $set: { trash: true } }, callback);
  };

  // Rescue the document matching the specified
  // criteria from the trash. Only one document
  // is rescued regardless of the criteria.
  // You must have permission to edit it.
  //
  // docBeforeRescue and docAfterRescue are
  // invoked on all modules.

  self.rescue = function(req, idOrCriteria, callback) {
    var criteria = self.idOrCriteria(idOrCriteria);
    var doc;
    return async.series({
      find: function(callback) {
        return self.find(req, criteria)
          .permission('edit-doc')
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
    }, callback);
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

  self.emptyTrash = function(req, idOrCriteria, callback) {
    var criteria = self.idOrCriteria(idOrCriteria);
    criteria.trash = true;
    criteria = {
      $and: [ criteria, self.apos.permissions.criteria(req, 'publish-doc') ]
    };
    return self.db.remove(criteria, callback);
  };


  // Recursively visit every property of a doc,
  // invoking a callback for each one. Optionally
  // deletes properties.
  //
  // The second argument must be a function that takes
  // an object, a key, a value and a "dot path" an
  // returns true if that property should be discarded.
  //
  // Remember, keys can be numbers; toString() is
  // your friend.
  //
  // If the original object looks like:
  //
  // { a: { b: 5 } }
  //
  // Then when the callback is invoked for b, the key
  // will be `b` and the dotPath will be the string
  // `a.b`.
  //
  // You do not need to pass the `_dotPath` argument.
  // That argument is used for recursive invocation.

  self.walk = function(doc, callback, _dotPath) {
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
    var remove = [];
    for (key in doc) {
      __dotPath = _dotPath + key.toString();
      if (callback(doc, key, doc[key], __dotPath) === false) {
        remove.push(key);
      } else {
        val = doc[key];
        if (typeof(val) === 'object') {
          self.walk(val, callback, __dotPath);
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
  // optional callback.

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
  // create docs, generates an _id if needed,
  // and sets createdAt to the current Date.
  // Note that methods of this name are invoked
  // on ALL modules that have them, starting with
  // this one. Although this method takes no
  // callback, other implementations MAY
  // take a callback and are invoked in series.

  self.docBeforeInsert = function(req, doc) {
    if (!self.apos.permissions.can(req, 'edit-doc')) {
      throw new Error('forbidden');
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

  self.docBeforeSave = function(req, doc) {
    if (!doc.slug) {
      if (doc.title) {
        doc.slug = self.apos.utils.slugify(doc.title);
      } else {
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

  self.docBeforeUpdate = function(req, doc) {
    if (!self.apos.permissions.can(req, 'edit-doc', doc)) {
      throw new Error('forbidden');
    }
  };

  // Do not call this yourself, it is called
  // by .update. You may override this method
  // to change the implementation.

  self.updateBody = function(req, doc, callback) {
    return self.retryUntilUnique(req, doc, function(callback) {
      return self.db.update({ _id: doc._id }, self.apos.utils.clonePermanent(doc), callback);
    }, callback);
  };

  // Move the given document to the trash. You
  // should call .rescue(), not this method. However
  // you can override this method to alter the
  // implementation.

  self.rescueBody = function(req, doc, callback) {
    return self.db.update({ _id: doc._id }, { $unset: { trash: 1 } }, callback);
  };

  // Insert the given document. You
  // should call .insert(), not this method. However
  // you can override this method to alter the
  // implementation.

  self.insertBody = function(req, doc, callback) {
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
    if (err.code === 13596) {
      return true;
    }
    return ((err.code === 13596) || (err.code === 11000) || (err.code === 11001));
  };

  self.managers = {};

  // Set the manager object corresponding
  // to a given doc type. However it is usually easier
  // to call getManager(type) and modify that object.

  self.setManager = function(type, manager) {
    self.managers[type] = manager;
  };

  // Fetch the manager object corresponding to a given
  // doc type. The manager object provides services such
  // as find(). By default a manager object is created
  // for you. That object can be modified to extend the
  // functionality for a particular type, or you can call
  // setManager if you have created one from scratch.
  // See manager.js for the default manager's feature set.

  self.getManager = function(type) {
    if (self.managers[type]) {
      return self.managers[type];
    }
    self.managers[type] = require('./manager.js')(self, type);
    return self.managers[type];
  };

  // This method provides the back end of /autocomplete routes.
  // For the implementation of the autocomplete() filter see autocomplete.js.
  //
  // "query" must contain a "field" property which is the schema join field
  // that describes the relationship we're adding items to.
  //
  // "query" must also contain a "term" property, which is a partial
  // string to be autocompleted; otherwise an empty array is delivered
  // to the callback.
  //
  // We don't launder the input here, see the 'autocomplete' route.

  self.autocomplete = function(req, query, callback) {
    var criteria = {};
    var type = self.apos.launder.string(query.field.withType);
    var manager = self.getManager(type);
    if (!manager) {
      return callback(new Error('invalid type'));
    }
    var cursor = manager.find(req, {}, {});
    cursor.projection(manager.getAutocompleteProjection(), query);
    if (query.term !== undefined) {
      var term = self.apos.launder.string(query.term);
      cursor.autocomplete(term);
    } else {
      return callback(null, []);
    }

    if (!(query.filters && query.filters.limit)) {
      cursor.limit(10);
    }

    // This is the big payoff of blessing join fields: we can apply their
    // filters in API calls like this one, knowing that the field definition
    // the browser sent us is one the developer created
    cursor.queryToFilters(query.field.filters || {});

    // Format it as value & id properties for compatibility with jquery UI autocomplete
    cursor.toArray(function(err, docs) {
      if (err) {
        return callback(err);
      }
      // Put the snippets in id order
      if (query.values) {
        docs = self.apos.utils.orderById(query.values, docs);
      }
      var results = _.map(docs, function(doc) {
        var response = {
          // jquery ui autocomplete demands label and value
          label: manager.getAutocompleteTitle(doc, query),
          value: doc._id
        };
        _.defaults(response, _.omit(doc, 'title', '_id'));
        return response;
      });
      return callback(null, results);
    });
  };

  // Add fields to the list of those unsuitable for
  // rollback due to knock-on effects, permissions checks,
  // etc.

  self.docUnversionedFields = function(req, doc, fields) {
    fields.push('slug', 'docPermissions');
  };

};
