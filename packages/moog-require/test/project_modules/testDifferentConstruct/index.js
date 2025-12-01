module.exports = {
  beforeConstruct: function(self, options) {
    self._bcDifferentOptions = options;
  },
  construct: function(self, options) {
    self._differentOptions = options;
  }
};
