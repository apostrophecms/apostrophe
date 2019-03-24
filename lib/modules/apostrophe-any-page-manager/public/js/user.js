apos.define('apostrophe-any-page-manager', {
  extend: 'apostrophe-doc-type-manager',

  construct: function(self, options) {

    let superGetTool = self.getTool;
    self.getTool = function(name, options, callback) {
      if (name === 'manager-modal') {
        return apos.pages.chooserModal(options);
      }
      return superGetTool(name, options, callback);
    };

    let superGetToolType = self.getToolType;
    self.getToolType = function(name) {
      if (name === 'manager-modal') {
        return 'apostrophe-pages-reorganize';
      }
      return superGetToolType(name);
    };
  }
});
