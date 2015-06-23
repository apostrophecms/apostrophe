var async = require('async');
var path = require('path');
var _ = require('lodash');

module.exports = function(self, options) {

  // Route that serves pages. See afterInit in
  // index.js for the wildcard argument and the app.get call

  self.serve = function(req, res) {

    // we can use the __ function here, since we're in a request
    var __ = res.__;

    req.data = {};

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
    req.slug = req.slug.replace(/\/+$/, '');
    if ((!req.slug.length) || (req.slug.charAt(0) !== '/')) {
      req.slug = '/' + req.slug;
    }

    // Had to change the URL, so redirect to it. TODO: this
    // contains an assumption that we are mounted at /
    if (req.slug !== req.params[0]) {
      return req.res.redirect(req.slug);
    }

    var filters = self.options.filters || {
      ancestors: true,
      children: true
      // peers: true
    };

    var cursor = self.find(req);

    _.each(filters, function(val, key) {
      cursor[key](val);
    });

    self.matchPageAndPrefixes(cursor, req.slug);

    return async.series({
      cursor: function(callback) {
        return self.apos.callAll('pageServeCursor', cursor, callback);
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

  self.serveLoaders = function(req, callback) {
    return self.apos.callAll('pageServe', req, callback);
  };

  // self.serveSecondChanceLogin = function(req, callback) {

  //   if (options.secondChanceLogin === false) {
  //     return setImmediate(callback);
  //   }

  //   if (req.user) {
  //     return setImmediate(callback);
  //   }

  //   if (req.data.page) {
  //     return callback(null);
  //   }

  //   // Try again without permissions. If we get a better page,
  //   // note the URL in the session and redirect to login.

  //   var slug = req.params[0];

  //   var req = self.apos.
  //   var cursor = self.find(req, { slug: slug })
  //     .permission(false);

  //   self.matchPageAndPrefixes(cursor, slug);

  //   return cursor.toObject(function(err, page) {
  //     if (page || (bestPage && req.bestPage && req.bestPage.slug < bestPage.slug)) {
  //       res.cookie('aposAfterLogin', req.url);
  //       return res.redirect('/login');
  //     }

  //   })

  //     return callback(null);
  //   });
  //   }
  // };

  self.serveNotFound = function(req, callback) {
    if (self.isFound(req)) {
      // found
      return setImmediate(callback);
    }
    // Give all modules a chance to save the day
    return self.apos.callAll('pageNotFound', req, function(err) {
      // Are we happy now?
      if (self.isFound(req)) {
        return callback(null);
      }
      // Default behavior is to render
      // the notFound.html template
      req.notFound = true;
      req.res.statusCode = 404;
      req.template = 'notFound';
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
      res.setHeader('Content-Type', req.contentType);
    }

    if (req.redirect) {
      return res.redirect(req.redirect);
    }

    if (req.statusCode) {
      res.statusCode = req.statusCode;
    }

    // Handle 500 errors

    if (err) {
      console.error(err);
      req.template = 'serverError';
      req.statusCode = 500;
      providePage = false;
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

    // TODO Removing this temporarily because setCurrentPage is currently not a function of pages. -Jimmy
    // if (providePage) {
    //   req.browserCall('apos.pages.setCurrentPage(?)', self.pruneCurrentPageForBrowser(req.bestPage));
    // }

    var args = {
      edit: providePage ? req.data.bestPage._edit : null,
      slug: providePage ? req.data.bestPage.slug : null,
      page: providePage ? req.data.bestPage : null,
      contextMenu: req.contextMenu
    };

    if (args.page && args.edit && (!args.contextMenu)) {
      // Standard context menu for a regular page
      args.contextMenu = self.options.contextMenu;
    }

    if (args.page) {
      var manager = self.getManager(args.page.type);
      if (manager && manager.childTypes && (!type.childTypes.length)) {
        // Snip out add page if no
        // child page types are allowed
        args.contextMenu = _.filter(args.contextMenu, function(item) {
          return item.name !== 'new-page';
        });
      }
    }

    // Merge data that other modules has asked us to
    // make available to the template
    _.extend(args, req.data);

    // A simple way to access everything we know about
    // the page in JSON format. Allow this only if we
    // have editing privileges on the page

    if ((req.query.pageInformation === 'json') && args.page && (args.page._edit)) {
      return res.send(args.page);
    }

    result = self.renderPage(req, req.template, args);

    // TODO: this is part of the code that should
    // migrate to an apostrophe-second-chance-login module
    //
    // if (!req.user) {
    //   // Most recent Apostrophe page they saw is a good
    //   // candidate to redirect them to if they choose to
    //   // log in.
    //   //
    //   // However several types of URLs are not really of
    //   // interest for this purpose:
    //   //
    //   // * AJAX loads of partial pages
    //   // * 404 and other error pages
    //   // * Static asset URLs that may or may not
    //   // actually exist (file extension is present)

    //   if (options.updateAposAfterLogin && ((!res.statusCode) || (res.statusCode === 200)) && (!req.xhr) && (!req.query.xhr) && (!(req.url.match(/\.\w+$/)))) {
    //     res.cookie('aposAfterLogin', req.url);
    //   }
    // }

    return req.res.send(result);
  };

  // A request is "found" if it should not be
  // treated as a "404 not found" situation

  self.isFound = function(req) {
    var found = req.loginRequired || req.insufficient || req.redirect || (req.data.page && (!req.notFound));
    return found;
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
    return async.series([ indexPath ], callback);
    function indexPath(callback) {
      self.apos.docs.db.ensureIndex({ path: 1 }, { safe: true, unique: true, sparse: true }, callback);
    }
  };

  // A limited subset of page properties is pushed to
  // browser-side JavaScript. If you want more you
  // should make your own req.browserCalls

  self.pruneCurrentPageForBrowser = function(page) {

    page = _.pick(page, 'title', 'slug', '_id', 'type', 'ancestors');

    // Limit information about ancestors to avoid
    // excessive amounts of data in the page
    page.ancestors = _.map(page.ancestors, function(ancestor) {
      return _.pick(ancestor, [ 'title', 'slug', '_id', 'type', 'published' ]);
    });

    return page;

  };

  self.find = function(req, criteria, projection) {
    var cursor = self.apos.docs.find(req, criteria, projection);
    // Add filters meant for fetching pages only
    require('./pagesCursor.js')(self, cursor);
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
          path: new RegExp('^' + self.apos.utils.regExpQuote(addSlashIfNeeded(parent.path))),
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
        page.path = addSlashIfNeeded(parent.path) + self.apos.utils.slugify(page.title);
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
      return self.find(req, { _id: movedId })
          .permission(false)
          .trash(null)
          .published(null)
          .areas(false)
          .ancestors({ depth: 1 })
          .toObject(function(err, page) {
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
      self.apos.docs.db.update({ path: new RegExp('^' + self.apos.utils.regExpQuote(addSlashIfNeeded(parent.path))), level: parent.level + 1, rank: { $gt: rank } }, { $inc: { rank: 1 } }, { multi: true }, function(err, count) {
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
      // If the old slug wasn't customized, update the slug as well as the path
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
      var matchParentPathPrefix = new RegExp('^' + self.apos.utils.regExpQuote(addSlashIfNeeded(moved.path)));
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

  self.getManager = function(type) {
    return self.apos.docs.getManager(type);
  };

  self.setManager = function(type, manager) {
    return self.apos.docs.setManager(type);
  };

  // self.trash = function(req, pageOrId, callback) {
  // };

  self.parked = (self.options.minimumPark || [
    {
      slug: '/',
      published: true,
      _defaults: {
        title: 'Home',
        type: 'home'
      },
      _children: [
        {
          slug: '/trash',
          type: 'trash',
          trash: true,
          published: false,
          orphan: true,
          _defaults: {
            title: 'Trash'
          },
        }
      ]
    },
  ]).concat(self.options.park || []);

  // Ensure the existence of a page or array of pages and
  // lock them in place in the page tree.
  //
  // The `slug` property must be set. The `parent`
  // property may be set to the slug of the intended
  // parent page, which must also be parked. If you
  // do not set `parent`, the page is assumed to be a
  // child of the home page, which is always parked.

  self.park = function(pageOrPages) {
    var pages;
    pages = Array.isArray(pageOrPages) ? pageOrPages : [ pageOrPages ];
    self.parked = self.parked.concat(pageOrPages);
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
    return async.series({
      findParent: function(callback) {
        var parentSlug;
        if (item.slug === '/') {
          return setImmediate(callback);
        }
        if (!item.parent) {
          parentSlug = '/';
        } else {
          parentSlug = item.parent;
        }
        return self.find(req, { slug: parentSlug }).published(null).permission(false).trash(null).toObject(function(err, _parent) {
          if (err) {
            return callback(err);
          }
          parent = _parent;
          return callback(null);
        });
      },
      settings: function(callback) {
        item.parked = true;
        if (!parent) {
          item.path = '/';
          item.rank = 0;
          item.level = 0;
        }
        return setImmediate(callback);
      },
      findExisting: function(callback) {
        return self.find(req, { slug: item.slug }).published(null).permission(false).trash(null).toObject(function(err, _existing) {
          if (err) {
            return callback(err);
          }
          existing = _existing;
          if (!existing) {
            return callback(null);
          }

          // Enforce all permanent properties on existing
          // pages too
          return self.apos.docs.db.update({
            _id: existing._id
          }, {
            $set: item
          }, callback);
        });
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
        item.parked = true;
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

};
