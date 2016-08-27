// Provides req.data.global, a virtual page
// for sitewide content such as a footer displayed on all pages.
// Provides middleware so that `req.data.global` is always available,
// even in requests that are not for Apostrophe pages.

var async = require('async');

module.exports = {

  extend: 'apostrophe-doc-type-manager',

  name: 'apostrophe-global',

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
          return self.findGlobal(req, function(err, result) {
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
          return self.apos.docs.insert(req, { slug: 'global', published: true, type: self.name }, callback);
        }
      }, callback)
    };

    // Add the `addGlobalToData` middleware.

    self.enableMiddleware = function() {
      self.apos.app.use(self.addGlobalToData);
    };

    // Standard middleware. Fetch the global doc and add it to `req.data` as `req.data.global`.

    self.addGlobalToData = function(req, res, next) {
      return self.findGlobal(req, function(err, result) {
        if (err) {
          return next(err);
        }
        req.data.global = result;
        return next();
      });
    };

  }
}
