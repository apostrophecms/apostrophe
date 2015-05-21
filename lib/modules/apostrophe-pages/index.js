var async = require('async');
var path = require('path');
var _ = require('lodash');

module.exports = {

  afterConstruct: function(self, callback) {
    return self.ensureIndexes(callback);
  },

  construct: function(self, options) {
    require('./lib/helpers.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/routes.js')(self, options);


    self.ensureIndexes = function(callback) {
      return async.series([ indexPath ], callback);
      function indexPath(callback) {
        self.apos.docs.db.ensureIndex({ path: 1 }, { safe: true, unique: true, sparse: true }, callback);
      }
    };

    self.find = function(req, criteria, projection) {
      var cursor = self.apos.docs.find(req, criteria, projection);
      require('./lib/cursor.js')(self, cursor);
      return cursor;
    };

    self.insert = function(req, parentOrId, page, callback) {
      var parent;
      return async.series({
        getParent: function(callback) {
          if (typeof(parentOrId) === 'object') {
            parent = parentOrId;
            return setImmediate(callback);
          }
          return self.find(req, { _id: parentOrId }).published(null).areas(false).toObject(function(err, _parent) {
            if (err) {
              return callback(err);
            }
            if (!_parent) {
              return callback(new Error('parent not found'));
            }
            parent = _parent;
            if (!parent._publish) {
              return callback(new Error('cannot publish parent'));
            }
            return callback(null);
          });
        },
        determineNextRank: function(callback) {
          return self.apos.docs.db.find({
            path: new RegExp('^' + self.apos.utils.regExpQuote(parent.path + '/')),
            level: parent.level + 1
          }, {
            rank: 1
          })
          .sort({ rank: -1 })
          .limit(1)
          .toArray(function(err, results) {
            if (err) {
              return callback(err);
            }
            if (!results.length) {
              page.rank = 0;
            } else {
              page.rank = results[0].rank + 1;
            }
            return callback(null);
          });
        },
        insert: function(callback) {
          page.path = parent.path + '/' + self.apos.utils.slugify(page.title);
          page.level = parent.level + 1;
          return self.apos.docs.insert(req, page, callback);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, page);
      });
    };

    // Invoked via callForAll in the docs module

    self.docFixUniqueError = function(req, doc) {
      if (doc.path) {
        var num = (Math.floor(Math.random() * 10)).toString();
        doc.path += num;
      }
    };

    // position can be 'before', 'after' or 'inside' and
    // determines the moved page's new relationship to
    // the target page.
    //
    // The callback receives an error and, if there is no
    // error, also an array of objects with _id and slug
    // properties, indicating the new slugs of all
    // modified pages.

    self.move = function(req, movedId, targetId, position, callback) {
      var moved, target, parent, oldParent, changed = [];
      var rank;
      var originalPath;
      var originalSlug;
      return async.series([ getMoved, getTarget, determineRankAndNewParent, permissions, nudgeNewPeers, moveSelf, trashDescendants, afterMoved ], finish);
      function getMoved(callback) {
        if (moved) {
          return setImmediate(callback);
        }
        return self.find(req, { _id: movedId }).
            permission(false).
            trash(null).
            published(null).
            areas(false).
            ancestors({ depth: 1 }).
            toObject(function(err, page) {
          if (!page) {
            return callback(new Error('no such page'));
          }
          moved = page;
          if (!moved.level) {
            return callback(new Error('cannot move root'));
          }
          if (moved.parked) {
            return callback(new Error('cannot move parked page via move() API, see park() API'));
          }
          // You can't move the trashcan itself, but you can move its children
          if (moved.trash && (moved.level === 1)) {
            return callback(new Error('cannot move trashcan'));
          }
          oldParent = page._ancestors[0];
          return callback(null);
        });
      }
      function getTarget(callback) {
        if (target) {
          return callback(null);
        }
        return self.find(req, { _id: targetId }).
            permission(false).
            trash(null).
            published(null).
            areas(false).
            ancestors({ depth: 1 }).
            toObject(function(err, page) {
          if (!page) {
            return callback(new Error('no such page'));
          }
          target = page;
          if ((target.trash) && (target.level === 1) && (position === 'after')) {
            return callback(new Error('trash must be last'));
          }
          return callback(null);
        });
      }
      function determineRankAndNewParent(callback) {
        if (position === 'inside') {
          parent = target;
          rank = 0;
          return setImmediate(callback);
        }
        if (position === 'before') {
          rank = target.rank;
        } else if (position === 'after') {
          if (moved.parked) {
            // Reserved range
            return callback(new Error('cannot move a page after a parked page'));
          }
          rank = target.rank + 1;
        } else {
          return callback(new Error('no such position option'));
        }
        parent = target._ancestors[0];
        return setImmediate(callback);
      }
      function permissions(callback) {
        if (!moved._publish) {
          return callback(new Error('forbidden'));
        }
        // You can always move a page into the trash. You can
        // also change the order of subpages if you can
        // edit the subpage you're moving. Otherwise you
        // must have edit permissions for the new parent page.
        if ((oldParent._id !== parent._id) && (parent.type !== 'trash') && (!parent._edit)) {
          return callback(new Error('forbidden'));
        }
        return callback(null);
      }
      function nudgeNewPeers(callback) {
        // Nudge down the pages that should now follow us
        // Always remember multi: true
        self.apos.docs.db.update({ path: new RegExp('^' + self.apos.utils.regExpQuote(parent.path + '/')), level: parent.level + 1, rank: { $gt: rank } }, { $inc: { rank: 1 } }, { multi: true }, function(err, count) {
          return callback(err);
        });
      }
      function moveSelf(callback) {
        originalPath = moved.path;
        originalSlug = moved.slug;
        var level = parent.level + 1;
        var newPath = parent.path + '/' + path.basename(moved.path);
        // We're going to use update with $set, but we also want to update
        // the object so that moveDescendants can see what we did
        moved.path = newPath;
        // If the old slug wasn't customized, update the slug as well as the path
        if (parent._id !== oldParent._id) {
          var matchOldParentSlugPrefix = new RegExp('^' + self.apos.utils.regExpQuote(self.apos.utils.addSlashIfNeeded(oldParent.slug)));
          if (moved.slug.match(matchOldParentSlugPrefix)) {
            var slugStem = parent.slug;
            if (slugStem !== '/') {
              slugStem += '/';
            }
            moved.slug = moved.slug.replace(matchOldParentSlugPrefix, self.apos.utils.addSlashIfNeeded(parent.slug));
            changed.push({
              _id: moved._id,
              slug: moved.slug
            });
          }
        }
        moved.level = level;
        moved.rank = rank;
        // Are we in the trashcan? Our new parent reveals that
        if (parent.trash) {
          moved.trash = true;
        } else {
          delete moved.trash;
        }
        return self.update(req, moved, callback);
      }
      function updateDescendants(callback) {
        return self.updateDescendantsAfterMove(req, moved, originalPath, originalSlug, function(err, _changed) {
          if (err) {
            return callback(err);
          }
          changed = changed.concat(_changed);
          return callback(null);
        });
      }
      function trashDescendants(callback) {
        // Make sure our descendants have the same trash status
        var matchParentPathPrefix = new RegExp('^' + self.apos.utils.regExpQuote(moved.path + '/'));
        var $set = {};
        var $unset = {};
        if (moved.trash) {
          $set.trash = true;
        } else {
          $unset.trash = true;
        }
        var action = {};
        if (!_.isEmpty($set)) {
          action.$set = $set;
        }
        if (!_.isEmpty($unset)) {
          action.$unset = $unset;
        }
        if (_.isEmpty(action)) {
          return setImmediate(callback);
        }
        return self.apos.docs.db.update({ path: matchParentPathPrefix }, action, { multi: true }, callback);
      }
      function afterMoved(callback) {
        return self.apos.callAll(
          'pageAfterMove',
          req,
          moved,
          {
            originalSlug: originalSlug,
            originalPath: originalPath,
            changed: changed
          },
          callback
        );
      }

      function finish(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, changed);
      }
    };

    /**
     * Any module may have a method with this name
     * in which case it will be called after
     * pages are moved.
     *
     */

    // self.pageAfterMove = function(req, moved, info, callback) {
    //   // eventually invoke callback
    // };

    /**
     * Update the paths and slugs of descendant pages,
     * changing slugs only if they were
     * compatible with the original slug. Also update
     * the level of descendants.
     *
     * On success, invokes callback with
     * null and an array of objects with _id and slug properties, indicating
     * the new slugs for any objects that were modified.
     * @param  {page}   page
     * @param  {string}   originalPath
     * @param  {string}   originalSlug
     * @param  {Function} callback
     */
    self.updateDescendantsAfterMove = function(req, page, originalPath, originalSlug, callback) {
      // If our slug changed, then our descendants' slugs should
      // also change, if they are still similar. You can't do a
      // global substring replace in MongoDB the way you can
      // in MySQL, so we need to fetch them and update them
      // individually. async.mapSeries is a good choice because
      // there may be zillions of descendants and we don't want
      // to choke the server. We could use async.mapLimit, but
      // let's not get fancy just yet
      var changed = [];
      if ((originalSlug === page.slug) && (originalPath === page.path)) {
        return callback(null, changed);
      }
      var oldLevel = originalPath.split('/').length - 1;
      var matchParentPathPrefix = new RegExp('^' + self.apos.utils.regExpQuote(originalPath + '/'));
      var matchParentSlugPrefix = new RegExp('^' + self.apos.utils.regExpQuote(originalSlug + '/'));
      var done = false;
      var cursor = self.apos.docs.db.find({ path: matchParentPathPrefix }, { slug: 1, path: 1, level: 1 });
      return async.whilst(function() { return !done; }, function(callback) {
        return cursor.nextObject(function(err, desc) {
          if (err) {
            return callback(err);
          }
          if (!desc) {
            // This means there are no more objects
            done = true;
            return callback(null);
          }
          var newSlug = desc.slug.replace(matchParentSlugPrefix, page.slug + '/');
          changed.push({
            _id: desc._id,
            slug: newSlug
          });
          return async.series({
            update: function(callback) {
              return self.apos.docs.db.update({ _id: desc._id }, { $set: {
                // Always matches
                path: desc.path.replace(matchParentPathPrefix, page.path + '/'),
                // Might not match, and we don't care (if they edited the slug that far up,
                // they did so intentionally)
                slug: newSlug,
                level: desc.level + (page.level - oldLevel)
              }}, callback);
            },
          }, callback);
        });
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, changed);
      });
    };

    self.update = function(req, page, callback) {
      return self.apos.docs.update(req, page, callback);
    };

    // self.trash = function(req, pageOrId, callback) {
    // };

    self.apos.pages = self;

  }
};
