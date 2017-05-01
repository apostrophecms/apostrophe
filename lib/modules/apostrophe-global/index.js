// Provides req.data.global, a virtual page
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
// ## properties
//
// `_id`: the MongoDB ID of the global doc. Available after `modulesReady`.

var async = require('async');

module.exports = {

  extend: 'apostrophe-pieces',

  name: 'apostrophe-global',
  
  alias: 'global',
  
  label: 'Global',

  pluralLabel: 'Global',
  
  searchable: false,
  
  beforeConstruct: function(self, options) {
    options.removeFields = [ 'title', 'slug', 'tags', 'published' ].concat(options.removeFields || []);
  },

  afterConstruct: function(self) {
    self.enableMiddleware();
  },

  construct: function(self, options) {

    self.slug = options.slug || 'global';

    // Fetch the `global` doc object. On success, the callback is invoked
    // with `(null, global)`.

    self.findGlobal = function(req, callback) {
      return self.find(req, { slug: self.slug })
        .permission(false)
        .toObject(callback);
    };

    self.modulesReady = function(callback) {
      self.initGlobal(callback);
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
          // not yet registered
          return self.apos.docs.db.findOne({ slug: self.slug }, function(err, result) {
            if (err) {
              return callback(err);
            }
            existing = result;
            return callback();
          });
        },
        insert: function(callback) {
          if (existing) {
            return setImmediate(callback);
          }
          existing = { slug: self.slug, published: true, type: self.name };
          return self.apos.docs.insert(req, existing, callback);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        self._id = existing._id;
        return callback(null);
      });
    };

    // Add the `addGlobalToData` middleware. Do it via the `expressMiddleware` property
    // so it runs in a well-behaved sequence with other module middleware.

    self.enableMiddleware = function() {
      self.expressMiddleware = self.addGlobalToData;
    };

    // Standard middleware. Fetch the global doc and add it to `req.data` as `req.data.global`.

    self.addGlobalToData = function(req, res, next) {
      if (self.options.deferWidgetLoading) {
        req.deferWidgetLoading = true;
      }
      return async.series([ findGlobal, loadDeferredWidgets ], function(err) {
        if (err) {
          req.error = err;
        }
        // Don't break other middleware or routes that might not be defer-aware.
        // The regular page rendering route will reenable this on its own
        req.deferWidgetLoading = false;
        return next();
      });
      
      function findGlobal(callback) {
        return self.findGlobal(req, function(err, result) {
          req.data.global = result;
          return callback(null);
        });
      }
      
      function loadDeferredWidgets(callback) {
        if (!self.options.deferWidgetLoading) {
          return callback(null);
        }
        return self.apos.areas.loadDeferredWidgets(req, callback);
      }
    };

    var superGetCreateSingletonOptions = self.getCreateSingletonOptions;
    self.getCreateSingletonOptions = function(req) {
      var browserOptions = superGetCreateSingletonOptions(req);
      browserOptions._id = self._id;
      return browserOptions;
    };

  }
}
