module.exports = {
  options: {
    alias: 'ui'
  },
  icons: {
    'earth-icon': 'Earth',
    'database-check-icon': 'DatabaseCheck'
  },
  init(self) {
    self.enableBrowserData();
  },
  methods(self) {
    return {
      getBrowserData(req) {
        const theme = {
          primary: 'default'
        };
        if (req.data.global && req.data.global.aposThemePrimary) {
          theme.primary = req.data.global.aposThemePrimary;
        }
        if (req.data.user && req.data.user.aposThemePrimary) {
          theme.primary = req.data.user.aposThemePrimary;
        }
        return { theme };
      }
    };
  }
};
