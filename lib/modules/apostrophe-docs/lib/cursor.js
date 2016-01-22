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
    self.filters = {};
    self.finalizers = {};
    self.afters = {};

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
      self[name] = function() {
        if (self._finalized) {
          throw new Error('The cursor has already been finalized, refusing to add ' + name + ' filter. To add more filters, clone this filter: cursor.clone()');
        }
        set.apply(self, arguments);
        return self;
      };
      var finalize = definition.finalize || function() {
      };
      self.finalizers[name] = function(callback) {
        var value = self.get(name);
        if (value === undefined) {
          self[name](definition.def);
        }
        if (finalize.length === 1) {
          return finalize(callback);
        }
        try {
          var returned = finalize();
          return setImmediate(_.partial(callback, null, returned));
        } catch (e) {
          return setImmediate(_.partial(callback, null, e));
        }
      };

      var after = definition.after || function() {
      };
      self.afters[name] = function(results, callback) {
        var value = self.get(name);
        if (value === undefined) {
          self[name](definition.def);
        }
        if (after.length === 2) {
          return after(results, callback);
        }
        try {
          after(results);
          return setImmediate(_.partial(callback, null, results));
        } catch (e) {
          return setImmediate(_.partial(callback, e));
        }
      };

      self.filters[name] = definition;
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

      launder: function(s) {
        if (typeof(s) !== 'object') {
          return undefined;
        }
        var sort = {};
        _.each(s, function(val, key) {
          if (typeof(key) !== 'string') {
            return;
          }
          if (val === "-1") {
            val = -1;
          } else if (val === "1") {
            val = 1;
          }
          if ((val !== -1) && (val !== 1)) {
            return;
          }
          sort[key] = val;
        });
        return sort;
      },

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
          // specify a sort or specify "sort: 'search'",
          // sort by search result quality
          if ((!sort) || (sort === 'search')) {
            sort = { textScore: { $meta: 'textScore' } };
          }
        } else if (!sort) {
          // A reasonable default sorting behavior
          sort = { title: 1 };
        }

        // So interested parties can see how the sort
        // ultimately worked out
        self.set('sort', sort);

        // Below here we're making it more mongo-tastic. Don't modify
        // the A2-tastic version, preserve it for inspection
        if (sort) {
          sort = _.cloneDeep(sort);
        }

        if (sort) {

          // SORTIFY BEHAVIOR
          // If a field has "sortify: true" in the schema, automatically
          // fix sort({ title: 1 }) to be sort({ titleSortify: 1 })

          var manager = self.apos.docs.getManager(self.get('type') || 'default');
          if (!manager.schema) {
            return setImmediate(callback);
          }

          var sortify = {};
          _.each(manager.schema, function(field) {
            if (field.sortify) {
              sortify[field.name] = true;
            }
          });
          _.each(_.keys(sort), function(key) {
            // automatically switch to sort-friendly versions of properties
            if (_.has(sortify, key)) {
              sort[key + 'Sortified'] = sort[key];
              delete sort[key];
            }
          });

        }

        self.set('sortMongo', sort);
      }
    });

    // Skip the first n documents. Affects
    // toArray and toObject.

    self.addFilter('skip', {
      launder: function(s) {
        return self.apos.launder.integer(s, 0, 0);
      },
      safeFor: 'public'
    });

    // Limit to n documents. Does not affect toCount().

    self.addFilter('limit', {
      launder: function(s) {
        return self.apos.launder.integer(s, 0, 0);
      },
      safeFor: 'public'
    });

    // You can also paginate docs rather than using
    // skip and limit directly.
    //
    // Set the number of docs per page.

    self.addFilter('perPage', {
      def: undefined
    });

    // Set the current page number

    self.addFilter('page', {
      def: 1,
      launder: function(i) {
        return self.apos.launder.integer(i, 1, 1);
      },
      finalize: function() {
        if (self.get('perPage')) {
          var page = self.get('page');
          self.skip((self.get('page') - 1) * self.get('perPage'));
          self.limit(self.get('perPage'));
        }
      },
      safeFor: 'public'
    });

    // Limit the returned docs to those for which the
    // user associated with the self's `req` has the
    // named permission.
    //
    // "edit-doc", "view-doc" and "publish-doc" are
    // permissions you're likely to want to restrict
    // results to.
    //
    // If you are also using the type() filter, then you
    // may simply pass "edit", "view", "publish", etc. and
    // the right suffix is automatically added.
    //
    // If this method is never called, or you pass
    // `undefined` or `null`, "view-doc" is checked for.
    //
    // If permissionNameOrFalse is explicitly `false`,
    // permissions are ignored (use this only for tasks
    // and special admin functionality).

    self.addFilter('permission', {
      finalize: function() {
        var typeSuffix = '-' + (self.get('type') || 'doc');
        var permission = self.get('permission');
        if (permission !== false) {
          if (permission && (!permission.match(/\-/))) {
            permission = permission + typeSuffix;
          }
          var p = permission || ('view-' + typeSuffix);
          self.and(self.apos.permissions.criteria(self.get('req'), permission || ('view-' + typeSuffix)));
        }
      },
      after: function(results) {
        // In all cases we mark the docs with ._edit and
        // ._publish if the req is allowed to do those things
        self.apos.permissions.annotate(self.get('req'), 'edit-doc', results);
        self.apos.permissions.annotate(self.get('req'), 'publish-doc', results);
      }
    });

    // Limits results to docs which are a good match for
    // a partial string typed by the user. This is
    // based on title, keywords and other high-priority
    // fields, not full text search

    self.addFilter('autocomplete', {
      finalize: require('./autocomplete.js')(self),
      safeFor: 'public',
      launder: function(s) {
        return self.apos.launder.string(s);
      }
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
      },
      safeFor: 'public',
      launder: function(s) {
        return self.apos.launder.string(s);
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
          // allow trash to work as a normal boolean; also treat
          // docs inserted with no trash property at all as not
          // being trash. We can't use $ne: true here because $ne is
          // nonselective (it won't use an index). -Tom
          self.and({
            $or: [
              {
                trash: { $exists: 0 }
              },
              {
                trash: false
              }
            ]
          });
          return;
        }
        self.and({
          trash: true
        });
      },
      safeFor: 'manage',
      launder: function(s) {
        return self.apos.launder.booleanOrNull(s);
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
            orphan: { $exists: 0 }
          });
          return;
        }
        self.and({
          orphan: true
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
      def: true,
      finalize: function() {
        var published = self.get('published');
        if (published === null) {
          return;
        }
        if (published) {
          self.and({
            published: true
          });
          return;
        }
        self.and({
          published: { $ne: true }
        });
      },
      safeFor: 'manage',
      launder: function(s) {
        return self.apos.launder.booleanOrNull(s);
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

    // This cursor will only retrieve documents of the
    // specified type. Filter out everything else, and
    // run the joins in the schema returned by the type's
    // manager object unless otherwise specified
    // (see the "joins" filter).

    self.addFilter('type', {
      set: function(type) {
        if (type) {
          self.set('type', type);
          self.and({ type: type });
        }
      }
    });

    // Perform joins if the 'type' filter is in use and
    // the type manager has a schema. If joins(false) is
    // explicitly called no joins are performed. If
    // joins() is invoked with an array of join names
    // only those joins and those intermediate to them
    // are performed (dot notation). See apostrophe-schemas
    // for more information.

    self.addFilter('joins', {
      def: true,
      after: function(results, callback) {
        if ((!self.get('joins')) || (!self.get('type'))) {
          return setImmediate(callback);
        }
        var manager = self.apos.docs.getManager(self.get('type'));
        if (!manager.schema) {
          return setImmediate(callback);
        }
        return self.apos.schemas.join(self.get('req'), manager.schema, results, self.get('joins'), callback);
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
    // the query, ignoring the `page`, `skip` and `limit` filters

    self.toCount = function(callback) {
      var cursor = self.clone();
      cursor.skip(undefined);
      cursor.limit(undefined);
      cursor.page(undefined);
      cursor.perPage(undefined);
      return cursor.toMongo(function(err, mongo) {
        if (err) {
          return callback(err);
        }
        return mongo.count(function(err, count) {
          if (err) {
            return callback(err);
          }
          if (self.get('page')) {
            var perPage = self.get('perPage');
            var limit = self.get('limit');
            var totalPages = Math.floor(count / perPage);
            if (count % perPage) {
              totalPages++;
            }
            self.set('totalPages', totalPages);
          }
          return callback(null, count);
        });
      });
    };

    // Invokes callback with `(err, docs)` where
    // `docs` is an array of documents matching
    // the query.

    self.toArray = function(callback) {
      return async.waterfall([
        self.toMongo,
        self.mongoToArray,
        self.after
      ], callback);
    };

    // Invokes callback with `(err, mongo)` where
    // `mongo` is a MongoDB self. You can use this
    // to access MongoDB's `nextObject` method, etc.
    // If you use it, you should also invoke `after`
    // for each result (see below).

    self.toMongo = function(callback) {

      return async.waterfall([
        function(callback) {
          return self.finalize(callback);
        },
        function(callback) {
          // console.log(require('util').inspect(self.state.criteria, { depth: 20 }));

          var mongo = self.db.find(self.get('criteria'), self.get('projection'));
          var util = require('util');
          var skip = self.get('skip');
          if (_.isNumber(skip)) {
            mongo.skip(skip);
          }
          var limit = self.get('limit');
          if (_.isNumber(limit)) {
            mongo.limit(limit);
          }
          mongo.sort(self.get('sortMongo'));
          return callback(null, mongo);
        }
      ], callback);
    };

    // Clones a cursor, creating an independent
    // clone that can be modified without modifying
    // the original cursor. This should be called when
    // querying based on the same criteria multiple
    // times.

    self.clone = function() {
      var cursor = self.apos.create(self.__meta.name, options);
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


    self.queryToFilters = function(query, safeFor) {
      _.each(query, function(value, name) {

        if (!_.has(self.filters, name)) {
          return;
        }

        if (!self.filters[name].launder) {
          return;
        }

        if (safeFor && safeFor !== 'manage' && safeFor !== self.filters[name].safeFor) {
          return;
        }

        value = self.filters[name].launder(value);
        self[name](value);

      });

      return self;
    };

    // Applies all defaults and transformations prior
    // to handing off the query to MongoDB.

    self.finalize = function(callback) {
      // We don't need to finalize twice because we disallow filters to
      // be added after initial finalization.
      if (self._finalized) {
        return callback(null);
      }
      return async.series(_.values(self.finalizers), function(err) {
        if (err) {
          if (err === 'refinalize') {
            return self.finalize(callback);
          }
          return callback(err);
        }
        self._finalized = true;
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

    // Invokes "after" methods of all filters
    // that have them

    self.after = function(results, callback) {
      // Since afters, in some cases, invoke filters, we have to
      // set self._finalized to false so these invocations don't
      // throw an exception. I worry about what this would do if
      // there was code running in parallel though.
      var originalFinalized = self._finalized;
      self._finalized = false;
      return async.eachSeries(_.values(self.afters), function(fn, callback) {
        return fn(results, callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        self._finalized = originalFinalized;
        return callback(null, results);
      });
    };
  }
};
