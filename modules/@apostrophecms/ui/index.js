module.exports = {
  options: {
    alias: 'ui',
    widgetMargin: '20px 0'
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
        return {
          theme,
          widgetMargin: self.options.widgetMargin
        };
      }
    };
  }
};
