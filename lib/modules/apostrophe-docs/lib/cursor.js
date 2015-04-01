var _ = require('lodash');
var async = require('async');
var util = require('util');

// Helpful to find missing setImmediate callbacks
// var superSetImmediate = setImmediate;
// setImmediate = function(fn) {
//   if (!fn) {
//     console.trace();
//     process.exit(1);
//   }
//   return superSetImmediate(fn);
// }

module.exports = {

  // We are not a module, do not use the
  // default base class
  extend: false,

  beforeConstruct: function(self, options) {
    self.options = options;
    self.apos = options.docs.apos;
    self.docs = options.docs;
    self.db = options.docs.db;
  },

  construct: function(self, options) {

    self.state = {};
    self.finalizers = {};

    // `name` is the filter name. `definition` can
    // have `set` and `finalize` functions and
    // a default value, `def`.
    //
    // `set` defaults to a simple `self.set` call
    // to store its single argument for retrieval
    // by `self.get('name')`. `finalize` defaults
    // to doing nothing. Usually your finalizer
    // modifies the criteria in some way.
    //
    // YOUR FINALIZER MUST BE IDEMPOTENT. That is,
    // it must not be harmful to invoke it twice.
    // If it is harmful, just use self.set to
    // undefine your state so your code doesn't
    // run twice.
    //
    // If the filter has still not been called at
    // finalization time, the filter is called
    // with `def` before the finalizer is invoked.
    //
    // `finalize` may optionally take a callback.
    //
    // If `finalize` returns the string `refinalize`
    // or delivers that string to its callback, the
    // entire series of finalizers is invoked
    // again. This is useful if you wish to simplify
    // the query and be assured that all of the other
    // finalizers will see your modification.

    self.addFilter = function(name, definition) {
      definition = definition || {};
      var set = definition.set || function(value) {
        self.set(name, value);
      };
      var finalize = definition.finalize || function() {
      };
      self[name] = function() {
        set.apply(self, arguments);
        return self;
      };
      self.finalizers[name] = function(callback) {
        var value = self.get(name);
        if (value === undefined) {
          self[name](definition.def);
        }
        if (finalize.length === 1) {
          return finalize(callback);
        }
        var returned = finalize();
        return setImmediate(_.partial(callback, null, returned));
      };
    };

    // Filters modify the cursor, adding criteria,
    // setting the projection, setting the sort, etc.

    // Set the MongoDB criteria. Other criteria are
    // also applied behind the scenes to ensure users
    // do not see what they should not see, etc.

    self.addFilter('criteria', { def: {} });

    // Require all criteria already specified AND
    // the criteria object specified by `c` to match
    // the docs

    self.addFilter('and', {
      set: function(c) {
        if (!c) {
          // So we don't crash on our default value
          return;
        }
        var criteria = self.get('criteria');
        if (!criteria) {
          self.criteria(c);
        } else {
          self.criteria({
            $and: [ criteria, c ]
          });
        }
      }
    });

    // Set the MongoDB projection

    self.addFilter('projection', {
      finalize: function() {
        var projection = self.get('projection');
        if (!projection) {
          projection = {};
        }
        if (self.get('search')) {
          // MongoDB mandates this if we want to sort on search result quality
          projection.textScore = { $meta: 'textScore' };
        }
        self.set('projection', projection);
      }
    });

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

    self.addFilter('sort', {
      finalize: function() {
        // adjust the sort option taking the search
        // option into account, and supplying a default
        // sort unless expressly declined

        var sort = self.get('sort');

        if (sort === false) {
          // OK, you really truly don't want a sort
          // (for instance, you are relying on the
          // implicit sort of $near)
        } else if (self.get('search')) {
          // Text search is in the picture. If they don't
          // specify a sort or specify sort: 'search',
          // sort by search result quality
          if ((!sort) || (sort === 'search')) {
            sort = { textScore: { $meta: 'textScore' } };
          }
        } else if (!sort) {
          // A reasonable default sorting behavior
          sort = { sortTitle: 1 };
        }
        self.set('sort', sort);

      }
    });

    // Skip the first n documents. Affects
    // toArray and toObject.

    self.addFilter('skip');

    // Limit to n documents. Does not affect toCount().

    self.addFilter('limit');

    // Limit the returned docs to those for which the
    // user associated with the self's `req` has the
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

    self.addFilter('permission', {
      finalize: function() {
        var permission = self.get('permission');
        if (permission !== false) {
          self.and(self.apos.permissions.criteria(self.get('req'), permission || 'view-doc'));
        }
      }
    });

    // Limits results to docs which are a good match for
    // a partial string typed by the user. This is
    // based on title, keywords and other high-priority
    // fields, not full text search

    self.addFilter('autocomplete', {
      finalize: require('./autocomplete.js')(self)
    });

    self.addFilter('search', {
      finalize: function() {
        // Other finalizers also address other
        // aspects of this, like adjusting
        // projection and sort
        var search = self.get('search');
        if (search) {
          // Set up MongoDB text index search
          self.and({
            $text: { $search: search }
          });
        }
      }
    });

    // if flag is `false`, `undefined` or this method is
    // never called, return only docs not in the trash.
    //
    // if flag is `true`, return only docs in the trash.
    //
    // if flag is `null` (not undefined), return
    // docs regardless of trash status.

    self.addFilter('trash', {
      finalize: function() {
        var trash = self.get('trash');
        if (trash === null) {
          return;
        }
        if (!trash) {
          self.and({
            trash: { $exists: 0 }
          });
          return;
        }
        self.and({
          trash: true
        });
      }
    });

    // if flag is `null`, `undefined` or this method
    // is never called, return docs regardless of
    // orphan status. if flag is `true`, return only
    // orphan docs. If flag is `false`, return only
    // docs that are not orphans

    self.addFilter('orphan', {
      finalize: function() {
        var orphan = self.get('orphan');
        if ((orphan === undefined) || (orphan === null)) {
          return;
        }
        if (!orphan) {
          self.and({
            trash: { $exists: 0 }
          });
          return;
        }
        self.and({
          trash: true
        });
      }
    });

    // if flag is `undefined`, `true` or this
    // method is never called, return only published docs.
    //
    // If flag is `false`, return only unpublished docs.
    //
    // If flag is `null`, return docs without regard
    // to published status.

    self.addFilter('published', {
      finalize: function() {
        var published = self.get('published');
        if (published === null) {
          return;
        }
        if (published || (published === undefined)) {
          self.and({
            published: true
          });
          return;
        }
        self.and({
          published: { $ne: true }
        });
      }
    });

    // Pass an explicit array of _ids. The returned
    // docs will be in that specific order. If a
    // doc is not mentioned in the array it will
    // be discarded from the result. docs that
    // exist in the array but not in the database are
    // also absent from the result.
    //
    // You may optionally specify a property name
    // other than _id to order the results on.

    self.addFilter('explicitOrder', {
      set: function(values, property) {
        self.set('explicitOrder', values);
        self.set('explicitOrderProperty', property);
      }
    });

    // YIELDERS
    //
    // These methods deliver docs or other
    // result values and do not return the cursor
    // (they are not chainable).

    // Invokes callback with `(err, results)` where
    // `results` is an array of all distinct values
    // for the given `property`

    self.toDistinct = function(property, callback) {
      return self.finalize(function(err) {
        if (err) {
          return callback(err);
        }
        return self.db.distinct(property, self.get('criteria'), callback);
      });
    };

    // Invokes callback with `(err, doc)` where
    // `doc` is the first document matching the query

    self.toObject = function(callback) {
      var limit = self.get('limit');
      self.set('limit', 1);
      return self.toArray(function(err, results) {
        if (err) {
          return callback(err);
        }
        self.set('limit', limit);
        return callback(null, results[0]);
      });
    };

    // Invokes callback with `(err, count)` where
    // `count` is the number of documents matching
    // the query. Ignores `skip` and `limit`

    self.toCount = function(callback) {
      return self.toMongo(function(err, mongo) {
        if (err) {
          return callback(err);
        }
        return mongo.count(callback);
      });
    };

    // Invokes callback with `(err, docs)` where
    // `docs` is an array of documents matching
    // the query.

    self.toArray = function(callback) {
      return async.waterfall([
        self.toMongo,
        self.mongoToArray,
        self.afterLoaded
      ], callback);
    };

    // Invokes callback with `(err, mongo)` where
    // `mongo` is a MongoDB self. You can use this
    // to access MongoDB's `nextObject` method, etc.

    self.toMongo = function(callback) {

      return async.waterfall([
        function(callback) {
          return self.finalize(callback);
        },
        function(callback) {
          var mongo = self.db.find(self.get('criteria'), self.get('projection'));
          mongo.skip(self.get('skip'));
          mongo.limit(self.get('limit'));
          mongo.sort(self.get('sort'));
          return callback(null, mongo);
        }
      ], callback);
    };

    // Clones a cursor, creating an independent
    // clone that can be modified without modifying
    // the original cursor.

    self.toCursor = function() {
      var cursor = self.apos.create(self.__meta.name)(options);
      cursor.state = _.cloneDeep(self.state);
      return cursor;
    };

    // Protected API of cursors (for extending cursors).

    // Filters and any other methods you add should
    // store their state with this method rather than
    // by directly modifying `self` or `self.state`

    self.set = function(key, value) {
      self.state[key] = value;
      return self;
    };

    // Methods you add to cursors should fetch their
    // state with this method rather than by directly
    // modifying `self` or `self.state`

    self.get = function(key) {
      return self.state[key];
    };

    // Applies all defaults and transformations prior
    // to handing off the query to MongoDB.

    self.finalize = function(callback) {
      return async.series(_.values(self.finalizers), function(err) {
        if (err) {
          if (err === 'refinalize') {
            return self.finalize(callback);
          }
          return callback(err);
        }
        return callback(null);
      });
    };

    // Implementation detail, subject to
    // change. You probably wanted toMongo

    self.mongoToArray = function(mongo, callback) {
      return mongo.toArray(callback, function(err, results) {
        if (err) {
          return callback(err);
        }
        var explicitOrder = self.get('explicitOrder');
        if (explicitOrder) {
          var explicitOrderProperty = self.get('explicitOrderProperty') || '_id';
          var _results = [];
          var byId = {};
          _.each(results, function(result) {
            byId[result[idProperty]] = result;
          });
          _.each(ids, function(_id) {
            if (byId.hasOwnProperty(_id)) {
              _results.push(byId[_id]);
            }
          });
          return callback(null, _results);
        }
      });
    };

    // Invoke docsAfterLoaded methods of all modules

    self.afterLoaded = function(results, callback) {
      self.apos.callAll('docsAfterLoaded', self.get('req'), results, function(err) {
        return callback(err, results);
      });
    };
  }
};

