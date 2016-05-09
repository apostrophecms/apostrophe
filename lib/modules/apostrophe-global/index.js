// Always provide req.data.global, a virtual page
// for sitewide content such as a footer displayed on all pages

var async = require('async');

module.exports = {
  afterConstruct: function(self) {
    self.enableMiddleware();
  },

  construct: function(self, options) {

    self.slug = options.slug || 'global';

    self.findGlobal = function(req, callback) {
      return self.apos.docs.find(req, { slug: self.slug })
        .permission(false)
        .toObject(callback);
    };

    self.modulesReady = function(callback) {
      self.initGlobal(callback);
    };

    self.initGlobal = function(callback) {
      var req = self.apos.tasks.getReq();
      var existing;
      return async.series({
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
          return self.apos.docs.insert(req, { slug: 'global', published: true }, callback);
        }
      }, callback)
    };

    self.enableMiddleware = function(){
      self.apos.app.use(self.addGlobalToData);
    };

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
