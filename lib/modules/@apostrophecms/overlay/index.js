module.exports = {
  options: {
    components: {},
    alias: 'overlay'
  },
  init(self, options) {
    self.overlay = false;
    self.enableBrowserData();
  },
  methods(self, options) {
    return {
      getBrowserData(req) {
        return {
          overlay: self.overlay,
          components: { the: options.components.the || 'TheApostropheOverlay' }
        };
      }
    };
  }
};
