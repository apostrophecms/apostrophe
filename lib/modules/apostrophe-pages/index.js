var async = require('async');

module.exports = {

  afterConstruct: function(self, callback) {
    return self.ensureIndexes(callback);
  },

  construct: function(self, options) {

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
      throw 'unimplemented';
    };

    self.move = function(req, page, target, relationship, callback) {
      throw 'unimplemented';
    };

    self.update = function(req, page, callback) {
      return self.apos.docs.update(req, page, callback);
    };

    // self.trash = function(req, pageOrId, callback) {
    // };

    self.apos.pages = self;

  }
};
