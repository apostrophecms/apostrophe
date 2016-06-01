module.exports = {
  extend: 'apostrophe-cursor',
  construct: function(self, options) {
    // Customize defaults
    self.type(self.options.module.name).sort(self.options.module.options.sort || { updatedAt: -1 });
  }
};

