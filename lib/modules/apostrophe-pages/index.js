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
          }).
          sort({ rank: -1 }).
          limit(1).
          toArray(function(err, results) {
            if (err) {
              return callback(err);
            }
            if (!results.length) {
              page.rank = 0;
            } else {
              // random fractional component ensures
              // deterministic sort behavior if two pages are
              // inserted simultaneously (race condition) and
              // thus have the same integer part
              page.rank = Math.floor(results[0].rank) + 1 + Math.random();
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


    self.move = function(req, pageOrId, targetOrId, relationship, callback) {
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
