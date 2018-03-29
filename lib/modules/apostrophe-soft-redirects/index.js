var _ = require('lodash');
var async = require('async');

module.exports = {

  afterConstruct: function(self, callback) {
    self.ensureIndexes(callback);
  },

  construct: function(self, options) {

    self.ensureIndexes = function(callback) {
      return self.apos.docs.db.ensureIndex({ historicUrls: 1 }, callback);
    };

    self.pageNotFound = function(req, callback) {
      return self.apos.docs.find(req, { historicUrls: { $in: [ req.url ] } }).sort({ updatedAt: -1 }).toObject(function(err, doc) {
        if (err) {
          return callback(err);
        }
        if (!doc) {
          return callback(null);
        }
        if (!doc._url) {
          return callback(null);
        }
        if (self.local(doc._url) !== req.url) {
          return req.res.redirect(self.local(doc._url));
        }
        return callback(null);
      });
    };

    self.pageBeforeSend = function(req, callback) {
      var docs = [];
      if (req.data.page) {
        docs.push(req.data.page);
      }
      if (req.data.piece) {
        docs.push(req.data.piece);
      }
      docs = _.filter(docs, function(doc) {
        return !_.contains(doc.historicUrls || [], self.local(doc._url));
      });
      return async.eachSeries(docs, function(doc, callback) {
        return self.apos.docs.db.update({ _id: doc._id }, {
          $addToSet: {
            historicUrls: self.local(doc._url)
          }
        }, callback);
      }, callback);
    };

    // Remove any protocol, // and host/port/auth from URL
    self.local = function(url) {
      return url.replace(/^(https?:)?\/\/[^/]+/, '');
    };

  }

};
