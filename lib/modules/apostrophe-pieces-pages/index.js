module.exports = {
  extend: 'apostrophe-fancy-pages',

  afterConstruct: function(self) {
    self.dispatchAll();
  },

  construct: function(self, options) {
    self.label = self.options.label;

    // the name of the pieces subclass we're going to pay attention to
    self.piecesModuleName = self.options.piecesModuleName || self.__meta.name.replace(/\-pages$/, '');
    // the actual pieces module
    self.pieces = self.apos.modules[self.piecesModuleName];

    console.log('********** INITIALIZING **********', self.piecesModuleName)

    self.indexPage = function(req, callback) {
      console.log('******* DOING INDEX *********')

      self.pieces.find(req, {}).queryToFilters(req.query, 'public').toArray(function(err, docs) {
        req.template = self.renderer('index');
        req.data.pieces = docs;
        return callback(null);
      });
    }

    self.showPage = function(req, callback) {
      console.log('******* DOING SHOW *********')

      self.pieces.find(req, { slug: req.params.slug }).queryToFilters(req.query, 'public').toObject(function(err, doc) {
        req.template = self.renderer('show');
        req.data.piece = doc;
        return callback(null);
      });
    }

    // set up out basic routes for index and show 
    self.dispatchAll = function() {
      self.dispatch('/', self.indexPage);
      self.dispatch('/:slug', self.showPage);
    }
  }
};
