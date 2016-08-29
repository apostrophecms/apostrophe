module.exports = {
  extend: 'apostrophe-cursor',
  afterConstruct: function(self) {
    self.type(self.options.module.name);
  }
};
