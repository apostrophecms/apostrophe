var _ = require('lodash');
var async = require('async');

// Add a pageUrl filter to *all* cursors by implicitly
// subclassing apostrophe-cursor. This way all pages
// get a ._url property when loaded, unless explicitly
// shut off, even if they are mixed with docs that
// are not pages

module.exports = function(piecesPages) {

  var pieces = piecesPages.pieces;
  var pieceName = pieces.name;
  var pageName = piecesPages.name;

  return {
    construct: function(self, options) {
      self.addFilter(pieceName + 'Url', {
        def: true,
        after: function(results, callback) {
          var req = self.get('req');
          results = _.filter(results, function(result) {
            return result.type === pieceName;
          });
          if (!results.length) {
            return setImmediate(callback);
          }
          return async.series({
            getIndexPages: function(callback) {
              if (req.aposParentPageCache && req.aposParentPageCache[pieceName]) {
                return setImmediate(callback);
              }
              return self.apos.docs.find(req)
                .type(pageName)
                .areas(false)
                .joins(false)
                .toArray(function(err, pages) {
                  if (err) {
                    return callback(err);
                  }
                  if (!req.aposParentPageCache) {
                    req.aposParentPageCache = {};
                  }
                  req.aposParentPageCache[pieceName] = pages;
                  return callback(null);
                }
              );
            }
          }, function(err) {
            _.each(results, function(piece) {
              var parentPage = piecesPages.chooseParentPage(req.aposParentPageCache[pieceName], piece);
              if (parentPage) {
                piece._url = piecesPages.buildUrl(parentPage, piece);
              }
            });
            return callback(null);
          });
        }
      });
    }
  };

};
