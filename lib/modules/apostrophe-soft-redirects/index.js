var _ = require('@sailshq/lodash');
var async = require('async');

// Implements "soft redirects." When a 404 is about to occur, Apostrophe will look
// for a page or piece that has been associated with that URL in the past, and
// redirect if there is one. This only comes into play if a 404 is about to occur.
//
// ## Options
//
// ### `enable`
//
// Set this option explicitly to `false` to shut off this feature.
//
// ### `statusCode`
//
// Set this option to return another HTTP status code when redirecting. You may use
// e.g. HTTP 301 for permanent redirects. Defaults to HTTP 302.
//
// For example in your `app.js` module configuration:
//
// ```javascript
// 'apostrophe-soft-redirects': {
//   statusCode: 301
// }
// ```

module.exports = {

  afterConstruct: function(self, callback) {
    if (self.options.enable === false) {
      return;
    }
    self.on('apostrophe:migrate', 'ensureIndexesPromisified', function() {
      return require('bluebird').promisify(self.ensureIndexes)();
    });
    return callback(null);
  },

  construct: function(self, options) {
    var statusCode = self.options.statusCode || 302;

    if (self.options.enable === false) {
      return;
    }

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
          return req.res.redirect(statusCode, self.local(doc._url));
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
        if (doc._url) {
          return !_.contains(doc.historicUrls || [], self.local(doc._url));
        } else {
          return false;
        }
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
