module.exports = {
  extend: 'apostrophe-pieces',
  construct: function(self, options) {

    if (!options.views) {
      throw new Error(self.__meta.name + ' created with no views option');
    }

    // Create an instance of apostrophe-fancy-pages to
    // power the index pages. Override this method if you
    // wish to use your own custom subclass of
    // apostrophe-fancy-pages

    self.createIndexes = function(self, callback) {
      return self.apos.create('apostrophe-fancy-pages', self.options.views.indexes, callback);
      };
    };

    // A convenient override point for altering the
    // indexes object.

    self.afterCreateIndexes = function(callback) {
      return setImmediate(callback);
    };

  },

  afterConstruct: function(self, callback) {
    self.createIndexes(self, function(err, indexes) {
      if (err) {
        return callback(err);
      }
      self.indexes = indexes;
      return self.afterCreateIndexes(callback);
    });
  }
};
