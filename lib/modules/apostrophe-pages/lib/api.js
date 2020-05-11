var async = require('async');
var path = require('path');
var _ = require('@sailshq/lodash');
var Promise = require('bluebird');

module.exports = function(self, options) {

  // Obtain a cursor for finding pages. Adds filters useful for
  // including ancestors, descendants, etc.

  self.find = function(req, criteria, projection) {
    return self.apos.create(self.__meta.name + '-cursor', {
      apos: self.apos,
      req: req,
      criteria: criteria,
      projection: projection
    });
  };

  // Returns a cursor that finds pages the current user can edit
  // in a batch operation, including unpublished and trashed pages.
  self.findForBatch = function(req, criteria, projection) {
    var cursor = self.find(req, criteria, projection)
      .permission('edit')
      .published(null)
      .trash(null);
    return cursor;
  };

  // Insert a page as a child of the specified page or page ID.
  //
  // The `options` argument may be omitted completely. If
  // `options.permissions` is set to false, permissions checks
  // are bypassed.
  //
  // If no callback is supplied, a promise is returned.

  self.insert = function(req, parentOrId, page, options, callback) {
    if (typeof (arguments[3]) !== 'object') {
      callback = options;
      options = {};
    }
    var bodyWithLock = self.withLock(req, body);
    if (callback) {
      return bodyWithLock(callback);
    } else {
      return Promise.promisify(bodyWithLock)();
    }
    function body(callback) {
      var parent;
      return async.series({
        getParent: function(callback) {
          if (typeof (parentOrId) === 'object') {
            parent = parentOrId;
            return setImmediate(callback);
          }
          var cursor = self.find(req, { _id: parentOrId }).published(null).areas(false);
          if (options.permissions === false) {
            cursor.permission(false);
          }
          return cursor.toObject(function(err, _parent) {
            if (err) {
              return callback(err);
            }
            if (!_parent) {
              return callback(new Error('parent not found'));
            }
            parent = _parent;
            if (options.permissions !== false) {
              if (!parent._publish) {
                return callback(new Error('cannot publish parent'));
              }
            }
            return callback(null);
          });
        },
        determineNextRank: function(callback) {
          return self.apos.docs.db.findWithProjection({
            path: self.matchDescendants(parent),
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
        beforeInsert: function(callback) {
          return self.beforeInsert(req, page, options, callback);
        },
        beforeSave: function(callback) {
          return self.beforeSave(req, page, options, callback);
        },
        insert: function(callback) {
          var slugBasename = require('path').basename(self.apos.utils.slugify(page.slug, { allow: '/' }));
          var pathFrom;
          if (slugBasename.length && (slugBasename !== 'none')) {
            pathFrom = slugBasename;
          } else {
            pathFrom = self.apos.utils.slugify(page.title);
          }
          page.path = addSlashIfNeeded(parent.path) + pathFrom;
          page.level = parent.level + 1;
          return self.apos.docs.insert(req, page, options, callback);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, page);
      });
    }
  };

  // Takes a function, `fn`, which expects a callback and performs
  // some operation on the page tree. Returns a new function that
  // does exactly the same thing, but obtains a lock first and
  // releases it afterwards.
  //
  // Nested locks for the same `req` are permitted, in order to allow
  // inserts or moves that are triggered by `afterMove`, `beforeInsert`, etc.
  //
  // If fn passes a second argument to its callback, that argument
  // is passed on.

  self.withLock = function(req, fn) {
    return function(callback) {
      return self.lock(req, function(err) {
        if (err) {
          return callback(err);
        }
        return fn(function(err, result) {
          // Regardless of err we must release the lock
          return self.unlock(req, function(lockErr) {
            return callback(err || lockErr, result);
          });
        });
      });
    };
  };

  // Lock the page tree.
  //
  // The lock must be released by calling the `unlock` method.
  // It is usually best to use the `withLock` method instead, to
  // invoke a function of your own while the lock is in your
  // possession, so you don't have to keep track of it.
  //
  // Nested locks are permitted for the same `req`.

  self.lock = function(req, callback) {
    if (req.aposPageTreeLockDepth) {
      req.aposPageTreeLockDepth++;
      return callback(null);
    }
    return self.apos.locks.lock('apostrophe-pages:tree', function(err) {
      if (!err) {
        req.aposPageTreeLockDepth = 1;
      }
      return callback(err);
    });
  };

  // Release a page tree lock obtained with the `lock` method.
  // Note that it is safest to use the `withLock` method to avoid
  // the bookkeeping of calling either `lock` or `unlock` yourself.

  self.unlock = function(req, callback) {
    if (!req.aposPageTreeLockDepth) {
      return callback(new Error('Looks like you called apos.pages.unlock without ever calling apos.pages.lock, or you have more unlock calls than lock calls'));
    }
    req.aposPageTreeLockDepth--;
    if (req.aposPageTreeLockDepth) {
      return callback(null);
    }
    return self.apos.locks.unlock('apostrophe-pages:tree', callback);
  };

  // This method pushes a page's permissions to its subpages selectively based on
  // whether the applyToSubpages action was selected. It also copies
  // the `loginRequired` property to subpages in that situation.
  //
  // Both additions and deletions from the permissions list can be propagated
  // in this way.
  //
  // This requires some tricky mongo work to do it efficiently, especially since we
  // need to update both the join ids and the denormalized docPermissions array.
  //
  // The applyToSubpages choice is actually a one-time action, not a permanently
  // remembered setting, so the setting itself is cleared afterwards by this
  // method.
  //
  // If 'appendPermissionsToSubpages' option is selected then the new set of
  // permissions is appended to the existing subpage\'s permissions instead of completly overriding them.
  // Thus preserving any special permissions given to a subfolder or a subpage, while
  // adding the new ones to them. Like 'applytoSubpages' choice, 'appendPermissionsToSubpages'
  // is also a one-time action, so the setting itself is cleared afterwards by this method.
  //
  // This method is called for us by the apostrophe-docs module on update
  // operations, so we first make sure it's a page. We also make sure it's
  // not a new page (no kids to propagate anything to).

  self.docAfterDenormalizePermissions = function(req, page, options, callback) {

    if (!self.isPage(page)) {
      return setImmediate(callback);
    }
    if (!page._id) {
      return setImmediate(callback);
    }

    var admin = req.user && req.user._permissions.admin;

    var allowed = [ 'view' ];
    if (admin) {
      allowed.push('edit');
    }

    var propagateSet = {};
    var loginRequired = page.loginRequired;
    var appendPermissionsToSubpages = page.appendPermissionsToSubpages;

    if (!page.applyToSubpages) {
      return setImmediate(callback);
    }

    // It's a one-time action, don't remember it
    page.applyToSubpages = false;
    page.appendPermissionsToSubpages = '';
    propagateSet.docPermissions = page.docPermissions;
    _.each(allowed, function(prefix) {
      var fields = [ prefix + 'GroupsIds', prefix + 'UsersIds' ];
      _.each(fields, function(field) {
        if (appendPermissionsToSubpages === 'append') {
          propagateSet[field] = {
            $each: page[field]
          };
        } else {
          propagateSet[field] = page[field];
        }
      });
    });

    var criteria = {
      $and: [
        {
          path: self.matchDescendants(page)
        },
        self.apos.permissions.criteria(req, 'edit-' + page.type)
      ]
    };

    var changeSet;
    if (appendPermissionsToSubpages === 'append') {
      changeSet = {
        $addToSet: propagateSet,
        $set: {
          loginRequired: loginRequired
        }
      };
    } else {
      propagateSet.loginRequired = loginRequired;
      changeSet = {
        $set: propagateSet
      };
    }

    return self.apos.docs.db.update(criteria, changeSet, { multi: true }, callback);

  };

  // This method creates a new object suitable to be inserted
  // as a child of the specified parent via insert(). It DOES NOT
  // insert it at this time. If the parent page is locked down
  // such that no child page types are permitted, this method
  // returns null. The permissions of the new child page match
  // the permissions of the parent.

  self.newChild = function(parentPage, type) {
    var pageType = _.find(self.allowedChildTypes(parentPage), function(childType) {
      return (type || self.typeChoices[0].name) === childType;
    });
    if (!pageType) {
      self.apos.utils.warn('No allowed Page types are specified.');
      return null;
    }
    var page = self.apos.docs.getManager(pageType).newInstance();
    _.extend(page, {
      title: 'New Page',
      slug: self.apos.utils.addSlashIfNeeded(parentPage.slug) + 'new-page',
      type: pageType,
      published: parentPage.published
    });
    // Inherit permissions from parent page
    _.assign(page,
      _.pick(parentPage,
        'loginRequired',
        'viewUsersIds',
        'viewGroupsIds',
        'editUsersIds',
        'editGroupsIds',
        'docPermissions'
      )
    );
    if (!page.published) {
      page.published = false;
    }
    return page;
  };

  // Return an array of child page type names permitted
  // given the specified parent page. If page is null,
  // allowable type names for the home page are returned.

  self.allowedChildTypes = function(page) {
    if ((!page) && (self.options.allowedHomepageTypes)) {
      return self.options.allowedHomepageTypes;
    } else if (page && self.options.allowedSubpageTypes) {
      if (self.options.allowedSubpageTypes[page.type]) {
        return self.options.allowedSubpageTypes[page.type];
      }
    }
    // Default is to allow any type in the configured list
    return _.pluck(self.typeChoices, 'name');
  };

  // Return true if the given type name is allowable for a child
  // of the given page. If page is null, this method returns true
  // if the given type name is allowable for the home page.

  self.isAllowedChildType = function(page, type) {
    return _.includes(self.allowedChildTypes(page), type);
  };

  // Move a page already in the page tree to another location.
  //
  // position can be 'before', 'after' or 'inside' and
  // determines the moved page's new relationship to
  // the target page.
  //
  // The callback receives an error and, if there is no
  // error, also an array of objects with _id and slug
  // properties, indicating the new slugs of all
  // modified pages.
  //
  // *Less commonly used features*
  //
  // These are mainly for use by modules that extend Apostrophe's model layer,
  // such as `apostrophe-workflow`.
  //
  // The `options` argument may be omitted entirely.
  //
  // If `options.criteria` is present, it is merged with
  // all MongoDB criteria used to read and write the database in `self.move`.
  // If `options.filters` is present, those filters are invoked
  // on any Apostrophe cursor find() calls used to read and write the database in `self.move`.
  //
  // In addition, `options` is passed back to the callback as a third argument,
  // which is useful to detect recursive scenarios that come up in the
  // workflow module.
  //
  // `options` is also passed back to the `movePermissions` method,
  // and passed as the `options` property of the `info` parameter of `afterMove`.
  //
  // After the moved and target pages are fetched, the `beforeMove` method is invoked with
  // `req, moved, target, position, options` and an optional callback.
  //
  // `beforeMove` may safely modify top-level properties of `options` without an impact
  // beyond the exit of the current `self.move` call. If modifying deeper properties, clone them.
  //
  // If `callback` is omitted, returns a promise.

  self.move = function(req, movedId, targetId, position, options, callback) {
    if (typeof (arguments[4]) !== 'object') {
      callback = options;
      options = {};
    } else {
      options = _.clone(options);
    }

    var bodyWithLock = self.withLock(req, body);
    if (callback) {
      return bodyWithLock(callback);
    } else {
      return Promise.promisify(bodyWithLock)();
    }

    function body(callback) {
      var moved;
      var target;
      var parent;
      var oldParent;
      var changed = [];
      var rank;
      var originalPath;
      var originalSlug;
      return async.series([ getMoved, getTarget, beforeMove, determineRankAndNewParent, permissions, nudgeNewPeers, moveSelf, updateDescendants, trashDescendants, afterMoved ], finish);
      function getMoved(callback) {
        return self.find(req, mergeCriteria({ _id: movedId }))
          .permission(false)
          .trash(null)
          .published(null)
          .areas(false)
          .ancestors(_.assign({ depth: 1, trash: null, published: null, areas: false, permission: false }, options.filters || {}))
          .applyFilters(options.filters || {})
          .toObject(function(err, page) {
            if (err) {
              return callback(err);
            }
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
            // You can't move the trashcan itself
            if (moved.type === 'trash') {
              return callback(new Error('cannot move trashcan'));
            }
            oldParent = page._ancestors[0];
            return callback(null);
          }
          );
      }
      function getTarget(callback) {
        return self.find(req, mergeCriteria({ _id: targetId }))
          .permission(false)
          .trash(null)
          .published(null)
          .areas(false)
          .ancestors(_.assign({ depth: 1, trash: null, published: null, areas: false, permission: false }, options.filters || {}))
          .applyFilters(options.filters || {})
          .toObject(function(err, page) {
            if (err) {
              return callback(err);
            }
            if (!page) {
              return callback(new Error('no such page'));
            }
            target = page;
            if ((target.type === 'trash') && (target.level === 1) && (position === 'after')) {
              return callback(new Error('trash must be last'));
            }
            return callback(null);
          }
          );
      }
      function beforeMove(callback) {
        return self.beforeMove(
          req,
          moved,
          target,
          position,
          options,
          callback
        );
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
        return self.movePermissions(req, moved, {
          oldParent: oldParent,
          parent: parent
        }, options, callback);
      }
      function nudgeNewPeers(callback) {
        // Nudge down the pages that should now follow us
        // Always remember multi: true
        self.apos.docs.db.update(mergeCriteria({ path: self.matchDescendants(parent), level: parent.level + 1, rank: { $gte: rank } }), { $inc: { rank: 1 } }, { multi: true }, function(err, count) {
          return callback(err);
        });
      }
      function moveSelf(callback) {
        originalPath = moved.path;
        originalSlug = moved.slug;
        var level = parent.level + 1;
        var newPath = addSlashIfNeeded(parent.path) + path.basename(moved.path);
        // We're going to use update with $set, but we also want to update
        // the object so that moveDescendants can see what we did
        moved.path = newPath;
        // If the old slug wasn't customized, OR our new parent is
        // in the trash, update the slug as well as the path
        if (parent._id !== oldParent._id) {
          var matchOldParentSlugPrefix = new RegExp('^' + self.apos.utils.regExpQuote(addSlashIfNeeded(oldParent.slug)));
          if (moved.slug.match(matchOldParentSlugPrefix)) {
            var slugStem = parent.slug;
            if (slugStem !== '/') {
              slugStem += '/';
            }
            moved.slug = moved.slug.replace(matchOldParentSlugPrefix, addSlashIfNeeded(parent.slug));
            changed.push({
              _id: moved._id,
              slug: moved.slug
            });
          } else if (parent.trash && (!moved.trash)) {
            // #385: we don't follow the pattern of our old parent but we're
            // moving to the trash, so the slug must change to avoid blocking
            // reuse of the old URL by a new page
            moved.slug = parent.slug + '/' + path.basename(moved.slug);
          }
        }
        moved.level = level;
        moved.rank = rank;
        // Are we in the trashcan? Our new parent reveals that,
        // but only if trash is a place in the tree rather than a
        // simple schema field
        if (!self.apos.docs.trashInSchema) {
          if (parent.trash) {
            moved.trash = true;
          } else {
            delete moved.trash;
          }
        }
        return self.update(req, moved, callback);
      }
      function updateDescendants(callback) {
        if (self.updateDescendantsAfterMove.length >= 6) {
          return self.updateDescendantsAfterMove(req, moved, originalPath, originalSlug, options, function(err, _changed) {
            if (err) {
              return callback(err);
            }
            changed = changed.concat(_changed);
            return callback(null);
          });
        } else {
          // Support old overrides with only 5 arguments for bc
          return self.updateDescendantsAfterMove(req, moved, originalPath, originalSlug, function(err, _changed) {
            if (err) {
              return callback(err);
            }
            changed = changed.concat(_changed);
            return callback(null);
          });
        }
      }
      function trashDescendants(callback) {
        if (self.apos.docs.trashInSchema) {
          return callback(null);
        }
        // The trash can is a place in the tree, so
        // make sure our descendants have the same trash status
        var matchParentPathPrefix = self.matchDescendants(moved);
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
        return self.apos.docs.db.update(mergeCriteria({ path: matchParentPathPrefix }), action, { multi: true }, callback);
      }
      function afterMoved(callback) {
        return self.afterMove(
          req,
          moved,
          {
            originalSlug: originalSlug,
            originalPath: originalPath,
            changed: changed,
            target: target,
            position: position,
            options: options
          },
          callback
        );
      }

      function finish(err) {
        if (err) {
          return callback(err, null, options);
        }
        return callback(null, changed, options);
      }

      function mergeCriteria(criteria) {
        if (options.criteria) {
          criteria = { $and: [ criteria, options.criteria ] };
        }
        return criteria;
      }
    }
  };

  // Based on `req`, `moved`, `data.moved`, `data.oldParent` and `data.parent`, decide whether
  // this move should be permitted. If it should not be, throw an error.
  // This is invoked with `callAll`, so other methods may implement it and
  // may optionally take a callback as a second argument, in which case errors
  // should be passed to the callback rather than thrown.
  //
  // `options` is the same options object that was passed to `self.move`, or an empty object
  // if none was passed.

  self.movePermissions = function(req, moved, data, options, callback) {
    if (!moved._publish) {
      return callback('forbidden');
    }
    if (!(data.parent && data.oldParent)) {
      // Move outside tree
      return callback('forbidden');
    }
    // You can always move a page into the trash. You can
    // also change the order of subpages if you can
    // edit the subpage you're moving. Otherwise you
    // must have edit permissions for the new parent page.
    if ((data.oldParent._id !== data.parent._id) && (data.parent.type !== 'trash') && (!data.parent._edit)) {
      return callback('forbidden');
    }
    return callback(null);
  };

  // Override this method to alter the `options` object before
  // the `move` method carries out a move in the page tree

  self.beforeMove = function(req, moved, target, position, options, callback) {
    return callback(null);
  };

  // Invoked after a page is moved. Override to carry out
  // aditional actions

  self.afterMove = function(req, moved, info, callback) {
    return callback(null);
  };

  // Accepts `req`, `_id` and `callback`.
  //
  // Delivers `err`, `parentSlug` (the slug of the page's
  // former parent), and `changed` (an array of objects with
  // _id and slug properties, including all subpages that
  // had to move too). If the `trashInSchema: true` option was
  // set for the module, `parentSlug` is still provided
  // although the parent does not change, and `changed` is
  // still provided although the slugs of the descendants
  // do not change.

  self.moveToTrash = function(req, _id, callback) {
    if (self.apos.docs.trashInSchema) {
      return self.trashInSchema(req, _id, true, callback);
    } else {
      self.moveToSharedTrash(req, _id, callback);
    }
  };

  // "Move" a page to the trash by just setting its trash flag
  // and keeping it under the same parent. Called by `moveToTrash`
  // when the `trashInSchema` flag is in effect. The home page
  // still cannot be moved to the trash even in this mode.
  // Trashes descendant pages as well.
  //
  // See `moveToTrash` for what the callback receives.

  self.trashInSchema = function(req, _id, toTrash, callback) {
    var page, parent;
    var tree = [];
    var action = toTrash ? { $set: { trash: true } } : { $unset: { trash: 1 } };

    return async.series(
      [
        function getPage(cb) {
        // check permissions and load page to trash/untrash
          return self.find(req, { _id: _id }).permission('edit').trash(null).ancestors({ depth: 1, published: null, trash: null, areas: false }).toObject((err, _page) => {
            page = _page;
            tree.push(page);
            parent = page._ancestors[0];
            if (!page) {
              return cb('Page not found');
            }
            if (!parent) {
              return cb('Cannot move the home page to or from the trash');
            }
            return cb(err);
          });
        },

        // get all children of page
        function getChildren(cb) {
          const path = self.matchDescendants(page);
          return self.find(req, { path: path })
            .permission(false)
            .published(null)
            .trash(null)
            .areas(false)
            .sort({ path: 1 })
            .toArray(function(err, res) {
              if (!err) {
                tree = tree.concat(res);
              }
              return cb(err, res);
            });
        },

        // flag pages appropiately as trash or not
        function trashOrUntrashPages(cb) {
          const ids = tree.map(p => p._id);
          return self.apos.docs.db.update({ _id: { $in: ids } }, action, {
            multi: true
          }, (err, res) => {
            cb(err);
          });
        },

        // iterate over pages tree and deduplicate requisite fields
        function dedupePages(cb) {
          return self.deduplicatePages(req, tree, toTrash, cb);
        },

        function retrieveUpdated(cb) {
          return self.find(req, { _id: { $in: tree.map(p => p._id) } })
            .permission(false)
            .published(null)
            .trash(null)
            .areas(false)
            .sort({ path: 1 })
            .toArray(function(err, res) {
              if (!err) {
                tree = res;
              }
              return cb(err, res);
            });
        }

      ], err => {
        return callback(err, parent && parent.slug, tree);
      });
  };

  self.deduplicatePages = function(req, pages, toTrash, callback) {
    return async.eachSeries(pages, function(page, callback) {
      var match = self.matchDescendants(page);
      var oldPath = page.path;
      var oldSlug = page.slug;
      return async.series([
        deduplicate,
        propagate
      ], callback);
      function deduplicate(callback) {
        if (toTrash) {
          return self.apos.docs.getManager(page.type).deduplicateTrash(req, page, callback);
        } else {
          return self.apos.docs.getManager(page.type).deduplicateRescue(req, page, callback);
        }
      }
      function propagate(callback) {
        // This operation can change paths and slugs of pages, those changes need
        // rippling to their descendants
        var descendants = _.filter(pages, function(descendant) {
          return descendant.path.match(match);
        });
        return async.eachSeries(descendants, function(descendant, callback) {
          descendant.path = descendant.path.replace(new RegExp('^' + self.apos.utils.regExpQuote(oldPath)), page.path);
          descendant.slug = descendant.slug.replace(new RegExp('^' + self.apos.utils.regExpQuote(oldSlug)), page.slug);
          return self.apos.docs.db.update({ _id: descendant._id }, {
            $set: {
              path: descendant.path,
              slug: descendant.slug
            }
          }, function(err) {
            if (self.apos.docs.isUniqueError(err)) {
              // The slug is now in conflict for this subpage.
              // Try again with path only
              return self.apos.docs.db.update({ _id: descendant._id }, {
                $set: {
                  path: descendant.path
                }
              }, callback);
            }
            return callback(err);
          });
        }, callback);
      }
    }, callback);
  };

  // Rescue a page previously trashed via `trashInSchema`. This is an operation that only
  // makes sense when the `trashInSchema` option flag is set for the module.
  // Rescues descendants as well. Invokes its callback with `(null, parentSlug, changed)`,
  // where:
  //
  // `parentSlug` is the slug of the parent of the page rescued, for consistency
  // with the `moveToTrash` method, although the parent does not change;
  //
  // `changed` is an array of descendant pages whose trash status also changed,
  // with `_id` and `slug` properties.

  self.rescueInTree = function(req, _id, callback) {
    return self.trashInSchema(req, _id, false, callback);
  };

  // Implements `moveToTrash` when `trashInSchema` is false (the default),
  // by moving the page inside the trashcan page. See `moveToTrash`
  // for what the callback receives.

  self.moveToSharedTrash = function(req, _id, callback) {
    var trash;
    var page;
    var parent;
    var changed = [];

    return async.series([findTrash, findPage, movePage], function(err) {
      return callback(err, parent && parent.slug, changed);
    });

    function findTrash(callback) {
      // Always only one trash page at level 1, so we don't have
      // to hardcode the slug
      return self.find(req, { trash: true, level: 1 })
        .permission(false)
        .published(null)
        .trash(null)
        .areas(false)
        .toObject(function(err, _trash) {
          if (err || (!_trash)) {
            return callback('Site has no trashcan, contact administrator');
          }
          trash = _trash;
          return callback(null);
        });
    }

    function findPage(callback) {
      // Also checks permissions
      return self.find(req, { _id: _id }).permission('edit').ancestors({ depth: 1, published: null, trash: null, areas: false }).toObject(function(err, _page) {
        if (err || (!_page)) {
          return callback('Page not found');
        }
        page = _page;
        parent = page._ancestors[0];
        if (!page._ancestors[0]) {
          return callback('Cannot move the home page to the trash');
        }
        return callback(null);
      });
    }

    function movePage(callback) {
      return self.move(req, page._id, trash._id, 'inside', function(err, changedArg) {
        if (err) {
          return callback(err);
        }
        changed = changedArg;
        return callback(null);
      });
    }
  };

  // Empty the trash (destroy a page in the trash permanently).
  //
  // Currently you must specify the _id of a single
  // page, however if it has descendants they are also destroyed.
  //
  // If the page does not exist or is not in the trash an error is reported.
  //
  // Delivers (err, parentSlug) to the callback.

  self.deleteFromTrash = function(req, _id, callback) {

    var page;
    var parent;

    return async.series([ findPage, deleteFromTrash ], function(err) {
      return callback(err, parent && parent.slug);
    });

    function findPage(callback) {
      // Also checks permissions
      return self.find(req, { _id: _id }).permission('publish').trash(true).ancestors({ depth: 1, published: null, trash: null, areas: false }).toObject(function(err, _page) {
        if (err || (!_page)) {
          return callback('Page not found');
        }
        page = _page;
        parent = page._ancestors[0];
        if (!page._ancestors[0]) {
          return callback('Cannot destroy the home page');
        }
        return callback(null);
      });
    }

    function deleteFromTrash(callback) {
      return self.apos.docs.deleteFromTrash(req,
        {
          $or: [
            {
              path: self.matchDescendants(page)
            },
            {
              _id: _id
            }
          ]
        },
        callback
      );
    }
  };

  // Update a page. The `options` argument may be omitted entirely.
  // if it is present and `options.permissions` is set to `false`,
  // permissions are not checked.

  self.update = function(req, page, options, callback) {
    if (page.level === 0) {
      // You cannot move the home page to the trash
      page.trash = false;
    }
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }
    return async.series({
      beforeUpdate: function(callback) {
        return self.beforeUpdate(req, page, options, callback);
      },
      beforeSave: function(callback) {
        return self.beforeSave(req, page, options, callback);
      },
      update: function(callback) {
        return self.apos.docs.update(req, page, options, callback);
      }
    }, callback);
  };

  // Ensure the existence of a page or array of pages and
  // lock them in place in the page tree.
  //
  // The `slug` property must be set. The `parent`
  // property may be set to the slug of the intended
  // parent page, which must also be parked. If you
  // do not set `parent`, the page is assumed to be a
  // child of the home page, which is always parked.

  // See also the `park` option; typically invoked via
  // that option when configuring the module.

  self.park = function(pageOrPages) {
    var pages;
    pages = Array.isArray(pageOrPages) ? pageOrPages : [ pageOrPages ];
    self.parked = self.parked.concat(pages);
  };

  // Route that serves pages. See afterInit in
  // index.js for the wildcard argument and the app.get call

  self.serve = function(req, res) {

    req.deferWidgetLoading = true;

    return async.eachSeries(
      [
        self.serveGetPage,
        // self.serveSecondChanceLogin,
        self.serveLoaders,
        self.serveNotFound
      ],
      function(fn, callback) {
        return fn(req, callback);
      },
      function(err) {
        return self.serveDeliver(req, err);
      }
    );
  };

  self.serveGetPage = function(req, callback) {
    // Get content for this page
    req.slug = req.params[0];

    // Fix common screwups in URLs: leading/trailing whitespace,
    // presence of trailing slashes (but always restore the
    // leading slash). Express leaves escape codes uninterpreted
    // in the path, so look for %20, not ' '.
    req.slug = req.slug.trim();

    req.slug = self.removeTrailingSlugSlashes(req, req.slug);

    // Prevent open redirect attacks based on escaped paths
    // (stomp double slashes)
    req.slug = req.slug.replace(/\/+/g, '/');

    if ((!req.slug.length) || (req.slug.charAt(0) !== '/')) {
      req.slug = '/' + req.slug;
    }

    // Had to change the URL, so redirect to it. TODO: this
    // contains an assumption that we are mounted at /
    if (req.slug !== req.params[0]) {
      return req.res.redirect(req.slug);
    }

    var filters = self.getServePageFilters();

    var cursor = self.find(req);

    _.each(filters, function(val, key) {
      cursor[key](val);
    });

    self.matchPageAndPrefixes(cursor, req.slug);

    return async.series({
      cursor: function(callback) {
        return self.callAllAndEmit('pageServeCursor', 'serveCursor', cursor, callback);
      },
      fetch: function(callback) {
        return cursor.toObject(function(err, _page) {
          if (err) {
            return callback(err);
          }
          req.data.bestPage = _page;
          return callback(null);
        });
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      self.evaluatePageMatch(req);
      return callback(null);
    });
  };

  // Remove trailing slashes from a slug. This is factored out
  // so that it can be overridden, for instance by the
  // apostrophe-workflow module.

  self.removeTrailingSlugSlashes = function(req, slug) {
    if (!slug) {
      // For bc, support one argument
      slug = req;
    }
    return slug.replace(/\/+$/, '');
  };

  self.serveLoaders = function(req, callback) {
    return self.callAllAndEmit('pageServe', 'serve', req, callback);
  };

  self.serveNotFound = function(req, callback) {
    if (self.isFound(req)) {
      // found
      return setImmediate(callback);
    }
    // Give all modules a chance to save the day
    return self.callAllAndEmit('pageNotFound', 'notFound', req, function(err) {
      if (err) {
        return callback(err);
      }
      // Are we happy now?
      if (self.isFound(req)) {
        return callback(null);
      }
      req.data.suggestedSearch = self.apos.utils.slugify(req.url, { separator: ' ' });
      req.notFound = true;
      req.res.statusCode = 404;
      req.template = 'notFound';
      // Give the browser a chance to do something interesting with a 404.
      // This is often a better idea than doing a heavy fallback search
      // server side, because those are triggered heavily by bots
      req.browserCall("apos.emit('notfound', ?)", {
        suggestedSearch: req.data.suggestedSearch,
        url: req.url
      });
      return callback(null);
    });
  };

  self.serveDeliver = function(req, err) {

    var providePage = true;

    // A2 treats req as a notepad of things we'd
    // like to happen in res; that allows various
    // pageServe methods to override each other.
    // Now we're finally ready to enact those
    // things on res

    if (req.contentType) {
      req.res.setHeader('Content-Type', req.contentType);
    }

    if (req.redirect) {
      return req.res.redirect(req.redirect);
    }

    // Handle 500 errors

    if (err) {
      self.apos.utils.error(err);
      req.template = self.apos.templates.renderer('templateError');
      req.statusCode = 500;
      providePage = false;
    }

    if (req.statusCode) {
      req.res.statusCode = req.statusCode;
    }

    if (req.notFound) {
      // pages.serveNotFound already
      // did the heavy lifting here
      providePage = false;
    }

    // Special cases for "you must log in to access that"
    // and "you are logged in, but not cool enough to
    // see that"

    if (req.loginRequired) {
      req.template = 'loginRequired';
      providePage = false;
    } else if (req.insufficient) {
      req.template = 'insufficient';
      providePage = false;
    }

    if (!req.template) {
      if (req.data.page) {
        // Fallback behavior is to
        // serve page templates out of
        // apostrophe-pages/views/pages
        req.template = 'pages/' + req.data.page.type;
      }
    }

    var args = {
      edit: providePage ? req.data.bestPage._edit : null,
      slug: providePage ? req.data.bestPage.slug : null,
      page: providePage ? req.data.bestPage : null,
      contextMenu: req.contextMenu,
      publishMenu: req.publishMenu
    };

    if (args.page && args.edit) {
      if (!args.contextMenu) {
        // Standard context menu for a regular page
        args.contextMenu = self.options.contextMenu;
      }
      if (!args.publishMenu) {
        // Standard publish menu for a regular page
        args.publishMenu = self.options.publishMenu;
      }
    }

    if (args.page) {
      if (!self.allowedChildTypes(args.page).length) {
        // Snip out add page if no
        // child page types are allowed
        args.contextMenu = _.filter(args.contextMenu, function(item) {
          return item.action !== 'insert-page';
        });
      }
    }

    if (args.contextMenu) {
      // Allow context menu items to require a particular permission
      args.contextMenu = _.filter(args.contextMenu, function(item) {
        if (!item.permission) {
          return true;
        }
        if (self.apos.permissions.can(req, item.permission)) {
          return true;
        }
      });
    }

    // Merge data that other modules has asked us to
    // make available to the template
    _.extend(args, req.data);

    // A simple way to access everything we know about
    // the page in JSON format. Allow this only if we
    // have editing privileges on the page

    if ((req.query.pageInformation === 'json') && args.page && (args.page._edit)) {
      return req.res.send(args.page);
    }

    return self.sendPage(req, req.template, args);

  };

  // This method invokes `pushCreateSingleton` to create the `apostrophe-pages`
  // browser-side object with information about the current page, and also
  // sets `req.data.home`. It is called automatically every
  // time `self.sendPage` is called in any module, which includes normal CMS pages,
  // 404 pages, the login page, etc.
  //
  // This allows non-CMS pages like `/login` to "see" `data.home` and `data.home._children`
  // in their templates.
  //
  // For performance, if req.data.page is already set and it contains a
  // `req.data._ancestors[0]._children` property, that information
  // is leveraged to avoid redundant queries. If not, a query is made.
  //
  // For consistency, the home page is always retrieved using the same filters that
  // are configured for `ancestors`. Normally that includes children of each
  // ancestor. If that is explicitly reconfigured without the `children` option,
  // you will not get `data.home._children`.

  self.pageBeforeSend = function(req, callback) {

    if (req.user) {
      self.pushCreateSingleton(req);
    }

    // Did something else already set it?
    if (req.data.home) {
      return setImmediate(callback);
    }

    // Was this explicitly disabled?
    if (self.options.home === false) {
      return setImmediate(callback);
    }

    // Add level as a data attribute on the body tag
    // The admin bar usses this to stay open if configured by the user
    if (typeof _.get(req, 'data.page.level') === 'number') {
      self.apos.templates.addBodyDataAttribute(req,
        {
          'apos-level': req.data.page.level
        }
      );
    }

    // Avoid redundant work when ancestors are available. They won't be if they are
    // not enabled OR we're not on a regular CMS page at the moment
    if (req.data.page && req.data.page._ancestors && req.data.page._ancestors[0]) {
      req.data.home = req.data.page._ancestors[0];
      return setImmediate(callback);
    }

    // Fetch the home page with the same filters used to fetch ancestors, for consistency.
    // If filters for ancestors are not configured, then by default we still fetch the children of the
    // home page, so that tabs are easy to implement. However allow this to be
    // expressly shut off:
    //
    // home: { children: false }

    var filters = self.getServePageFilters().ancestors || {
      children: !((self.options.home && (self.options.home.children === false)))
    };

    var cursor = self.find(req, { level: 0 }).ancestorPerformanceRestrictions();

    _.each(filters, function(val, key) {
      cursor[key](val);
    });

    return cursor.toObject(function(err, home) {
      if (err) {
        return callback(err);
      }
      // These properties are defaults, they shouldn't clobber
      // existing values if someone is keen to use those
      // property names
      req.data.home = home;
      return callback(null);
    });

  };

  // A request is "found" if it should not be
  // treated as a "404 not found" situation

  self.isFound = function(req) {
    var found = req.loginRequired || req.insufficient || req.redirect || (req.data.page && (!req.notFound));
    return found;
  };

  self.getServePageFilters = function() {
    return self.options.filters || {
      // Get the kids of the ancestors too so we can do tabs and accordion nav
      ancestors: {
        children: true
      },
      // Get our own kids
      children: true
    };
  };

  self.matchPageAndPrefixes = function(cursor, slug) {
    var slugs = [];
    var components;
    // Partial matches. Avoid an unnecessary OR of '/' and '/' for the
    // homepage by checking that slug.length > 1
    if (slug.length && (slug.substr(0, 1) === '/') && (slug.length > 1)) {
      var path = '';
      // homepage is always interesting
      slugs.unshift('/');
      components = slug.substr(1).split('/');
      for (var i = 0; (i < (components.length - 1)); i++) {
        var component = components[i];
        path = addSlashIfNeeded(path) + component;
        slugs.unshift(path);
      }
    }
    // And of course always consider an exact match. We use unshift to
    // put the exact match first in the query, but we still need to use
    // sort() and limit() to guarantee that the best result wins
    slugs.unshift(slug);

    cursor.sort({ slug: -1 });

    cursor.and({ slug: { $in: slugs } });
  };

  self.evaluatePageMatch = function(req) {

    var slug = req.params[0];

    if (!req.data.bestPage) {
      return;
    }

    if (req.data.bestPage.slug === slug) {
      req.data.page = req.data.bestPage;
    }

    var remainder = slug.substr(req.data.bestPage.slug.length);
    // Strip trailing slashes for consistent results
    remainder = remainder.replace(/\/+$/, '');
    // For consistency, guarantee a leading / if there is not one
    // already. This way parsing remainders attached to the home
    // page (the slug of which is '/') is not a special case
    if (remainder.charAt(0) !== '/') {
      remainder = '/' + remainder;
    }

    req.remainder = remainder;
  };

  self.ensureIndexes = function(callback) {
    return async.series([ self.ensurePathIndex, self.ensureLevelRankIndex ], callback);
  };

  self.ensurePathIndex = function(callback) {
    var params = self.getPathIndexParams();
    return self.apos.docs.db.ensureIndex(params, { unique: true, sparse: true }, callback);
  };

  self.getPathIndexParams = function() {
    return {
      path: 1
    };
  };

  self.ensureLevelRankIndex = function(callback) {
    var params = self.getLevelRankIndexParams();
    return self.apos.docs.db.ensureIndex(params, {}, callback);
  };

  self.getLevelRankIndexParams = function() {
    return {
      level: 1,
      rank: 1
    };
  };

  // A limited subset of page properties is pushed to
  // browser-side JavaScript. If you want more you
  // should make your own req.browserCalls or override
  // this method. Don't push gigantic joins if you don't
  // want slow pages

  self.pruneCurrentPageForBrowser = function(page) {

    page = _.pick(page, 'title', 'slug', '_id', 'type', 'ancestors', '_url');

    // Limit information about ancestors to avoid
    // excessive amounts of data in the page
    page.ancestors = _.map(page.ancestors, function(ancestor) {
      return _.pick(ancestor, [ 'title', 'slug', '_id', 'type', 'published', '_url' ]);
    });

    return page;

  };

  // Invoked via callForAll in the docs module

  self.docFixUniqueError = function(req, doc) {
    if (doc.path) {
      var num = (Math.floor(Math.random() * 10)).toString();
      doc.path += num;
    }
  };

  // Update the paths and slugs of descendant pages,
  // changing slugs only if they were
  // compatible with the original slug. Also update
  // the level of descendants.
  //
  // On success, invokes callback with
  // null and an array of objects with _id and slug properties, indicating
  // the new slugs for any objects that were modified.

  self.updateDescendantsAfterMove = function(req, page, originalPath, originalSlug, options, callback) {
    if (arguments.length === 5) {
      // bc with outdated overrides of code that calls this
      callback = options;
      options = {};
    }
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
    var cursor = self.apos.docs.db.findWithProjection(mergeCriteria({ path: matchParentPathPrefix }), { slug: 1, path: 1, level: 1 });
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
        if (page.trash && (!desc.trash)) {
          // #385: we are moving this to the trash, force a new slug
          // even if it was formerly a customized one. Otherwise it is
          // difficult to free up custom slugs by trashing pages
          if (newSlug === desc.slug) {
            newSlug = page.slug + '/' + path.basename(desc.slug);
          }
        }
        changed.push({
          _id: desc._id,
          slug: newSlug
        });

        // Allow for the possibility that the slug becomes
        // a duplicate of something already nested under
        // the new parent at this point

        desc.path = desc.path.replace(matchParentPathPrefix, page.path + '/');
        desc.slug = newSlug;
        desc.level = desc.level + (page.level - oldLevel);
        return self.apos.docs.retryUntilUnique(req, desc, updateDescendant, callback);

        function updateDescendant(callback) {
          return self.apos.docs.db.update(mergeCriteria({ _id: desc._id }), {
            $set: _.pick(desc, 'path', 'slug', 'level')
          }, callback);
        }

      });
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, changed);
    });
    function mergeCriteria(criteria) {
      if (options.criteria) {
        criteria = { $and: [ criteria, options.criteria ] };
      }
      return criteria;
    }
  };

  self.parked = (self.options.minimumPark || [
    {
      slug: '/',
      parkedId: 'home',
      published: true,
      _defaults: {
        title: 'Home',
        type: 'home'
      },
      _children: [
        {
          slug: '/trash',
          parkedId: 'trash',
          type: 'trash',
          trash: true,
          published: false,
          orphan: true,
          _defaults: {
            title: 'Trash'
          }
        }
      ]
    }
  ]).concat(self.options.park || []);

  self.manageOrphans = function(callback) {
    var managed = self.apos.docs.getManaged();
    var distinct;
    var undefinedItem = false;
    return async.series([ findUndefined, patchUndefined, find, manage ], callback);
    function findUndefined(callback) {
      return self.apos.docs.db.findOne({ type: { $exists: 0 } }, function(err, _undefinedItem) {
        if (err) {
          return callback(err);
        }
        undefinedItem = _undefinedItem;
        return callback(null);
      });
    }
    function patchUndefined(callback) {
      if (!undefinedItem) {
        return callback(null);
      }
      return self.apos.docs.db.update({
        type: { $exists: 0 }
      }, {
        $set: {
          type: 'WASUNDEFINED'
        }
      }, {
        multi: true
      }, callback);
    }
    function find(callback) {
      return self.apos.docs.db.distinct('type', function(err, types) {
        if (err) {
          return callback(err);
        }
        distinct = types;
        return callback(null);
      });
    }
    function manage(callback) {
      var orphans = _.difference(distinct, managed);
      if (!orphans.length) {
        return setImmediate(callback);
      }
      self.apos.utils.warnDev('⚠️  the following types exist in your aposDocs collection,\n' +
        'but are not managed by any module. A generic manager is being stubbed in\n' +
        'for each one to keep your site from crashing, but you should remove these\n' +
        'permanently from the database OR manage them properly by:\n\n' +
        '* Listing them as "types" for "apostrophe-pages", OR\n' +
        '* Providing an appropriate subclass of apostrophe-pieces.\n\n' +
        orphans.join(', ')
      );
      if (_.contains(orphans, 'WASUNDEFINED')) {
        self.apos.utils.warnDev('⚠️  Some of your docs had no type at all. The type WASUNDEFINED\n' +
          'has been set for them to allow a generic manager to work.');
      }
      return async.eachSeries(orphans, function(name, callback) {
        return self.registerGenericPageType(name, callback);
      }, callback);
    }
  };

  self.implementParkAll = function(callback) {
    var req = self.apos.tasks.getReq();
    return async.eachSeries(self.parked, function(item, callback) {
      return self.implementParkOne(req, item, callback);
    }, callback);
  };

  self.implementParkOne = function(req, item, callback) {
    var parent;
    var existing;
    if (!((item.type || (item._defaults && item._defaults.type)) && item.slug)) {
      return callback(new Error('Parked pages must have type and slug properties:\n' + JSON.stringify(item, null, '  ')));
    }
    return async.series({
      findParent: function(callback) {
        var parentSlug;
        if ((item.level === 0) || (item.slug === '/')) {
          return setImmediate(callback);
        }
        if (!item.parent) {
          parentSlug = '/';
        } else {
          parentSlug = item.parent;
        }
        return self.find(req, { slug: parentSlug }).joins(false).areas(false).published(null).permission(false).trash(null).toObject(function(err, _parent) {
          if (err) {
            return callback(err);
          }
          parent = _parent;
          return callback(null);
        });
      },
      settings: function(callback) {
        item.parked = _.keys(_.omit(item, '_defaults'));
        if (!parent) {
          item.path = '/';
          item.rank = 0;
          item.level = 0;
        }
        return setImmediate(callback);
      },
      findExisting: function(callback) {
        var criteria = {};
        var slugWithOrWithoutSlash = new RegExp('^' + self.apos.utils.regExpQuote(item.slug.replace(/\/$/, '')) + '/?$');
        if (item.parkedId) {
          criteria.parkedId = item.parkedId;
        } else {
          criteria.slug = slugWithOrWithoutSlash;
        }
        return self.find(req, criteria).joins(false).areas(false).published(null).permission(false).trash(null).toObject(function(err, _existing) {
          if (err) {
            return callback(err);
          }
          existing = _existing;
          return callback(null);
        });
      },
      backupExisting: function(callback) {
        // Perhaps we are transitioning from no parkedId to having a parkedId?
        if (existing || (!item.parkedId)) {
          return callback(null);
        }
        var criteria = {};
        var slugWithOrWithoutSlash = new RegExp('^' + self.apos.utils.regExpQuote(item.slug.replace(/\/$/, '')) + '/?$');
        criteria.slug = slugWithOrWithoutSlash;
        return self.find(req, criteria).joins(false).areas(false).published(null).permission(false).trash(null).toObject(function(err, _existing) {
          if (err) {
            return callback(err);
          }
          if (_existing && _existing.parkedId && (_existing.parkedId !== item.parkedId)) {
            return callback(new Error('The slug you wish to use for a parked page with the parkedId ' + _existing.parkedId + ' is already in use by a parked page that has a different parkedId.'));
          }
          existing = _existing;
          return callback(null);
        });
      },
      updateExisting: function(callback) {
        if (!existing) {
          return callback(null);
        }
        // Enforce all permanent properties on existing
        // pages too
        return self.apos.docs.db.update({
          _id: existing._id
        }, {
          $set: self.apos.utils.clonePermanent(item)
        }, callback);
      },

      insert: function(callback) {
        var defaults = item._defaults;
        if (defaults) {
          delete item._defaults;
          _.defaults(item, defaults);
        }
        if (existing) {
          return setImmediate(callback);
        }
        if (!parent) {
          return self.apos.docs.insert(req, item, callback);
        } else {
          return self.insert(req, parent, item, callback);
        }
      },
      children: function(callback) {
        if (!item._children) {
          return setImmediate(callback);
        }
        return async.eachSeries(item._children, function(child, callback) {
          child.parent = item.slug;
          return self.implementParkOne(req, child, callback);
        }, callback);
      }
    }, callback);
  };

  self.apos.tasks.add('apostrophe-pages', 'unpark',
    'Usage: node app apostrophe-pages:unpark /page/slug\n\n' +
    'This unparks a page that was formerly locked in a specific\n' +
    'position in the page tree.',
    function(apos, argv, callback) {
      // Wrapping a method makes it easy to override
      // that method
      return self.unparkTask(callback);
    }
  );

  self.unparkTask = function(callback) {
    if (self.apos.argv._.length !== 2) {
      return callback('Wrong number of arguments');
    }
    var slug = self.apos.argv._[1];
    return self.apos.docs.db.update({
      slug: slug
    }, {
      $unset: {
        parked: 1
      }
    }, function(err, count) {
      if (err) {
        return callback(err);
      }
      if (!count) {
        return callback('No page with that slug was found.');
      }
      return callback(null);
    });
  };

  // Convenience wrapper
  function addSlashIfNeeded(s) {
    return self.apos.utils.addSlashIfNeeded(s);
  }

  // Routes use this to convert _id to id for the
  // convenience of jqtree
  self.mapMongoIdToJqtreeId = function(changed) {
    return _.map(changed, function(change) {
      change.id = change._id;
      delete change._id;
      return change;
    });
  };

  // Invoked by the apostrophe-versions module.
  //
  // Your module can add additional doc properties that should never be rolled back by pushing
  // them onto the `fields` array.

  self.docUnversionedFields = function(req, doc, fields) {
    // Moves in the tree have knock-on effects on other
    // pages, they are not suitable for rollback
    fields.push('path', 'trash', 'rank', 'level');
  };

  // Returns true if the doc is a page in the tree
  // (it has a slug with a leading /).

  self.isPage = function(doc) {
    // Proper docs always have a slug, but some of our unit tests are lazy about this.
    return doc.slug && doc.slug.match(/^\//);
  };

  // Returns a regular expression to match the `path` property of the descendants of the given page,
  // but not itself
  self.matchDescendants = function(page) {
    // Make sure there is a trailing slash, but don't add two (the home page already has one).
    // Also make sure there is at least one additional character, which there always will be,
    // in order to prevent the home page from matching as its own descendant
    return new RegExp('^' + self.apos.utils.regExpQuote(addSlashIfNeeded(page.path)) + '.');
  };

  // Returns true if `possibleAncestorPage` is an ancestor of `ofPage`.
  // A page is not its own ancestor. If either object is missing or
  // has no path property, false is returned.

  self.isAncestorOf = function(possibleAncestorPage, ofPage) {
    if (!possibleAncestorPage) {
      return false;
    }
    if (!ofPage) {
      return false;
    }
    if (!possibleAncestorPage.path) {
      return false;
    }
    if (!ofPage.path) {
      return false;
    }
    // The home page is everybody's ancestor, unless ofPage is also the home page.
    // The regular expression would fail because it would append a second /. -Tom
    if (possibleAncestorPage.path === '/') {
      return ofPage.path !== '/';
    }
    var regex = new RegExp('^' + self.apos.utils.regExpQuote(possibleAncestorPage.path + '/'));
    return ofPage.path.match(regex);
  };

  // Invoked just before a save operation (either insert or update)
  // on a page is actually pushed to the database. Initially empty for your
  // overriding convenience.

  self.beforeSave = function(req, page, options, callback) {
    return setImmediate(callback);
  };

  // Invoked just before an insert operation on a page
  // is actually pushed to the database. Initially empty for your
  // overriding convenience.

  self.beforeInsert = function(req, page, options, callback) {
    return setImmediate(callback);
  };

  // Invoked just before an update operation on a page (not an insert)
  // is actually pushed to the database. Initially empty for your
  // overriding convenience.

  self.beforeUpdate = function(req, page, options, callback) {
    return setImmediate(callback);
  };

  // While it's a good thing that all docs now can have nuanced permissions,
  // only pages care about "apply to subpages" as a concept when editing
  // permissions. This method adds those nuances to the permissions-related
  // schema fields. Called by the update routes (for new pages, there are
  // no subpages to apply things to yet). Returns a new schema

  self.addApplyToSubpagesToSchema = function(schema) {
    // Do only as much cloning as we have to to avoid modifying the original
    schema = _.clone(schema);
    var index = _.findIndex(schema, { name: '_editGroups' });
    if (index !== -1) {
      schema.splice(index + 1, 0, {
        type: 'boolean',
        name: 'applyToSubpages',
        label: 'Apply permissions to subpages now',
        help: 'This is a one-time operation that takes place when you click save.',
        group: schema[index].group,
        choices: [
          {
            value: true,
            showFields: [
              'appendPermissionsToSubpages'
            ]
          }
        ]
      },
      {
        type: 'select',
        name: 'appendPermissionsToSubpages',
        label: 'How would you like the permissions to be applied to the subpages ?',
        help: 'This is a one-time operation that takes place when you click save.',
        group: schema[index].group,
        def: 'copy',
        choices: [
          {
            value: 'copy',
            label: 'Copy (Overrides the existing permissions)'
          },
          {
            value: 'append',
            label: 'Append (Adds to the existing permissions)'
          }
        ]
      });
    }
    return schema;
  };

  // Registers a manager for every page type that doesn't already have one via `apostrophe-custom-pages`,
  // `apostrophe-pieces-pages`, etc. Invoked by `modulesReady`

  self.registerGenericPageTypes = function(callback) {
    var types = _.pluck(self.typeChoices, 'name');
    types = types.concat(self.getParkedTypes());
    types = _.uniq(types);
    return async.eachSeries(types, self.registerGenericPageType, callback);
  };

  // Get the page type names for all the parked pages, including parked children, recursively.

  self.getParkedTypes = function() {
    return _.map(self.parked, getType).concat(getChildTypes(self.parked));
    function getType(park) {
      var type = park.type || (park._defaults && park._defaults.type);
      if (!type) {
        type = 'PARKEDPAGEWITHNOTYPE';
      }
      return type;
    }
    function getChildTypes(parked) {
      var types = [];
      _.each(parked, function(page) {
        if (page._children) {
          types = types.concat(_.map(page._children, getType)).concat(getChildTypes(page._children));
        }
      });
      return _.uniq(types);
    }
  };

  // Registers a manager for a specific page type that doesn't already have one via `apostrophe-custom-pages`,
  // `apostrophe-pieces-pages`, etc. Invoked by `modulesReady` via `registerGenericPageTypes` and
  // `manageOrphans`

  self.registerGenericPageType = function(type, callback) {
    var manager = self.apos.docs.getManager(type);
    if (manager) {
      return setImmediate(callback);
    }
    var typeName = type + '-auto-pages';
    self.apos.define(typeName, {
      extend: 'apostrophe-custom-pages',
      name: type
    });
    return self.apos.create(typeName, {
      apos: self.apos
    }, function(err, manager) {
      if (err) {
        return callback(err);
      }
      self.apos.docs.setManager(type, manager);
      return callback(null);
    });
  };

  self.registerTrashPageType = function(callback) {
    return self.registerGenericPageType('trash', callback);
  };

  self.validateTypeChoices = function() {
    _.each(self.typeChoices, function(choice) {
      if (!choice.name) {
        throw new Error("One of the page types specified for your 'types' option has no 'name' property.");
      }
      if (!choice.label) {
        throw new Error("One of the page types specified for your 'types' option has no 'label' property.");
      }
    });
  };

  // bc wrapper for `apos.templates.append('contextMenu', helper)`.

  self.addAfterContextMenu = function(helper) {
    return self.apos.templates.append('contextMenu', helper);
  };

  self.finalizeControls = function() {

    self.createControls = self.options.createControls || [
      {
        type: 'minor',
        action: 'cancel',
        label: 'Cancel'
      },
      {
        type: 'major',
        action: 'save',
        label: 'Save'
      }
    ];

    self.editControls = self.options.editControls || [
      {
        type: 'minor',
        action: 'cancel',
        label: 'Cancel'
      },
      {
        type: 'major',
        action: 'save',
        label: 'Save'
      }
    ];

  };

  self.addPermissions = function() {
    self.apos.permissions.add({
      value: 'admin-apostrophe-page',
      label: 'Admin: Pages'
    });
    self.apos.permissions.add({
      value: 'edit-apostrophe-page',
      label: 'Edit: Pages'
    });
  };

  self.removeParkedPropertiesFromSchema = function(page, schema) {
    return _.filter(schema, function(field) {
      return !_.contains(page.parked, field.name);
    });
  };
  // any `slug` field named `slug`. If not, return the schema unmodified.

  self.removeSlugFromHomepageSchema = function(page, schema) {
    if (page.level === 0) {
      schema = _.reject(schema, { type: 'slug', name: 'slug' });
    }
    return schema;
  };

  self.getCreateControls = function(req) {
    var controls = _.cloneDeep(self.createControls);
    return controls;
  };

  self.getEditControls = function(req) {
    var controls = _.cloneDeep(self.editControls);
    return controls;
  };

  self.addToAdminBar = function() {
    self.apos.adminBar.add(self.__meta.name, 'Pages', 'edit-apostrophe-page');
  };

  // Returns the effective base URL for the given request.
  // If Apostrophe's top-level `baseUrl` option is set, it is returned,
  // otherwise the empty string. This makes it easier to build absolute
  // URLs (when `baseUrl` is configured), or to harmlessly prepend
  // the empty string (when it is not configured). The
  // Apostrophe cursors used to fetch Apostrophe pages
  // consult this method, and it is extended by the optional
  // `apostrophe-workflow` module to create correct absolute URLs
  // for specific locales.

  self.getBaseUrl = function(req) {
    return self.apos.baseUrl || '';
  };

  // Implements a simple batch operation like publish or unpublish.
  // Pass `req`, the `name` of a configured batch operation, and
  // and a function that accepts (req, page, data, callback),
  // performs the modification on that one page (including calling
  // `update` if appropriate), and invokes its callback.
  //
  // `data` is an object containing any schema fields specified
  // for the batch operation. If there is no schema it will be
  // an empty object.
  //
  // If `req.body.job` is truthy, replies immediately to the request with
  // `{ status: 'ok', jobId: 'cxxxx' }`. The `jobId` can then
  // be passed to `apos.modules['apostrophe-jobs'].start()` on the rowser side to
  // monitor progress.
  //
  // Otherwise, replies to the request with { status: 'ok', data: page }
  // on success. If `ids` rather than `_id` were specified,
  // `data` is an empty object.
  //
  // To avoid RAM issues with very large selections and ensure that
  // lifecycle callbacks like beforeUpdate, etc. are invoked, the current
  // implementation processes the pages in series.

  self.batchSimpleRoute = function(req, name, change) {
    var batchOperation = _.find(self.options.batchOperations, { name: name });
    var schema = batchOperation.schema || [];

    var data = self.apos.schemas.newInstance(schema);
    return self.apos.schemas.convert(req, schema, 'form', req.body, data, function(err) {
      if (err) {
        return self.apiResponder(req, err);
      }
      return runJob();
    });

    function runJob() {
      return self.apos.modules['apostrophe-jobs'].run(req, one, {
        labels: {
          title: batchOperation.progressLabel || batchOperation.buttonLabel || batchOperation.label
        }
      });
    }

    function one(req, id, callback) {
      return self.findForBatch(req, { _id: id }).toObject(function(err, page) {
        if (err) {
          return callback(err);
        }
        if (!page) {
          return callback('notfound');
        }
        return change(req, page, data, callback);
      });
    }

  };

  // Given a page and its parent (if any), returns a schema that
  // is filtered appropriately to that page's type, taking into
  // account whether the page is new and the parent's allowed
  // subpage types

  self.allowedSchema = function(req, page, parentPage) {
    var schema = self.apos.docs.getManager(page.type).allowedSchema(req);
    var typeField = _.find(schema, { name: 'type' });
    if (typeField) {
      var allowed = self.allowedChildTypes(parentPage);
      // For a preexisting page, we can't forbid the type it currently has
      if (page._id && (!_.includes(allowed, page.type))) {
        allowed.unshift(page.type);
      }
      typeField.choices = _.map(allowed, function(name) {
        return {
          value: name,
          label: getLabel(name)
        };
      });
    }
    if (page._id) {
      // Preexisting page
      schema = self.addApplyToSubpagesToSchema(schema);
      schema = self.removeParkedPropertiesFromSchema(page, schema);
    }
    return schema;
    function getLabel(name) {
      var choice = _.find(self.typeChoices, { name: name });
      var label = choice && choice.label;
      if (!label) {
        var manager = self.apos.docs.getManager(name);
        if (!manager) {
          throw new Error('There is no page type ' + name + ' but it is configured in allowedHomepageTypes or allowedSubpageTypes or is the type of an existing page, I give up');
        }
        label = manager.label;
      }
      if (!label) {
        label = name;
      }
      return label;
    }
  };

  // User must have some editing privileges for this type
  self.requireEditor = function(req, res, next) {
    if (!self.apos.permissions.can(req, 'edit-apostrophe-page')) {
      return res.send({
        status: 'forbidden'
      });
    }
    return next();
  };

  // Used to fetch the projection used for the /modules/apostrophe-pages/info route to avoid disclosing
  // excessive information. By default, returns the `infoProjection` option. A good extension point;
  // be sure to apply the `super` pattern to get the benefit of extensions in other modules,
  // like workflow.

  self.getInfoProjection = function(req) {
    return self.options.infoProjection;
  };

  // Implements setting the projection for the info route, see getInfoProjection.
  self.setInfoProjection = function(req, cursor) {
    cursor.projection(self.getInfoProjection(req));
  };

};
