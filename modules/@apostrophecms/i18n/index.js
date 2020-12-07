// TODO: replace with i18n-next. Careful, the middleware for apostrophe editing
// locales is also in here.
//
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

const _ = require('lodash');
const i18n = require('i18n');

module.exports = {
  init(self, options) {
    const i18nOptions = self.options || {};
    _.defaults(i18nOptions, {
      locales: [ 'en' ],
      cookie: 'apos_language',
      directory: self.options.localesDir || self.apos.rootDir + '/locales'
    });
    self.locales = (i18nOptions.options && i18nOptions.options.locales[0]) || [ 'en' ];
    self.defaultLocale = self.options.defaultLocale || self.locales[0];
    i18n.configure(i18nOptions);
    // Make the i18n instance available globally in Apostrophe
    self.apos.i18n = i18n;
  },
  middleware(self, options) {
    return {
      init(req, res, next) {
        // TODO: if queryLocale is not present, implement fallbacks
        // similar to apostrophe-workflow based on prefixes, hostnames,
        // locale headers, etc. What we have now works for editing
        // draft/published content
        const queryLocale = req.query['apos-locale'];
        const locale = (self.locales.includes(queryLocale) && queryLocale) || self.defaultLocale;
        req.locale = locale;
        const mode = req.query['apos-edit'] ? 'draft' : 'published';
        req.mode = mode;
        return self.apos.i18n.init(req, res, next);
      }
    };
  }
};
