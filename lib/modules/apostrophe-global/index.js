// Provides req.data.global, an Apostrophe doc
// for sitewide content such as a footer displayed on all pages. You
// can also create site-wide preferences by adding schema fields. Just
// configure this module with the `addFields` option as you normally would
// for any widget or pieces module.
//
// ## options
//
// `deferWidgetLoading`: a performance option. if true, any widget loads that can be deferred
// will be until the end of the process of loading the global doc, reducing the number of queries
// for simple cases.
//
// Note that the `defer` option must also be set to `true` for all widget types
// you wish to defer loads for.
//
// To avoid causing problems for routes that depend on the middleware, loads are
// only deferred until the end of loading the global doc and anything it
// joins with; they are not merged with deferred loads for the actual page.
// This option defaults to `false` because in many cases performance is
// not improved, as the global doc often contains no deferrable widgets,
// or loads them efficiently already.
//
// `addFields`: if the schema contains fields, the "Global Content" admin bar button will
// launch the editor modal for those, otherwise it will shortcut directly to the versions dialog box
// which is still relevant on almost all sites because of the use of global header
// and footer areas, etc.
//
// This module provides middleware so that `req.data.global` is always available,
// even in requests that are not for Apostrophe pages. In a command line task, you can use
// the provided `findGlobal` method.
//
// `separateWhileBusyMiddleware`: if true, the `whileBusy` method is powered
// by separate middleware that checks for the lock flag in `apostrophe-global`
// even if the regular middleware of this method has been disabled and/or
// overridden to cache in such a way as to make it unsuitable for
// this purpose.
//
// ## properties
//
// `_id`: the MongoDB ID of the global doc. Available after `modulesReady`.

var async = require('async');
var Promise = require('bluebird');
var _ = require('@sailshq/lodash');

module.exports = {

  extend: 'apostrophe-pieces',

  singletonWarningIfNot: 'apostrophe-global',

  name: 'apostrophe-global',

  alias: 'global',

  label: 'Global',

  pluralLabel: 'Global',

  whileBusyDelay: 60,

  whileBusyRetryAfter: 5,

  whileBusyRequestDelay: 10,

  searchable: false,

  beforeConstruct: function(self, options) {
    options.removeFields = [ 'title', 'slug', 'tags', 'published', 'trash' ].concat(options.removeFields || []);
  },

  afterConstruct: function(self) {
    self.enableMiddleware();
  },

  construct: function(self, options) {

    self.slug = options.slug || 'global';

    // Fetch the `global` doc object. On success, the callback is invoked
    // with `(null, global)`. If no callback is passed a promise is returned.

    self.findGlobal = function(req, callback) {
      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)();
      }
      function body(callback) {
        var global;
        var cursor;
        return async.series([
          find, after
        ], function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, global);
        });
        function find(callback) {
          cursor = self.find(req, { slug: self.slug })
            .permission(false)
            .sort(false)
            .joins(false)
            .areas(false);
          return cursor.toObject(function(err, doc) {
            global = doc;
            // Make this available early, sans joins and area loaders,
            // to avoid race conditions for modules like
            // apostrophe-pieces-orderings-bundle if we wait
            // for joins that might also need the global doc to find their
            // default orderings, etc.
            req.aposGlobalCore = global;
            return callback(err);
          });
        }
        function after(callback) {
          if (!global) {
            return callback(null);
          }
          cursor = cursor.clone();
          cursor.joins(true);
          cursor.areas(true);
          return cursor.after([ global ], callback);
        }
      }
    };

    // We no longer call initGlobal on modulesReady, we do it on the new
    // apostrophe:migrate event. But to maximize bc, we still register the event
    // handler in modulesReady. This accommodates anyone who has applied
    // the super pattern to that method.

    self.modulesReady = function(callback) {
      self.on('apostrophe:migrate', 'initGlobalPromisified', function(options) {
        return Promise.promisify(self.initGlobal)();
      });
      return callback(null);
    };

    // Initialize the `global` doc, if necessary. Invoked late in the
    // startup process by `modulesReady`.

    self.initGlobal = function(callback) {
      var req = self.apos.tasks.getReq();
      var existing;
      return async.series({
        // Early in pre-2.0 code there was no type property for the global page.
        // We can't use a standard migration to fix that because initGlobal
        // is called too soon
        migrate: function(callback) {
          return self.apos.docs.db.update({
            slug: self.slug,
            $or: [
              // Could still be literally undefined, or it could have been
              // patched by the orphan doc type creator
              {
                type: { $exists: 0 }
              },
              {
                type: 'WASUNDEFINED'
              }
            ]
          }, {
            $set: {
              type: self.name
            }
          }, callback);
        },
        fetch: function(callback) {
          // Existence test must not load widgets etc. as this can lead
          // to chicken and egg problems if widgets join with page types
          // not yet registered.
          //
          // There can be more than one document if workflow is present.
          return self.apos.docs.db.find({ slug: self.slug }).toArray(function(err, result) {
            if (err) {
              return callback(err);
            }
            existing = result;
            return callback();
          });
        },
        insert: function(callback) {
          if (existing.length) {
            return setImmediate(callback);
          }
          var insert = self.newInstance();
          Object.assign(insert, { slug: self.slug, published: true });
          return self.apos.docs.insert(req, insert, callback);
        },
        update: function(callback) {
          // Add missing fields based on their def properties
          const sample = self.newInstance();
          return async.eachSeries(existing, function(doc, callback) {
            let modified = false;
            _.each(self.schema, function(field) {
              if ((!_.has(doc, field.name)) && (_.has(sample, field.name))) {
                doc[field.name] = sample[field.name];
                modified = true;
              }
            });
            if (modified) {
              var eReq = req;
              if (doc.workflowLocale) {
                // Make sure the request matches the locale
                eReq = Object.assign({}, req, { locale: doc.workflowLocale });
              }
              return self.apos.docs.update(eReq, doc, callback);
            } else {
              return setImmediate(callback);
            }
          }, callback);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        // Populated for bc, we now get the _id from the copy fetched
        // per request by the middleware
        self._id = existing._id;
        return callback(null);
      });
    };

    // Add the `addGlobalToData` middleware. And if requested,
    // the separate middleware for checking the global busy flag
    // when addGlobalToData has been overridden in a way that might
    // involve caching or otherwise not be up to date at all times.

    self.enableMiddleware = function() {
      self.expressMiddleware = (self.options.separateWhileBusyMiddleware ? [
        self.whileBusyMiddleware
      ] : []).concat([ self.addGlobalToData ]);
    };

    self.whileBusyMiddleware = function(req, res, next) {
      var _global;
      return async.series([
        find,
        check
      ], function(err) {
        if (err) {
          self.apos.utils.error(err);
          return res.status(500).send('error');
        }
        return next();
      });

      function find(callback) {
        return self.find(req, { slug: self.slug })
          .permission(false)
          .areas(false)
          .joins(false)
          .toObject(function(err, __global) {
            if (err) {
              return res.status(500).send('error');
            }
            _global = __global;
            return callback(null);
          });
      }

      function check(callback) {
        return self.checkWhileBusy(req, _global, callback);
      }
    };

    self.checkWhileBusy = function(req, _global, callback) {
      var lockName = 'apostrophe-global-busy';
      var localeLockName;
      var propName = 'globalBusy';
      var localePropName;
      if (req.locale) {
        localeLockName = lockName + '-' + req.locale;
        localePropName = propName + req.locale;
      }
      return async.series([
        considerGlobal,
        considerLocale
      ], callback);

      function considerGlobal(callback) {
        return considerLock(propName, lockName, callback);
      }

      function considerLocale(callback) {
        if (!localePropName) {
          return callback(null);
        }
        return considerLock(localePropName, localeLockName, callback);
      }

      function considerLock(propName, lockName, callback) {
        if (_global[propName]) {
          return self.apos.locks.lock(lockName, {
            wait: (req.res && req.res.send) ? self.options.whileBusyRequestDelay * 1000 : Number.MAX_VALUE,
            waitForSelf: true
          }, function(err) {
            if (!err) {
              // We got in after a period of the system being busy,
              // or the process with the lock went away. Either way,
              // we should clear globalBusy and give up our lock,
              // then continue normal operation.
              return async.series([ unmark, unlock, refind ], callback);
            }
            // An error occurred. If it is because the lock is still
            // present after waiting as long as we could for this req,
            // send a try-again response to the user.
            if ((err === 'locked') && req.res && req.res.send) {
              return self.busyTryAgainSoon(req);
            } else {
              // All other errors propagate normally
              return callback(err);
            }
          });
        }
        return callback(null);
        function unmark(callback) {
          var $set = {};
          $set[propName] = false;
          return self.apos.docs.db.update({
            _id: _global._id
          }, {
            $set: $set
          }, callback);
        }
        function unlock(callback) {
          return self.apos.locks.unlock(lockName, callback);
        }
        function refind(callback) {
          return self.findGlobal(req, function(err, result) {
            if (err) {
              return callback(err);
            }
            req.data.global = result;
            return callback(null);
          });
        }
      }
    };

    // Fetch the global doc and add it to `req.data` as `req.data.global`, if it
    // is not already present. If it is already present, skip the
    // extra query.
    //
    // If called with three arguments, acts as middleware.
    //
    // If called with two arguments, the first is `req` and the second is
    // invoked as `callback`.
    //
    // If called with one argument, that argument is `req` and a promise
    // is returned.

    self.addGlobalToData = function(req, res, next) {
      if (arguments.length >= 3) {
        // middleware
        return body(function(err) {
          if (err) {
            self.apos.utils.error('ERROR loading global doc: ', err);
            // Here in middleware we can't tell if this would have been a page,
            // so we can't set `aposError` and wait. We have to force the issue
            res.status(500).send('error');
            return;
          }
          // Don't break other middleware or routes that might not be defer-aware.
          // The regular page rendering route will reenable this on its own
          req.deferWidgetLoading = false;
          return next();
        });
      } else if (arguments.length === 2) {
        // res is actually callback
        return body(res);
      } else {
        // just takes req and returns promise
        return Promise.promisify(body)();
      }

      function body(callback) {

        if (req.data.global) {
          return callback(null);
        }

        if (self.options.deferWidgetLoading) {
          req.deferWidgetLoading = true;
        }

        return async.series([ findGlobal, check, loadDeferredWidgets ], callback);

      }

      function findGlobal(callback) {
        return self.findGlobal(req, function(err, result) {
          if (err) {
            return callback(err);
          }

          req.data.global = result;

          return callback(null);
        });
      }

      function check(callback) {
        return self.checkWhileBusy(req, req.data.global, callback);
      }

      function loadDeferredWidgets(callback) {
        if (!self.options.deferWidgetLoading) {
          return callback(null);
        }
        return self.apos.areas.loadDeferredWidgets(req, callback);
      }
    };

    self.busyTryAgainSoon = function(req) {
      if (!_.includes([ 'GET', 'HEAD' ], req.method)) {
        // Typically an API will receive this sad news
        return req.res.status(503).send({ status: 'busy' });
      }
      return req.res.status(503).set('Refresh', self.options.whileBusyRetryAfter).send(self.render(req, 'busy.html'));
    };

    // Run the given function while the entire site is marked as busy.
    //
    // This is a promise-based method. `fn` may return a promise, which will
    // be awaited. This method will return a promise, which must be awaited.
    //
    // While the site is busy new requests are delayed as much as possible,
    // then GET requests receive a simple "busy" page that retries
    // after an interval, etc. To address the issue of requests already
    // in progress, this method marks the site busy, then waits for
    // `options.whileBusyDelay` seconds before invoking `fn`.
    // That option defaults to 60 (one minute). Explicitly tracking
    // all requests in flight would have too much performance impact
    // on normal operation.
    //
    // This method should be used very rarely, for instance for a procedure
    // that deploys an entirely new set of content to the site. Use of
    // this method for anything more routine would have a crippling
    // performance impact.
    //
    // **Use with workflow**: if `options.locale` argument is present, only
    // the given locale name is marked busy. If `req` has any other
    // `req.locale` it proceeds normally. This option works only with
    // 'apostrophe-workflow' (the global docs must have `workflowLocale`
    // properties).

    self.whileBusy = function(fn, options) {
      var locked = false;
      var marked = false;
      var lockName = 'apostrophe-global-busy';
      var propName = 'globalBusy';
      var locale = options && options.locale;
      if (locale) {
        lockName += '-' + locale;
        propName += locale;
      }
      var criteria = {
        type: self.name
      };
      if (locale) {
        criteria.workflowLocale = locale;
      }
      return Promise.try(function() {
        return self.apos.locks.lock(lockName);
      }).then(function() {
        locked = true;
        var $set = {};
        $set[propName] = true;
        var args = {
          $set: $set
        };
        return self.apos.docs.db.update(criteria, args, {
          // so that if we really want to lock across all locales
          // (locale not passed and workflow present), we can
          multi: true
        });
      }).then(function() {
        marked = true;
        return Promise.delay(self.options.whileBusyDelay * 1000);
      }).then(function() {
        return fn();
      }).finally(function() {
        return Promise.try(function() {
          var $set = {};
          $set[propName] = false;
          var args = {
            $set: $set
          };
          if (marked) {
            return self.apos.docs.db.update(criteria, args, {
              // workflow-aware for cases where we really do want
              // to lock across all locales
              multi: true
            });
          }
        }).then(function() {
          if (locked) {
            return self.apos.locks.unlock(lockName);
          }
        });
      });
    };

    var superGetCreateSingletonOptions = self.getCreateSingletonOptions;
    self.getCreateSingletonOptions = function(req) {
      var browserOptions = superGetCreateSingletonOptions(req);
      // For compatibility with the workflow module try to get the _id
      // from the copy the middleware fetched for this specific request,
      // if not fall back to self._id
      browserOptions._id = (req.data.global && req.data.global._id) || self._id;
      return browserOptions;
    };

    // There is only one useful object of this type, so having access to the admin
    // bar button is not helpful unless you can edit that one, rather than
    // merely creating a new one (for which there is no UI). Thus we need
    // to set the permission requirement to admin-apostrophe-global.
    // This is called for you.

    self.addToAdminBar = function() {
      self.apos.adminBar.add(self.__meta.name, self.pluralLabel, 'admin-' + self.name);
    };

    var superGetEditControls = self.getEditControls;
    self.getEditControls = function(req) {
      var controls = superGetEditControls(req);
      var more = _.find(controls, { name: 'more' });
      if (more) {
        more.items = _.reject(more.items, function(item) {
          return _.contains([ 'trash', 'copy' ], item.action);
        });
      }
      return controls;
    };

  }
};
