module.exports = {
  'spiffiness': 'nifty',
  construct: function(self, options) {
    self.addHelpers({
      test: function(a) {
        return a * 2;
      }
    });
  }
};
