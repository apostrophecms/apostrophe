module.exports = {
  options: {
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
          components: { the: 'TheAposBusy' }
        };
      }
    };
  }
};
