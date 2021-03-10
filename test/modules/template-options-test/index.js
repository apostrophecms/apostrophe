module.exports = {
  options: {
    spiffiness: 'nifty'
  },
  init(self) {
    self.addHelpers({
      test(a) {
        return a * 2;
      }
    });
  }
};
