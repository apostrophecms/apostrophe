module.exports = {
  options: {
    'spiffiness': 'nifty'
  },
  init(self, options) {
    self.addHelpers({
      test(a) {
        return a * 2;
      }
    });
  }
};
