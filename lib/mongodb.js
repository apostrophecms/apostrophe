var _ = require('lodash');
var async = require('async');

/**
 * mongodb
 * @augments Augments the apos object with methods relating to
 * MongoDB and the MongoDB collections that Apostrophe requires.
 */

module.exports = function(self) {
  function checkVersion(callback) {
    self.db.command({ 'serverStatus': 1 }, function(err, result) {
      if (err) {
        if (err.code === 13) {
          // We don't have the privileges to know what
          // version of MongoDB is running. Not a lot we
          // can do but trust the user
          return callback(null);
        }
        return callback(err);
      }
      var versions = result.version.split(/\./);
      if ((versions[0] < 2) || ((versions[0] == 2) && (versions[1] < 6))) {
        return callback(new Error('\n\nMONGODB TOO OLD: your server must be at least MongoDB 2.6.0.\nYou currently have: ' + result.version));
      }
      return callback(null);
    });
  }
  function setupPages(callback) {
    self.db.collection('aposPages', function(err, collection) {
      function indexType(callback) {
        self.pages.ensureIndex({ type: 1 }, {}, callback);
      }
      function indexSlug(callback) {
        self.pages.ensureIndex({ slug: 1 }, { unique: true }, callback);
      }
      function indexPath(callback) {
        // Careful, non-tree pages will not have a path, must be a sparse index
        self.pages.ensureIndex({ path: 1 }, { unique: true, sparse: true }, callback);
      }
      // For typical getDescendants calls
      function indexPathLevelRank(callback) {
        self.pages.ensureIndex({ path: 1, level: 1, rank: 1 }, { }, callback);
      }
      function indexLevelRank(callback) {
        self.pages.ensureIndex({ level: 1, rank: 1 }, { }, callback);
      }
      function indexSortTitle(callback) {
        self.pages.ensureIndex({ sortTitle: 1 }, { }, callback);
      }
      function indexStartDate(callback) {
        self.pages.ensureIndex({ startDate: 1 }, { }, callback);
      }
      function indexStart(callback) {
        self.pages.ensureIndex({ start: 1 }, { }, callback);
      }
      function indexStartAndSortTitle(callback) {
        self.pages.ensureIndex({ start: 1, sortTitle: 1 }, { }, callback);
      }
      function indexEndDate(callback) {
        self.pages.ensureIndex({ endDate: 1 }, { }, callback);
      }
      function indexEnd(callback) {
        self.pages.ensureIndex({ end: 1 }, { }, callback);
      }
      function indexTags(callback) {
        self.pages.ensureIndex({ tags: 1 }, { }, callback);
      }
      function indexPublished(callback) {
        self.pages.ensureIndex({ published: 1 }, { }, callback);
      }
      function indexPublishedAtBackwards(callback) {
        self.pages.ensureIndex({ publishedAt: -1 }, { }, callback);
      }
      function indexPublishedAtForwards(callback) {
        self.pages.ensureIndex({ publishedAt: 1 }, { }, callback);
      }
      function indexText(callback) {
        return self.ensureTextIndex(function(err) {
          if (err) {
            console.error('WARNING: unable to ensure text index, apostrophe:migrate can fix that');
          }
          return callback(null);
        });
      }
      // geo property is reserved for a geoJSON point
      function indexGeo(callback) {
        self.pages.ensureIndex({ geo: '2dsphere' }, { }, callback);
      }
      // Must be able to sort case insensitively on names
      function indexSortName(callback) {
        self.pages.ensureIndex({ sortLastName: 1, sortFirstName: 1 }, { }, callback);
      }
      self.pages = collection;
      async.series([indexType, indexSlug, indexPath, indexSortTitle, indexStartDate, indexStart, indexEndDate, indexStartAndSortTitle, indexEnd, indexTags, indexPublished, indexPublishedAtBackwards, indexPublishedAtForwards, indexText, indexGeo, indexPathLevelRank, indexLevelRank, indexSortName ], callback);
      // ... more index functions
    });
  }

  // Each time a page or area is updated with putArea or putPage, a new version
  // object is also created. Regardless of whether putArea or putPage is called,
  // if the area is in the context of a page it is the entire page that is
  // versioned. A pageId or areaId property is added, which is a non-unique index
  // allowing us to fetch prior versions of any page or independently stored
  // area. Also createdAt and author. Author is a string to avoid issues with
  // references to deleted users.
  //
  // Note that this also provides full versioning for types built upon pages, such as
  // blog posts and snippets.

  function setupVersions(callback) {
    self.db.collection('aposVersions', function(err, collection) {
      function index(callback) {
        self.versions.ensureIndex({ pageId: 1, createdAt: -1 }, { }, callback);
      }
      self.versions = collection;
      async.series([index], callback);
      // ... more index functions
    });
  }

  function setupFiles(callback) {
    self.db.collection('aposFiles', function(err, collection) {
      self.files = collection;
      return callback(err);
    });
  }

  function setupVideos(callback) {
    self.db.collection('aposVideos', function(err, collection) {
      // Index the URLs
      function videoIndex(callback) {
        self.videos.ensureIndex({ video: 1 }, { }, callback);
      }
      self.videos = collection;
      return async.series([videoIndex], callback);
    });
  }

  function setupRedirects(callback) {
    self.db.collection('aposRedirects', function(err, collection) {
      self.redirects = collection;
      collection.ensureIndex({ from: 1 }, { unique: true }, function(err) {
        return callback(err);
      });
    });
  }

  function setupCache(callback) {
    return self.db.collection('aposCache', function(err, collection) {
      self._cache = collection;
      return async.series({
        keyIndex: function(callback) {
          return self._cache.ensureIndex({ key: 1, cache: 1 }, { unique: true }, callback);
        },
        expireIndex: function(callback) {
          return self._cache.ensureIndex({ updated: 1 }, { expireAfterSeconds: 0 }, callback);
        }
      }, callback);
    });
  }

  // This collection is a home for tags that were created
  // globally via the tag manager. To allow the same code to
  // be used to scan it, it has the same structure as
  // any other taggable collection, so each entry has a
  // tags array property with one tag in it. And that's all.
  function setupAllowedTags(callback) {
    return self.db.collection('aposAllowedTags', function(err, collection) {
      self.allowedTags = collection;
      return callback(err);
    });
  }

  /**
   * Ensure the MongoDB collections required by Apostrophe are available in the expected
   * properties (`apos.pages`, `apos.videos`, `apos.files`, `apos.versions`, `apos.redirects`). Also sets up indexes and checks version of mongodb.
   */
  self.initCollections = function(callback) {
    return async.series([checkVersion, setupPages, setupVersions, setupFiles, setupVideos, setupRedirects, setupCache, setupAllowedTags ], callback);
  };

  self.ensureTextIndex = function(callback) {
    return self.pages.ensureIndex( { highSearchText: 'text', lowSearchText: 'text', title: 'text', searchBoost: 'text' }, { weights: { title: 100, searchBoost: 150, highSearchText: 10, lowSearchText: 2 } }, callback);
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

  // `ids` should be an array of mongodb IDs. The elements of the `items` array, which
  // should be the result of a mongodb query, are returned in the order specified by `ids`.
  // This is useful after performing an `$in` query with MongoDB (note that `$in` does NOT sort its
  // results in the order given).
  //
  // Any IDs that do not actually exist for an item in the `items` array are not returned,
  // and vice versa. You should not assume the result will have the same length as
  // either array.
  //
  // Optionally you may specify a property name other than _id as the third argument.

  self.orderById = function(ids, items, idProperty) {
    if (idProperty === undefined) {
      idProperty = '_id';
    }
    var byId = {};
    _.each(items, function(item) {
      byId[item[idProperty]] = item;
    });
    items = [];
    _.each(ids, function(_id) {
      if (byId.hasOwnProperty(_id)) {
        items.push(byId[_id]);
      }
    });
    return items;
  };
};
