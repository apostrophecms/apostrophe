var _ = require('lodash');

module.exports = function(self, options) {

  self.pushAssets = function() {
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'editor', { when: 'user' });
    self.pushAsset('script', 'reorganize', { when: 'user' });
    self.pushAsset('script', 'vendor/tree.jquery', { when: 'user' });
    self.pushAsset('script', 'always', { when: 'always' });
    self.pushAsset('stylesheet', 'jqtree', { when: 'user' });
    self.pushAsset('stylesheet', 'user', { when: 'user' });
  };

  self.getCreateSingletonOptions = function(req) {
    var options = _.pick(self, 'action', 'schema', 'types');
    options.deleteFromTrash = self.options.deleteFromTrash;
    if (req.data.bestPage) {
      options.page = self.pruneCurrentPageForBrowser(req.data.bestPage);
    }
    return options;
  }

};
