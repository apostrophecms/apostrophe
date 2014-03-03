var async = require('async');

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

  self.forEachFile = function(criteria, each, callback) {
    return self.forEachDocumentInCollection(self.files, criteria, each, callback);
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
   * @param  {Object}   collection
   * @param  {Object}   criteria
   * @param  {Function}   each callback invoked for each item; receives a document and a callback
   * @param  {Function} callback Final callback
   */
  self.forEachDocumentInCollection = function(collection, criteria, each, callback) {
    collection.find(criteria, function(err, cursor) {
      if (err) {
        return callback(err);
      }
      var done = false;
      async.whilst(function() { return !done; }, function(callback) {
        return cursor.nextObject(function(err, page) {
          if (err) {
            return callback(err);
          }
          if (!page) {
            done = true;
            return callback(null);
          }
          // Make sure we don't crash the stack if 'each' invokes 'callback' directly
          // for many consecutive invocations
          return setImmediate(function() {
            each(page, callback);
          });
        });
      }, callback);
    });
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
