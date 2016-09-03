var broadband = require('broadband');
var async = require('async');

module.exports = function(self, options) {

  // Add a migration callback to be invoked when the apostrophe-migrations:migrate task is invoked. As an optimization,
  // the callback MIGHT not be invoked if it has been invoked before, but your callback MUST be idempotent (it must not
  // behave badly if the migration has been run before).
  //
  // The options argument may be omitted. If options.safe is true, this migration will still be run when the
  // --safe option is passed to the task. ONLY SET THIS OPTION IF THE CALLBACK HAS NO NEGATIVE IMPACT ON A RUNNING,
  // LIVE SITE. But if you can mark a migration safe, do it, because it minimizes downtime when deploying.

  self.add = function(name, callback, options) {
    if (!options) {
      options = {};
    }
    self.migrations.push({ name: name, options: options, callback: callback });
  };

  // Invoke the iterator function once for each doc in the aposDocs collection.
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // This method will never visit the same doc twice in a single call, even if
  // modifications are made.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.

  self.eachDoc = function(criteria, limit, iterator, callback) {
    if (arguments.length === 3) {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    return self.each(self.apos.docs.db, criteria, limit, iterator, callback);
  };

  // Invoke the iterator function once for each document in the given collection.
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // This method will never visit the same document twice in a single call, even if
  // modifications are made.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.

  self.each = function(collection, criteria, limit, iterator, callback) {
    if (arguments.length === 4) {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }

    // Sort by _id. This ensures that no document is
    // ever visited twice, even if we modify documents as
    // we go along.
    //
    // Otherwise there can be unexpected results from find()
    // in typical migrations as the changes we make can
    // affect the remainder of the query.
    //
    // https://groups.google.com/forum/#!topic/mongodb-user/AFC1ia7MHzk

    var cursor = collection.find(criteria);
    cursor.sort({ _id: 1 });
    return broadband(cursor, limit, iterator, callback);
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
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
  //
  // YOUR ITERATOR MUST BE ASYNCHRONOUS.

  self.eachArea = function(criteria, limit, iterator, callback) {
    if (arguments.length === 3) {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    return self.eachDoc(criteria, limit, function(doc, callback) {
      var areaInfos = [];
      self.apos.areas.walk(doc, function(area, dotPath) {
        areaInfos.push({ area: area, dotPath: dotPath });
      });
      return async.eachSeries(areaInfos, function(areaInfo, callback) {
        return iterator(doc, areaInfo.area, areaInfo.dotPath, callback);
      }, callback);
    }, callback);
  };

  // Invoke the iterator function once for each widget in each area in each doc
  // in the aposDocs collection. The `iterator` function receives
  // `(doc, widget, dotPath, callback)`. `criteria` may be used to limit
  // the docs for which this is done.
  //
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // This method will never visit the same doc twice in a single call, even if
  // modifications are made.
  //
  // Widget loaders are NOT called.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
  //
  // YOUR ITERATOR MUST BE ASYNCHRONOUS.

  self.eachWidget = function(criteria, limit, iterator, callback) {
    if (arguments.length === 3) {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    return self.eachArea(criteria, limit, function(doc, area, dotPath, callback) {
      var i = 0;
      return async.eachSeries(area.items || [], function(item, callback) {
        var n = i;
        i++;
        return iterator(doc, item, dotPath + '.' + n, callback);
      }, callback);
    }, callback);
  };


};
