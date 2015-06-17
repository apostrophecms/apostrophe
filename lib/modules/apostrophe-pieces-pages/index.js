var async = require('async');

module.exports = {
  extend: 'apostrophe-fancy-pages',

  afterConstruct: function(self) {
    self.dispatchAll();
  },

  construct: function(self, options) {
    self.label = self.options.label;
    self.perPage = options.perPage || 10;

    self.piecesModuleName = self.options.piecesModuleName || self.__meta.name.replace(/\-pages$/, '');
    self.pieces = self.apos.modules[self.piecesModuleName];

    self.indexPage = function(req, callback) {
      var cursor = self.pieces.find(req, {}).queryToFilters(req.query, 'public').perPage(self.perPage);

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
  }
};