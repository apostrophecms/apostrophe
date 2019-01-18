var broadband = require('broadband');
var async = require('async');
var Promise = require('bluebird');

module.exports = function(self, options) {

  // Add a migration function to be invoked when the apostrophe-migrations:migrate task is invoked.
  //
  // The function is invoked with a callback. If it returns a promise,
  // the promise is awaited, and the function should not also invoke the callback.
  // However for bc this situation is tolerated.
  //
  // The options argument may be omitted. If options.safe is true, this migration will still be run when the
  // --safe option is passed to the task. ONLY SET THIS OPTION IF THE CALLBACK HAS NO NEGATIVE IMPACT ON A RUNNING,
  // LIVE SITE. But if you can mark a migration safe, do it, because it minimizes downtime when deploying.

  self.add = function(name, fn, options) {
    if (!options) {
      options = {};
    }
    self.migrations.push({ name: name, options: options, callback: fn });
  };

  // Invoke the iterator function once for each doc in the aposDocs collection.
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // The iterator is passed a document and a callback. If the iterator
  // returns a promise, it is awaited, and must NOT invoke the callback.
  //
  // This method will never visit the same doc twice in a single call, even if
  // modifications are made.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY
  //
  // This method returns a promise if no callback is supplied.

  self.eachDoc = function(criteria, limit, iterator, callback) {
    if ((typeof limit) === 'function') {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    return self.each(self.apos.docs.db, criteria, limit, iterator, callback);
  };

  // Invoke the iterator function once for each document in the given collection.
  // If `limit` is omitted, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // This method will never visit the same document twice in a single call, even if
  // modifications are made.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
  //
  // The iterator is passed a document and a callback. If the iterator
  // accepts only one parameter, it is assumed to return a promise,
  // which is awaited in lieu of a callback.

  self.each = function(collection, criteria, limit, iterator, callback) {
    if ((typeof limit) === 'function') {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }

    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }

    function body(callback) {
      var cursor = collection.find(criteria);
      // Sort by _id. This ensures that no document is
      // ever visited twice, even if we modify documents as
      // we go along.
      //
      // Otherwise there can be unexpected results from find()
      // in typical migrations as the changes we make can
      // affect the remainder of the query.
      //
      // https://groups.google.com/forum/#!topic/mongodb-user/AFC1ia7MHzk
      cursor.sort({ _id: 1 });
      return broadband(cursor, limit, function(doc, callback) {
        if (iterator.length === 1) {
          return Promise.try(function() {
            return iterator(doc);
          }).then(function() {
            // http://goo.gl/rRqMUw
            callback(null);
            return null;
          }).catch(function(err) {
            return callback(err);
          });
        } else {
          return iterator(doc, callback);
        }
      }, callback);
    }
  };

  // Invoke the iterator function once for each area in each doc in
  // the aposDocs collection. The `iterator` function receives
  // `(doc, area, dotPath, callback)`. `criteria` may be used to limit
  // the docs for which this is done.
  //
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // This method will never visit the same doc twice in a single call, even if
  // modifications are made.
  //
  // If `callback` is omitted, a promise is returned.
  //
  // If the iterator accepts only four parameters, it is assumed to
  // return a promise. The promise is awaited, and the
  // iterator must NOT invoke its callback.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
  //
  // YOUR ITERATOR MUST BE ASYNCHRONOUS.

  self.eachArea = function(criteria, limit, iterator, callback) {
    if ((typeof limit) === 'function') {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }
    function body(callback) {
      return self.eachDoc(criteria, limit, function(doc, callback) {
        var areaInfos = [];
        self.apos.areas.walk(doc, function(area, dotPath) {
          areaInfos.push({ area: area, dotPath: dotPath });
        });
        return async.eachSeries(areaInfos, function(areaInfo, callback) {
          if (iterator.length === 3) {
            return Promise.try(function() {
              return iterator(doc, areaInfo.area, areaInfo.dotPath);
            }).then(function() {
              return callback(null);
            }).catch(callback);
          }
          return iterator(doc, areaInfo.area, areaInfo.dotPath, callback);
        }, function(err) {
          if (err) {
            return callback(err);
          }
          // Prevent stack crash when a lot of docs have no areas to iterate
          return setImmediate(callback);
        });
      }, callback);
    }
  };

  // Invoke the iterator function once for each widget in each area in each doc
  // in the aposDocs collection.
  //
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // The `iterator` function receives `(doc, widget, dotPath, callback)`.
  // `criteria` may be used to limit
  // the docs for which this is done. If the iterator accepts exactly
  // three arguments, it is assumed to return a promise, and the iterator
  // must NOT invoke the callback.
  //
  // This method will never visit the same doc twice in a single call, even if
  // modifications are made.
  //
  // Widget loaders are NOT called.
  //
  // If `callback` is omitted, a promise is returned.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
  //
  // YOUR ITERATOR MUST BE ASYNCHRONOUS.

  self.eachWidget = function(criteria, limit, iterator, callback) {
    if ((typeof limit) === 'function') {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }
    function body(callback) {
      return self.eachArea(criteria, limit, function(doc, area, dotPath, callback) {
        var i = 0;
        return async.eachSeries(area.items || [], function(item, callback) {
          var n = i;
          i++;
          if (iterator.length === 3) {
            return Promise.try(function() {
              return iterator(doc, item, dotPath + '.items.' + n);
            }).then(function() {
              return callback(null);
            }).catch(callback);
          } else {
            return iterator(doc, item, dotPath + '.items.' + n, callback);
          }
        }, callback);
      }, callback);
    }
  };

  // Most of the time, this is called automatically for you. Any
  // doc type schema field marked with `sortify: true` automatically
  // gets a migration implemented via this method. Don't forget
  // to run the `apostrophe-migration:migrate` task.
  //
  // Adds a migration that takes the given field, such as `lastName`, and
  // creates a parallel `lastNameSortified` field, formatted with
  // `apos.utils.sortify` so that it sorts and compares in a more
  // intuitive, case-insensitive way.
  //
  // The migration applies only to documents that match `criteria`.
  //
  // After adding such a migration, you can add `sortify: true` to the
  // schema field declaration for `field`, and any calls to
  // the `sort()` cursor filter for `lastName` will automatically
  // use `lastNameSortified`. You can also do that explicitly of course.
  //
  // Note that you want to do both things (add the migration, and
  // add `sortify: true`) because `sortify: true` guarantees that
  // `lastNameSortified` gets updated on all saves of the doc.
  //
  // `migrationNamePrefix` just helps uniquely identify this
  // migration, since different modules might contribute migrations
  // for fields of the same name.

  self.addSortify = function(migrationNamePrefix, criteria, field) {
    self.add(migrationNamePrefix + ':' + field + '-sortified', function(callback) {
      var clauses = [];
      var clause = {};
      clause[field + 'Sortified'] = { $exists: 0 };
      clauses.push(clause);
      clauses.push(criteria);
      return self.eachDoc({
        $and: clauses
      }, 5, function(doc, callback) {
        var $set = {};
        $set[field + 'Sortified'] = self.apos.utils.sortify(doc[field]);
        return self.apos.docs.db.update({
          _id: doc._id
        }, {
          $set: $set
        },
        callback);
      }, callback);
    });
  };

};
