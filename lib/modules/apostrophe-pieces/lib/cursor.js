module.exports = {
  extend: 'apostrophe-cursor',
  afterConstruct: function(self) {
    // Customize defaults. If we don't do this late in afterConstruct, we
    // get blown out by the criteria argument to find()
    self.type(self.options.module.name).sort(self.options.module.options.sort || { updatedAt: -1 });
  }
};

