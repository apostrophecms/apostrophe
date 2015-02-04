module.exports = {
  construct: function(self, options) {
    self.assets = [];
    self.push = function(chain, type, name) {
      self.assets.push({
        chain: chain,
        type: type,
        name: name
      });
    };
    // Core service convenience pointer
    self.apos.assets = self;
  }
};
