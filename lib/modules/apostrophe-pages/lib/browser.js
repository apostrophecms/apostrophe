var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.getBrowserData = function(req) {
    if (!req.user) {
      return false;
    }
    const options = _.pick(self, 'action', 'schema', 'types');
    _.assign(options, _.pick(self.options, 'deleteFromTrash', 'trashInSchema', 'batchOperations'));
    if (req.data.bestPage) {
      options.page = self.pruneCurrentPageForBrowser(req.data.bestPage);
    }
    return options;
  };

};
