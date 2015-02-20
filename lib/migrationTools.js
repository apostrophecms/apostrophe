var async = require('async');
var _ = require('lodash');
var broadband = require('broadband');

/**
 * migrationTools
 * @augments Augments the apos object with convenience methods related to
 * large-scale migrations of content, as are sometimes required if we make
 * major changes to the organization of the data. These methods are NOT suitable
 * for use when displaying content to end users. They can be relatively slow, consume
 * resources heavily, and do not respect permissions in any way.
 */

module.exports = function(self) {
  // Iterate over ALL page objects. This is pricey; it should be used in
  // migrations, not everyday operations.
  // Note this will fetch virtual pages that are not part of the tree, the
  // trash page, etc. if you don't set criteria to the contrary. The simplest
  // possible criteria is {} which will get everything, including the
  // trash page. Consider using criteria on type and slug.
  //
  // Your 'each' function is called with a page object and a callback for each
  // page. Your 'callback' function is called at the end with an error if any.
  //
  // The `options` parameter may be skipped. If it is present,
  // `options.load` indicates that page loaders should be run. Otherwise
  // page loaders are NOT invoked, so widgets will not have their
  // dynamic properties.

  self.forEachPage = function(criteria, options, each, callback) {
    if (arguments.length === 3) {
      callback = each;
      each = options;
      options = {};
    }
    var req = self.getTaskReq();
    return self.forEachDocumentInCollection(self.pages, criteria, function(page, callback) {
      if (options.load) {
        return self.callLoadersForPage(req, page, function(err) {
          if (err) {
            return callback(err);
          }
          return each(page, callback);
        });
      } else {
        return each(page, callback);
      }
    }, callback);
  };

  // Iterates over files in the aposFiles collection.
  // If only 3 arguments are given the limit defaults to 1
  // (process only one file at a time, like eachSeries).

  self.forEachFile = function(criteria, limit, each, callback) {
    if (arguments.length === 3) {
      callback = each;
      each = limit;
      limit = 1;
    }

    // "Why not just call forEachDocumentInCollection?" File operations
    // can be very slow. This can lead to MongoDB cursor timeouts in
    // tasks like apostrophe:rescale. We need a robust solution that
    // does not require keeping a MongoDB cursor open too long. So we fetch
    // all of the IDs up front, then fetch buckets of "bucketSize" file objects
    // at a time and feed those through async.eachLimit. This is a
    // better compromise between RAM usage and reliability. -Tom

    var ids;
    var i = 0;
    var n = 0;
    var bucketSize = 100;
    return async.series({
      getIds: function(callback) {
        return self.files.find(criteria, { _id: 1 }).toArray(function(err, infos) {
          if (err) {
            return callback(err);
          }
          ids = _.pluck(infos, '_id');
          n = ids.length;
          return callback(null);
        });
      },
      processBuckets: function(callback) {
        return async.whilst(function() {
          return (i < n);
        }, function(callback) {
          var bucket = ids.slice(i, i + bucketSize);
          i += bucketSize;
          return self.files.find({ _id: { $in: bucket } }).toArray(function(err, files) {
            if (err) {
              return callback(err);
            }
            return async.eachLimit(files, limit, each, callback);
          });
        }, callback);
      }
    }, callback);
  };

  // Iterates over videos in the aposVideos collection.

  self.forEachVideo = function(criteria, each, callback) {
    return self.forEachDocumentInCollection(self.videos, criteria, each, callback);
  };

  // Iterate over every area on every page on the entire site. For migration use only.
  // Iterator receives page object, area name, area object and callback.

  self.forEachArea = function(each, callback) {
    return self.forEachPage({}, function(page, callback) {
      // Walking them is simple but we need to set up to iterate over them
      // asynchronously with callbacks
      var areas = {};
      self.walkAreas(page, function(area, dotPath) {
        areas[dotPath] = area;
      });
      return async.forEachSeries(Object.keys(areas), function(dotPath, callback) {
        // Make sure we don't crash the stack if 'each' invokes 'callback' directly
        // for many consecutive invocations
        return setImmediate(function() {
          return each(page, dotPath, areas[dotPath], callback);
        });
      }, callback);
    }, callback);
  };

  // Iterate over every Apostrophe item in every area in every page in the universe.
  // iterator receives page object, area name (dot notation), area object, item offset,
  // item object, callback. Yes, the area and item objects do refer to the same objects
  // you'd reach if you stepped through the properties of the page object, so updating
  // the one does update the other. Of course it is your responsibility to save the
  // change to the page object via MongoDB (`apos.pages.update`).

  self.forEachItem = function(each, callback) {
    return self.forEachArea(function(page, name, area, callback) {
      var n = -1;
      return async.eachSeries(area.items || [], function(item, callback) {
        n++;
        // Make sure we don't crash the stack if 'each' invokes 'callback' directly
        // for many consecutive invocations
        return setImmediate(function() {
          return each(page, name, area, n, item, callback);
        });
      }, function(err) {
        return callback(err);
      });
    }, function(err) {
      return callback(err);
    });
  };

  /**
   * Iterate over every document in the specified collection.
   * If only 4 arguments are given, "limit" is assumed to
   * be 1 (only process one document at a time).
   *
   * @param  {Object}   collection
   * @param  {Object}   criteria
   * @param  {Function}   each callback invoked for each item; receives a document and a callback
   * @param  {Function} callback Final callback
   */
  self.forEachDocumentInCollection = function(collection, criteria, limit, each, callback) {
    if (arguments.length === 4) {
      callback = each;
      each = limit;
      limit = 1;
    }

    // Guarantee that each behaves asynchronously. This
    // way we don't crash the stack because somebody called
    // callback(null) without doing any async work first. -Tom

    var iterator = function(doc, callback) {
      return each(doc, function(err) {
        return setImmediate(_.partial(callback, err));
      });
    };

    // Sort by _id. This ensures that no document is
    // ever visited twice, even if we modify documents as
    // we go along.
    //
    // Otherwise there can be unexpected results from find()
    // in typical migrations as the changes we make can
    // affect the remainder of the query.
    //
    // https://groups.google.com/forum/#!topic/mongodb-user/AFC1ia7MHzk

    var cursor = collection.find(criteria, { hint: { _id: 1 } }).sort({ _id: 1 });
    return broadband(cursor, limit, iterator, callback);
  };

  // An internal function for use by migrations that install system pages
  // like trash or search as children of the home page.
  self.insertSystemPage = function(page, callback) {
    // Determine rank of the new page, in case we didn't hardcode it, but
    // then check for a hardcoded rank too
    return self.pages.find({ path: /^home\/[\w\-]+$/ }, { rank: 1 }).sort({ rank: -1 }).limit(1).toArray(function(err, pages) {
      if (err) {
        return callback(null);
      }
      if (!page.rank) {
        var rank = 0;
        if (pages.length) {
          rank = pages[0].rank + 1;
        }
        page.rank = rank;
      }
      // System pages are always orphans at level 1
      page.level = 1;
      page.orphan = true;
      return self.pages.insert(page, callback);
    });
  };
};
