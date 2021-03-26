module.exports = {
  options: {
    components: {},
    alias: 'busy'
  },
  init(self) {
    self.busy = false;
    self.enableBrowserData();
  },
  methods(self) {
    return {
      getBrowserData(req) {
        return {
          busy: self.busy,
          components: { the: self.options.components.the || 'TheAposBusy' }
        };
      }
    };
  }
};
