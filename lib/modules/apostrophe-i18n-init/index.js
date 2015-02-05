module.exports = {
  construct: function(self, options) {

    var i18nOptions = self.options || {};
    _.defaults(i18nOptions, {
      locales: ['en'],
      cookie: 'apos_language',
      directory: self.apos.rootDir + '/locales'
    });
    i18n.configure(i18nOptions);

    // Make the i18n instance available globally in Apostrophe
    self.apos.i18n = 18n;
  }
}
