var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {
  var cursor = {};
  _.defaults(cursor, {
    _state: {},

    // Public API of cursors

    // MODIFIERS
    //
    // These methods modify the cursor, adding criteria,
    // setting the projection, setting the sort, etc.
    // Where possible they match the corresponding
    // MongoDB method.

    // Set the MongoDB criteria. Other criteria are
    // also applied behind the scenes to ensure users
    // do not see what they should not see, etc.

    criteria: function(c) {
      cursor.set('criteria', c);
      return cursor;
    },

    // Require all criteria already specified AND
    // the criteria object specified by `c` to match
    // the docs

    and: function(c) {
      var criteria = cursor.get('criteria');
      if (!criteria) {
        cursor.set(c);
      } else {
        cursor.set({
          $and: [ criteria, c ]
        });
      }
      return cursor;
    },

    // Set the MongoDB projection.

    projection: function(p) {
      cursor.set('projection', p);
      return cursor;
    },

    // Set the MongoDB sort.
    //
    // If `false` is explicitly passed, there is
    // no sort at all (helpful with `$near`).
    //
    // If this method is never called or `obj` is
    // undefined, a case-insensitive sort on the title
    // is the default, unless `search()` has been
    // called, in which case a sort by search result
    // quality is the default.

    sort: function(obj) {
      cursor.set('sort', obj);
      return cursor;
    },

    // Skip the first n documents. Does
    // not affect toCount().

    skip: function(n) {
      cursor.set('skip', n);
      return cursor;
    },

    // Limit to n documents. Does not affect toCount().

    limit: function(n) {
      cursor.set('limit', n);
      return cursor;
    },

    // Limit the returned docs to those for which the
    // user associated with the cursor's `req` has the
    // named permission.
    //
    // "edit-doc", "view-doc" and "publish-doc" are
    // permissions you're likely to want to restrict
    // results to.
    //
    // If this method is never called, or you pass
    // `undefined` or `null`, "view-doc" is checked for.
    //
    // If permissionNameOrFalse is explicitly `false`,
    // permissions are ignored (use this only for tasks
    // and special admin functionality).

    permission: function(permissionNameOrFalse) {
      cursor.set('permission', permissionNameOrFalse);
      return cursor;
    },

    // Limits results to docs which are a good match for
    // a partial string typed by the user. This is
    // based on title, keywords and other high-priority
    // fields, not full text search

    autocomplete: function(prefixText) {
      cursor.set('autocomplete', prefixText);
      return cursor;
    },

    // if flag is `false`, `undefined` or this method is
    // never called, return only docs not in the trash.
    //
    // if flag is `true`, return only docs in the trash.
    //
    // if flag is `null` (not undefined), return
    // docs regardless of trash status.

    trash: function(flag) {
      cursor.set('trash', flag);
      return cursor;
    },

    // if flag is `null`, `undefined` or this method
    // is never called, return docs regardless of
    // orphan status. if flag is `true`, return only
    // orphan docs. If flag is `false`, return only
    // docs that are not orphans

    orphan: function(flag) {
      cursor.set('orphan', flag);
      return cursor;
    },

    // if flag is `undefined`, `true` or this
    // method is never called, return only published docs.
    //
    // If flag is `false`, return only unpublished docs.
    //
    // If flag is `null`, return docs without regard
    // to published status.

    published: function(flag) {
      cursor.set('published', flag);
      return cursor;
    },

    // YIELDERS
    //
    // These methods deliver docs or other
    // result values and do not return the cursor.

    // Invokes callback with `(err, results)` where
    // `results` is an array of all distinct values
    // for the given `property`

    toDistinct: function(property, callback) {
      return cursor.finalize(function(err) {
        if (err) {
          return callback(err);
        }
        return self.db.distinct(property, cursor.get('criteria'), callback);
      });
    },

    // Invokes callback with `(err, doc)` where
    // `doc` is the first document matching the query

    toObject: function(callback) {
      var limit = cursor.get('limit');
      cursor.set('limit', 1);
      return cursor.toArray(function(err, results) {
        if (err) {
          return callback(err);
        }
        cursor.set('limit', limit);
        return callback(null, results[0]);
      });
    },

    // Invokes callback with `(err, count)` where
    // `count` is the number of documents matching
    // the query. Ignores `skip` and `limit`

    toCount: function(callback) {
      return cursor.toMongo(function(err, mongo) {
        if (err) {
          return callback(err);
        }
        return mongo.count(callback);
      });
    },

    // Invokes callback with `(err, docs)` where
    // `docs` is an array of documents matching
    // the query.

    toArray: function(callback) {
      console.log('start of toArray');
      return async.waterfall([
        cursor.toMongo,
        cursor.mongoToArray,
        cursor.markPermissionsAndLoadWidgets,
        cursor.loadDocsEvent,
      ], callback);
    },

    // Invokes callback with `(err, mongo)` where
    // `mongo` is a MongoDB cursor. You can use this
    // to access MongoDB's `nextObject` method, etc.

    toMongo: function(callback) {

      return async.waterfall([
        function(callback) {
          console.log('calling finalize');
          return cursor.finalize(callback);
        },
        function(callback) {
          console.log('calling db.find');
          var mongo = self.db.find(cursor.get('criteria'), cursor.get('projection'));
          var mongoMethods = [ 'skip', 'limit' ];

          _.each(mongoMethods, function(method) {
            var value = cursor.get(method);
            if (value) {
              mongo[method](value);
            }
          });
          return callback(null, mongo);
        }
      ], callback);
    },

    // Protected API of cursors (for extending cursors).

    // Methods you add to cursors should store their
    // state with this method rather than by directly
    // modifying `cursor` or `cursor._state`

    set: function(key, value) {
      cursor._state[key] = value;
      return cursor;
    },

    // Methods you add to cursors should fetch their
    // state with this method rather than by directly
    // modifying `cursor` or `cursor._state`

    get: function(key) {
      return cursor._state[key];
    },

    // Applies all defaults and transformations
    // to the cursor. This is the last method called
    // by `toMongo` prior to invoking Mongo's `find`
    // method. Also called by `toDistinct`. When
    // the callback is invoked successfully it is
    // an appropriate time to pass the criteria
    // and projection to mongodb for an actual find()
    // or distinct() call.

    finalize: function(callback) {
      cursor.finalizeCriteria();
      cursor.finalizeProjection();
      cursor.finalizePermission();
      cursor.finalizeSort();
      return async.series({
        autocomplete: function(callback) {
          return cursor.finalizeAutocomplete(callback);
        },
        custom: function(callback) {
          var callbacks = [];
          self.apos.emit('finalizeCursor', cursor, callbacks);
          console.log('invoking series');
          return async.series(callbacks, callback);
        }
      }, function(err) {
        // discard other arguments so we don't
        // confuse async.waterfall
        return callback(err);
      });
    },

    finalizeCriteria: function() {
      var criteria = cursor.get('criteria');
      if (!criteria) {
        cursor.set('criteria', {});
      }
    },

    finalizeProjection: function() {
      var projection = cursor.get('projection');
      if (!projection) {
        cursor.set('projection', {});
      }
    },

    // Implementation details, subject to change

    finalizePermission: function() {
      var permission = cursor.get('permission');

      if (permission !== false) {
        cursor.set('criteria', {
          $and: [
            cursor.get('criteria'),
            self.apos.permissions.criteria(cursor.get('req'), permission || 'view-page')
          ]
        });
      }
    },

    // Implementation details, subject to change

    finalizeSort: function(callback) {

      // adjust the sort option taking the search
      // option into account, and supplying a default
      // sort unless expressly declined

      var sort = cursor.get('sort');

      if (sort === false) {
        // OK, you really truly don't want a sort
        // (for instance, you are relying on the
        // implicit sort of $near)
      } else if (cursor.get('search')) {
        // Text search is in the picture. If they don't
        // specify a sort or specify sort: 'q' or
        // sort: 'search', sort by search result quality
        if ((!sort) || (sort === 'q') || (sort === 'search')) {
          sort = { textScore: { $meta: 'textScore' } };
        }
      } else if (!sort) {
        // A reasonable default sorting behavior
        sort = { sortTitle: 1 };
      }
      cursor.set('sort', sort);
    },

    // Implementation details, subject to change

    finalizeAutocomplete: require('./autocomplete.js')(self, cursor),

    // Implementation details, subject to change

    finalizeTrash: function() {
      var trash = cursor.get('trash');
      if (trash === null) {
        return;
      }
      if (!trash) {
        cursor.set('criteria', {
          $and: [
            {
              trash: { $exists: 0 }
            },
            cursor.get('criteria')
          ]
        });
        return;
      }
      cursor.set('criteria', {
        $and: [
          {
            trash: true
          },
          cursor.get('criteria')
        ]
      });
    },

    // Implementation details, subject to change

    finalizeOrphan: function() {
      var orphan = cursor.get('orphan');
      if ((orphan === undefined) || (orphan === null)) {
        return;
      }
      if (!trash) {
        cursor.set('criteria', {
          $and: [
            {
              trash: { $exists: 0 }
            },
            cursor.get('criteria')
          ]
        });
        return;
      }
      cursor.set('criteria', {
        $and: [
          {
            trash: true
          },
          cursor.get('criteria')
        ]
      });
    },

    // Implementation details, subject to change

    finalizePublished: function() {
      var published = cursor.get('published');
      if (orphan === null) {
        return;
      }
      if (published || (published === undefined)) {
        cursor.set('criteria', {
          $and: [
            {
              published: true
            },
            cursor.get('criteria')
          ]
        });
        return;
      }
      cursor.set('criteria', {
        $and: [
          {
            trash: { $exists: 0 }
          },
          cursor.get('criteria')
        ]
      });
    },

    // Implementation details of toArray,
    // subject to change

    mongoToArray: function(mongo, callback) {
      console.log("mongoToArray");
      return mongo.toArray(callback);
    },

    // Implementation details of toArray,
    // subject to change

    markPermissionsAndLoadWidgets: function(results, callback) {
      console.log("markPermissions");
      var req = cursor.get('req');
      self.apos.permissions.annotate(req, 'edit-doc', results);
      self.apos.permissions.annotate(req, 'publish-doc', results);
      return async.eachSeries(results, function(doc, callback) {
        return setImmediate(function() {
          return self.loadWidgets(req, doc, callback);
        });
      }, function(err) {
        return callback(err, (!err) && results);
      });
    },

    // Implementation details of toArray,
    // subject to change

    loadDocsEvent: function(results, callback) {
      var callbacks = [];
      console.log('loadDocsEvent');
      self.apos.emit('loadDocs', cursor, results, callbacks);
      return async.series(callbacks, function(err) {
        console.log('after loadDocsEvent');
        return callback(err, (!err) && results);
      });
    }
  });
  return cursor;
};

