module.exports = function(self, options) {

  let superGetBrowserData = self.getBrowserData;

  self.getBrowserData = function(req) {
    if (!req.user) {
      return;
    }
    const browserOptions = superGetBrowserData(req);
    // Options specific to pieces and their manage modal
    browserOptions.filters = self.filters;
    browserOptions.columns = self.columns;
    browserOptions.contextual = self.contextual;
    browserOptions.batchOperations = self.options.batchOperations;
    browserOptions.insertViaUpload = self.options.insertViaUpload;
    browserOptions.canEditTrash = self.options.canEditTrash;
    browserOptions.components = {
      filters: 'ApostrophePiecesFilters',
      list: 'ApostrophePiecesList',
      pager: 'ApostrophePager',
      insertModal: 'ApostrophePiecesInsertModal'
    };
    return browserOptions;
  };

};
