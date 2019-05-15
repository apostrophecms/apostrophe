apos.define('apostrophe-any-page-manager', {
  extend: 'apostrophe-doc-type-manager',

  construct: function(self, options) {

    var superGetTool = self.getTool;
    self.getTool = function(name, options, callback) {
      if (name === 'manager-modal') {
        return apos.pages.chooserModal(options);
      }
      return superGetTool(name, options, callback);
    };

    var superGetToolType = self.getToolType;
    self.getToolType = function(name) {
      if (name === 'manager-modal') {
        return 'apostrophe-pages-reorganize';
      }
      return superGetToolType(name);
    };
  }
});
