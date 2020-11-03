module.exports = {
  options: {
    components: {},
    alias: 'busy'
  },
  init(self, options) {
    self.busy = false;
    self.enableBrowserData();
  },
  methods(self, options) {
    return {
      getBrowserData(req) {
        return {
          busy: self.busy,
          components: { the: options.components.the || 'TheAposBusy' }
        };
      }
    };
  }
};
