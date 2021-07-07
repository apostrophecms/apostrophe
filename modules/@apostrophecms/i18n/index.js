// This module makes an instance of the [i18next](https://npmjs.org/package/i18next) npm module available
// in Nunjucks templates via the `__t()` helper function. That function is also available on `req` objects
// as `req.t()`. Any options passed to this module are passed on to `i18next`.
//
// `apos.i18n.i18next` can be used to directly access the `i18next` npm module instance if necessary.
// It usually is not necessary. Use `req.t` if you need to localize in a route.

const i18next = require('i18next');
const i18nextHttpMiddleware = require('i18next-http-middleware');
const fs = require('fs');

module.exports = {
  options: {
    alias: 'i18n',
    i18n: {
      ns: 'apostrophe'
    }
  },
  async init(self) {
    self.locales = self.options.locales || [ 'en' ];
    self.defaultLocale = self.options.defaultLocale || self.locales[0];
    // Make sure we have our own instance to avoid conflicts with other apos objects
    self.i18next = i18next.use(i18nextHttpMiddleware.LanguageDetector).createInstance({
      fallbackLng: self.options.fallbackLocale || 'en',
      // Quite noisy even for debug mode, use an environment variable
      debug: !!process.env.APOS_DEBUG_I18N,
      resources: {},
      interpolation: {
        // Nunjucks will already do this
        escapeValue: false
      }
    });
    await self.i18next.init();
    self.addInitialResources();
  },
  middleware(self) {
    return {
      init(req, res, next) {
        // Support for a single aposLocale query param that
        // also contains the mode, which is likely to occur
        // since we have the `aposLocale` property in docs
        // structured that way
        if (req.query.aposLocale && req.query.aposLocale.includes(':')) {
          const parts = req.query.aposLocale.split(':');
          req.query.aposLocale = parts[0];
          req.query.aposMode = parts[1];
        }
        const validModes = [ 'draft', 'published' ];
        let locale;
        if (self.isValidLocale(req.query.aposLocale)) {
          locale = req.query.aposLocale;
        } else {
          locale = self.defaultLocale;
        }
        let mode;
        if (validModes.includes(req.query.aposMode)) {
          mode = req.query.aposMode;
        } else {
          mode = 'published';
        }
        req.locale = locale;
        req.mode = mode;
        if ((req.mode === 'draft') && (!self.apos.permission.can(req, 'view-draft'))) {
          return res.status(403).send({
            name: 'forbidden'
          });
        }
        return next();
      },
      i18nextHttpMiddleware: i18nextHttpMiddleware.handle(self.i18next, {})
    };
  },
  methods(self) {
    return {
      // Add the i18next resources provided by the specified module,
      // merging with any existing phrases for the same locales and namespaces
      addResourcesForModule(module) {
        if (!module.options.i18n) {
          return;
        }
        const ns = module.options.i18n.ns || 'default';
        for (const entry of module.__meta.chain) {
          const localizationsDir = `${entry.dirname}/localizations`;
          if (!fs.existsSync(localizationsDir)) {
            continue;
          }
          for (const langFile of fs.readdirSync(localizationsDir)) {
            const data = JSON.parse(fs.readFileSync(`${localizationsDir}/${langFile}`));
            const locale = langFile.replace('.json', '');
            self.i18next.addResourceBundle(locale, ns, data, true, true);
          }
        }
      },
      // Adds i18next resources for modules initialized before the i18n module
      // itself, called by init. Later modules call addResourcesForModule(self),
      // making phrases available gradually as Apostrophe starts up
      addInitialResources() {
        for (const module of Object.values(self.apos.modules)) {
          self.addResourcesForModule(module);
        }
      },
      isValidLocale(locale) {
        return locale && self.locales.includes(locale);
      },
      // Infer `req.locale` and `req.mode` from `_id` if they were
      // not set already by explicit query parameters. Conversely,
      // if the appropriate query parameters were set, rewrite
      // `_id` accordingly. Returns `_id`, after rewriting if appropriate.
      inferIdLocaleAndMode(req, _id) {
        let [ cuid, locale, mode ] = _id.split(':');
        if (locale && mode) {
          if (!req.query.aposLocale) {
            req.locale = locale;
          } else {
            locale = req.locale;
          }
          if (!req.query.aposMode) {
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
        if ((req.mode === 'draft') && (!self.apos.permission.can(req, 'view-draft'))) {
          throw self.apos.error('forbidden');
        }
        if (_id.charAt(0) === '_') {
          // A shortcut such as _home or _archive,
          // will be interpreted later
          return _id;
        } else {
          return `${cuid}:${locale}:${mode}`;
        }
      }
    };
  }
};
