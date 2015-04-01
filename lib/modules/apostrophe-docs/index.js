var async = require('async');
var _ = require('lodash');

module.exports = {

  afterConstruct: function(self, callback) {
    self.apos.docs = self;
    return async.series([ self.enableCollection, self.ensureIndexes ], callback);
  },

  construct: function(self, options) {

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

    self.enableCollection = function(callback) {
      self.apos.db.collection('aposDocs', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

    self.ensureIndexes = function(callback) {

      async.series([ indexType, indexSlug, indexSortTitle, indexTags, indexPublished, indexText ], callback);

      function indexType(callback) {
        self.db.ensureIndex({ type: 1 }, { safe: true }, callback);
      }

      function indexSlug(callback) {
        self.db.ensureIndex({ slug: 1 }, { safe: true, unique: true }, callback);
      }

      function indexSortTitle(callback) {
        self.db.ensureIndex({ sortTitle: 1 }, { safe: true }, callback);
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
      return self.db.ensureIndex( { highSearchText: 'text', lowSearchText: 'text', title: 'text', searchBoost: 'text' }, { weights: { title: 100, searchBoost: 150, highSearchText: 10, lowSearchText: 2 }, safe: true }, callback);
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
      var cursor = self.apos.create('apostrophe-cursor', { docs: self });
      cursor.set('req', req);
      cursor.set('criteria', criteria);
      cursor.set('projection', projection);
      return cursor;
    };

    // Insert the given document. If the slug is not
    // unique it is made unique. apos.*.docBeforeInsert
    // and apos.*.docAfterInsert are called. On success
    // the callback is invoked with (null, doc).
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
    // the slug property.

    self.insert = function(req, doc, callback) {
      if (!self.apos.permissions.can(req, 'edit-doc')) {
        return setImmediate(_.partial(callback, 'forbidden'));
      }
      if (!doc._id) {
        doc._id = self.apos.utils.generateId();
      }
      if (doc.title) {
        doc.sortTitle = self.sortify(doc.title);
      }
      return async.series({
        beforeInsert: function(callback) {
          return self.apos.callMethodOfAllModules('docBeforeInsert', doc, callback);
        },
        insert: function(callback) {
          var done = false;
          return async.whilst(
            function() { return !done; },
            function(callback) {
              return self.db.insert(doc, function(err) {
                if (!err) {
                  done = true;
                  return callback(null);
                }
                if (!self.isUniqueError(err)) {
                  return callback(err);
                }
                var num = (Math.floor(Math.random() * 10)).toString();
                doc.slug += num;
                // This way the pages module can
                // also make "path" unique where
                // appropriate, etc.
                return self.apos.callMethodOfAllModules('docFixUniqueError', doc, callback);
              });
            },
            callback
          );
        },
        afterInsert: function(callback) {
          return self.apos.callMethodOfAllModules('docAfterInsert', doc, callback);
        }
      }, function(err) {
        return callback(err, (!err) && doc);
      });
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

    // Walk the areas in a doc. The callback receives the
    // area object and the dot-notation path to that object.
    //
    // If the callback explicitly returns `false`, the area
    // is *removed* from the page object, otherwise no
    // modifications are made.

    self.walkAreas = function(doc, callback) {
      return self.walk(doc, function(o, k, v, dotPath) {
        if (v && (v.type === 'area')) {
          return callback(v, dotPath);
        }
        return false;
      });
    };

    // Called for us by Cursor.afterLoaded, as well
    // as methods of this name in all other modules.
    // Adds ._edit and ._publish flags if we have
    // those rights on the documents.

    self.docsAfterLoaded = function(req, results) {
      self.apos.permissions.annotate(req, 'edit-doc', results);
      self.apos.permissions.annotate(req, 'publish-doc', results);
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

  }
};
