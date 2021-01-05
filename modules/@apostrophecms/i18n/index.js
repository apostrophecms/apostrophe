// TODO: replace i18n npm module with i18n-next. Careful, the middleware for apostrophe editing
// locales is also in here.
//
// This module makes an instance of the [i18n](https://npmjs.org/package/i18n) npm module available
// in Nunjucks templates via the usual `__()` helper function. That function and its relatives are
// also available on `req` objects. Any options passed to this module are passed on to `i18n`.
//
// `apos.i18n.i18n` can be used to directly access the `i18n` npm module instance if necessary.
// It usually is a bad idea. Use `req.__` if you need to localize in a route.
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
  options: {
    alias: 'i18n'
  },
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
    self.i18n = i18n;
  },
  middleware(self, options) {
    return {
      init(req, res, next) {
        // Support for a single apos-locale query param that
        // also contains the mode, which is likely to occur
        // since we have the `aposLocale` property in docs
        // structured that way
        if (req.query['apos-locale'] && req.query['apos-locale'].includes(':')) {
          const parts = req.query['apos-locale'].split(':');
          req.query['apos-locale'] = parts[0];
          req.query['apos-mode'] = parts[1];
        }
        const validModes = [ 'draft', 'published' ];
        let locale;
        if (self.isValidLocale(req.query['apos-locale'])) {
          locale = req.query['apos-locale'];
        } else if (self.isValidLocale(req.session && req.session.locale)) {
          locale = req.session.locale;
        } else {
          locale = self.defaultLocale;
        }
        let mode;
        if (validModes.includes(req.query['apos-mode'])) {
          mode = req.query['apos-mode'];
        } else if (validModes.includes(req.session && req.session.mode)) {
          mode = req.session.mode;
        } else {
          mode = 'published';
        }
        req.locale = locale;
        req.mode = mode;
        return self.i18n.init(req, res, next);
      }
    };
  },
  methods(self, options) {
    return {
      isValidLocale(locale) {
        return locale && self.locales.includes(locale);
      },
      // Infer `req.locale` and `req.mode` from `_id` if they were
      // not set already by explicit query parameters. Conversely,
      // if the parameters were set, rewrite `_id` accordingly.
      // Returns `_id`, after rewriting if appropriate.
      inferIdLocaleAndMode(req, _id) {
        let [ cuid, locale, mode ] = _id.split(':');
        if (locale && mode) {
          if (!req.query['apos-locale']) {
            req.locale = locale;
          } else {
            locale = req.locale;
          }
          if (!req.query['apos-mode']) {
            req.mode = mode;
          } else {
            mode = req.mode;
          }
        } else {
          // aposDocId was passed, complete the _id from whatever
          // was in query params or defaults
          locale = req.locale;
          mode = req.mode;
        }
        return `${cuid}:${locale}:${mode}`;
      }
    };
  }
};
