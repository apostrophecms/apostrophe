var async = require('async');
var _ = require('lodash');

module.exports = {

  afterConstruct: function(self, callback) {
    self.apos.docs = self;
    return async.series([ self.enableCollection, self.ensureIndexes ], callback);
  },

  construct: function(self, options) {

    self.enableCollection = function(callback) {
      self.apos.db.collection('aposDocs', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

    self.ensureIndexes = function(callback) {

      async.series([ indexType, indexSlug, indexSortTitle, indexTags, indexPublished, indexText ], callback);

      function indexType(callback) {
        self.db.ensureIndex({ type: 1 }, { safe: true }, callback);
      }

      function indexSlug(callback) {
        self.db.ensureIndex({ slug: 1 }, { safe: true, unique: true }, callback);
      }

      function indexSortTitle(callback) {
        self.db.ensureIndex({ sortTitle: 1 }, { safe: true }, callback);
      }

      function indexTags(callback) {
        self.db.ensureIndex({ tags: 1 }, { safe: true }, callback);
      }
      function indexPublished(callback) {
        self.db.ensureIndex({ published: 1 }, { safe: true }, callback);
      }

      function indexText(callback) {
        return self.ensureTextIndex(function(err) {
          if (err) {
            console.error('WARNING: unable to ensure text index, apostrophe:migrate can fix that');
          }
          return callback(null);
        });
      }
    };

    self.ensureTextIndex = function(callback) {
      return self.db.ensureIndex( { highSearchText: 'text', lowSearchText: 'text', title: 'text', searchBoost: 'text' }, { weights: { title: 100, searchBoost: 150, highSearchText: 10, lowSearchText: 2 }, safe: true }, callback);
    };

    self.find = function(req, criteria, projection) {
      var cursor = require('./lib/cursor.js')(self);
      cursor.set('req', req);
      cursor.set('criteria', criteria);
      cursor.set('projection', projection);
      return cursor;
    };
  },

};
