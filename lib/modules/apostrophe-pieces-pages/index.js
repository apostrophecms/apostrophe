var _ = require('lodash');
var async = require('async');

module.exports = {
  extend: 'apostrophe-custom-pages',

  afterConstruct: function(self) {
    self.dispatchAll();
  },

  construct: function(self, options) {
    self.options.addFields = [
      {
        type: 'tags',
        name: 'withTags',
        label: 'Show Content With These Tags'
      }
    ].concat(self.options.addFields || []);
    self.label = self.options.label;
    self.perPage = options.perPage || 10;

    self.piecesModuleName = self.options.piecesModuleName || self.__meta.name.replace(/\-pages$/, '');
    self.pieces = self.apos.modules[self.piecesModuleName];

    self.indexPage = function(req, callback) {
      var cursor = self.pieces.find(req, {})
        .queryToFilters(req.query, 'public')
        .perPage(self.perPage);

      self.filterByIndexPageTags(cursor, req.data.page);

      function totalPieces(callback) {
        cursor.toCount(function(err, count) {
          req.data.totalPieces = count;
          req.data.totalPages = cursor.get('totalPages');
          return callback();
        });
      }

      function findPieces(callback) {
        cursor.toArray(function(err, docs) {
          req.template = self.renderer('index');
          req.data.pieces = docs;
          return callback();
        });
      }

      async.series([totalPieces, findPieces], function(err) {
        return callback(null);
      });
    }

    self.filterByIndexPageTags = function(cursor, page) {
      if (page.withTags && page.withTags.length) {
        cursor.and({ tags: { $in: page.withTags } });
      }
    };

    self.showPage = function(req, callback) {
      var cursor = self.pieces.find(req, { slug: req.params.slug });

      cursor.toObject(function(err, doc) {
        req.template = self.renderer('show');
        req.data.piece = doc;
        return callback(null);
      });
    }

    self.dispatchAll = function() {
      self.dispatch('/', self.indexPage);
      self.dispatch('/:slug', self.showPage);
    }

    // Given an array containing all of the index pages that
    // exist on the site and an individual piece, return the
    // index page that is the best fit for use in the URL of
    // the piece. The algorithm is based on shared tags, with
    // an emphasis on matching tags, and also favors an index
    // page with no preferred tags over bad matches.

    self.chooseParentPage = function(pages, piece) {
      var property = self.options.chooseParentPageBy || 'tags';
      // The "tags" property was moved to "withTags" to distinguish
      // what a page *shows* from what a page *is*
      var pageProperty = (property === 'tags') ? 'withTags' : property;
      var tags = piece[property] || [];
      var bestScore;
      var best = null;
      _.each(pages, function(page) {
        var score = 0;
        var pageTags = page[pageProperty] ? page[pageProperty] : [];
        if (!pageTags.length) {
          score = 1;
        }
        var intersect = _.intersection(tags, pageTags);
        var diff = _.difference(tags, pageTags);
        score += intersect.length * 2 - diff.length;
        if ((!best) || (score > bestScore)) {
          bestScore = score;
          best = page;
        }
      });
      return best;
    };

    self.buildUrl = function(page, piece) {
      if (!page) {
        return false;
      }
      return page._url + '/' + piece.slug;
    };

    // merge new methods with all apostrophe-cursors to enhance
    // results for pieces to include URLs
    self.apos.define('apostrophe-cursor', require('./lib/piecesCursor.js')(self));
  }
};
