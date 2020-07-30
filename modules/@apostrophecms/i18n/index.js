// This module makes an instance of the [i18n](https://npmjs.org/package/i18n) npm module available
// as `apos.i18n`. Apostrophe also makes this available in Nunjucks templates via the
// usual `__()` helper function. Any options passed to this module are passed on to `i18n`.
//
// By default i18n locale files are generated in the `locales` subdirectory of the project.
//
// ## Options
//
// `localesDir`: if specified, the locale `.json` files are stored here, otherwise they
// are stored in the `locales` subdirectory of the project root.

let _ = require('lodash');
let i18n = require('i18n');

module.exports = {
  init(self, options) {
    let i18nOptions = self.options || {};
    _.defaults(i18nOptions, {
      locales: ['en'],
      cookie: 'apos_language',
      directory: self.options.localesDir || self.apos.rootDir + '/locales'
    });
    i18n.configure(i18nOptions);
    // Make the i18n instance available globally in Apostrophe
    self.apos.i18n = i18n;
  },
  middleware(self, options) {
    return {
      init(req, res, next) {
        return self.apos.i18n.init(req, res, next);
      }
    };
  }
};
