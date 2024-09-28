module.exports = {
  init(self) {
    self.enableBrowserData('anon');
  },
  methods(self) {
    return {
      getBrowserData(req) {
        const logging = process.env.NODE_ENV !== 'production';
        return logging ? {
          queries: req.aposQueries
        } : {};
      }
    };
  }
};
