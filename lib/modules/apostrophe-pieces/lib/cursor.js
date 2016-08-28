module.exports = {
  extend: 'apostrophe-doc-type-manager-cursor',
  afterConstruct: function(self) {
    self.sort(self.options.module.options.sort || { updatedAt: -1 });
  }
};

