// Provides req.data.global, a virtual page
// for sitewide content such as a footer displayed on all pages.
// Provides middleware so that `req.data.global` is always available,
// even in requests that are not for Apostrophe pages.
//
// ## properties
//
// `_id`: the MongoDB ID of the global page. Available after `modulesReady`.
//
// ## click handlers
//
// Although it is not in the UI by default, if you create an element with
// a `data-apos-versions-global` attribute, a click on that element will
// open the doc versions dialog box for the global doc. This is useful if
// your global doc is used for critical infrastructure like building
// custom sitewide navigation. TODO: consider how this might be best made available
// as a standard feature in the UI.

var async = require('async');

module.exports = {

  extend: 'apostrophe-doc-type-manager',

  name: 'apostrophe-global',
  
  alias: 'global',

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

    // Add the `addGlobalToData` middleware.

    self.enableMiddleware = function() {
      self.apos.app.use(self.addGlobalToData);
    };

    // Standard middleware. Fetch the global doc and add it to `req.data` as `req.data.global`.

    self.addGlobalToData = function(req, res, next) {
      req.deferWidgetLoading = true;
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
        return self.apos.areas.loadDeferredWidgets(req, callback);
      }
    };

    self.pushAssets = function() {
      self.pushAsset('script', 'user', { when: 'user' });
      self.pushAsset('script', 'editor', { when: 'user' });
      self.pushAsset('stylesheet', 'user', { when: 'user' });
    };

    var superGetCreateSingletonOptions = self.getCreateSingletonOptions;
    self.getCreateSingletonOptions = function(req) {
      var browserOptions = superGetCreateSingletonOptions(req);
      browserOptions._id = self._id;
      return browserOptions;
    };

  }
}
