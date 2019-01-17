module.exports = function(self, options) {
  var superGetBrowserData = self.getBrowserData;
  self.getBrowserData = function(req) {
    if (!req.user) {
      return;
    }
    const browserOptions = superGetBrowserData(req);
    const fields = {};
    for (const name in self.fieldTypes) {
      fields[name] = 'Apostrophe' + self.apos.utils.capitalizeFirst(name) + 'Field';
    }
    browserOptions.components = {
      fields: fields
    };
    return browserOptions;
  };
};
