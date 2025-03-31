// This module makes an instance of the [i18next](https://npmjs.org/package/i18next) npm module available
// in Nunjucks templates via the `__t()` helper function. That function is also available on `req` objects
// as `req.t()`. Any options passed to this module are passed on to `i18next`.
//
// `apos.i18n.i18next` can be used to directly access the `i18next` npm module instance if necessary.
// It usually is not necessary. Use `req.t` if you need to localize in a route.
//
// ## Options
//
// ### `locales` TODO
//
// ### `defaultLocale` TODO
//
// ### `adminLocales`
//
// Controls what admin UI language can be set per user. If set, `adminLocale` user field
// will be automatically added to the user schema.
// Contains an array of objects with `label` and `value` properties:
// ```js
// {
//   label: 'English',
//   value: 'en'
// }
// ```
//
// ### `defaultAdminLocale`
//
// The default admin UI language. If `adminLocales` are configured, it should
// should match a `value` property from the list. Furthermore, it will be used
// as the default value for the`adminLocale` user field. If it is not set,
// but `adminLocales` is set, then the default is to display the admin UI
// in the same language as the website content.
// Example: `defaultLocale: 'fr'`.
//

const i18next = require('i18next');
const fs = require('fs');
const _ = require('lodash');
const { stripIndent } = require('common-tags');
const ExpressSessionCookie = require('express-session/session/cookie');
const path = require('path');
const { verifyLocales } = require('../../../lib/locales');

const apostropheI18nDebugPlugin = {
  type: 'postProcessor',
  name: 'apostropheI18nDebugPlugin',
  process(value, key, options, translator) {
    // The key is passed as an array (theoretically to include multiple keys).
    // We confirm that and grab the primary one for comparison.
    const l10nKey = Array.isArray(key) ? key[0] : key;

    if (value === l10nKey) {
      if (l10nKey.match(/^\S+:/)) {
        // The l10n key does not have a value assigned (or the key is
        // actually the same as the phrase). The key seems to have a
        // namespace, so might be from the Apostrophe UI.
        return `❌ ${value}`;
      } else {
        // The l10n key does not have a value assigned (or the key is
        // actually the same as the phrase). It is in the default namespace.
        return `🕳 ${value}`;
      }
    } else {
      // The phrase is fully localized.
      return `🌍 ${value}`;
    }
  }
};

module.exports = {
  options: {
    alias: 'i18n',
    i18n: {
      ns: 'apostrophe',
      browser: true
    }
  },
  async init(self) {
    self.defaultNamespace = 'default';
    self.namespaces = {};
    self.debug = process.env.APOS_DEBUG_I18N ? true : self.options.debug;
    self.show = process.env.APOS_SHOW_I18N ? true : self.options.show;
    self.locales = self.getLocales();
    self.hostnamesInUse = Object.values(self.locales).find(locale => locale.hostname);
    self.defaultLocale = self.options.defaultLocale || Object.keys(self.locales)[0];
    // Contains label/value object for each locale
    self.adminLocales = self.options.adminLocales || [];
    // Contains only the string value of the default admin locale (e.g. 'en').
    // If adminLocales are configured, it should be one of them. Otherwise,
    // it can be any valid locale string identifier.
    self.defaultAdminLocale = self.options.defaultAdminLocale || null;
    // Lint the locale configurations
    for (const [ key, options ] of Object.entries(self.locales)) {
      if (!options) {
        throw self.apos.error('invalid', `Locale "${key}" was not configured.`);
      }
      if (typeof key !== 'string' || !key.match(/^[a-zA-Z]/)) {
        throw self.apos.error('invalid', `Locale names must begin with a non-numeric, "word" character (a-z or A-Z). Check locale "${key}".`);
      }
      if (options.prefix && !options.prefix.match(/^\//)) {
        throw self.apos.error('invalid', `Locale prefixes must begin with a forward slash ("/"). Check locale "${key}".`);
      }
      if (options.prefix && options.prefix.match(/\/.*?\//)) {
        throw self.apos.error('invalid', `Locale prefixes must not contain more than one forward slash ("/").\nUse hyphens as separators. Check locale "${key}".`);
      }
    }
    if (!Array.isArray(self.adminLocales)) {
      throw self.apos.error('invalid', 'The "adminLocales" option must be an array.');
    }
    if (self.defaultAdminLocale && typeof self.defaultAdminLocale !== 'string') {
      throw self.apos.error('invalid', 'The "defaultAdminLocale" option must be a string.');
    }
    if (self.defaultAdminLocale && self.adminLocales.length && !self.adminLocales.some(al => al.value === self.defaultAdminLocale)) {
      throw self.apos.error('invalid', `The value of "defaultAdminLocale" "${self.defaultAdminLocale}" doesn't match any of the existing "adminLocales" values.`);
    }
    const fallbackLng = [ self.defaultLocale ];
    // In case the default locale also has inadequate admin UI phrases
    if (fallbackLng[0] !== 'en') {
      fallbackLng.push('en');
    }
    // Make sure we have our own instance to avoid conflicts with other apos objects
    self.i18next = i18next.createInstance({
      fallbackLng,
      // Required to prevent the debugger from complaining
      languages: Object.keys(self.locales),
      // Added later, but required here
      resources: {},
      interpolation: {
        // Nunjucks and Vue will already do this
        escapeValue: false
      },
      defaultNS: self.defaultNamespace,
      debug: self.debug
    });
    if (self.show) {
      self.i18next.use(apostropheI18nDebugPlugin);
    }

    const i18nextOptions = self.show
      ? {
        postProcess: 'apostropheI18nDebugPlugin'
      }
      : {};

    await self.i18next.init(i18nextOptions);
    self.addInitialResources();
    self.enableBrowserData();
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        addModal() {
          self.addLocalizeModal();
        }
      },
      '@apostrophecms/page:beforeSend': {
        // Developers can link to alternate locales by iterating over
        // `data.localizations` in any page template. Each element always has
        // `locale`, `label` and `homePageUrl` properties. Each element also has an
        // `available` property; if true, the current context document is available
        // in that locale, `title` and a small number of other document properties are
        // populated, and `_url` redirects to the context document in that locale.
        //
        // The array is provided in the order in which locales are configured.
        // The current locale is included and has the property `current: true`.
        async addLocalizations(req) {
          const context = req.data.piece || req.data.page;
          if (!context) {
            return;
          }
          const manager = self.apos.doc.getManager(context.type);
          if (!manager.isLocalized()) {
            return;
          }
          const localizations = await self.apos.doc.db.find({
            aposDocId: context.aposDocId,
            aposMode: req.mode
          }).project({
            type: 1,
            title: 1,
            slug: 1,
            aposLocale: 1,
            aposMode: 1,
            visibility: 1,
            docPermissions: 1
          }).toArray();
          req.data.localizations = [];
          for (const name of Object.keys(self.locales)) {
            const localeReq = self.apos.util.cloneReq(req, {
              locale: name
            });
            self.setPrefixUrls(localeReq);
            const doc = localizations.find(doc => doc.aposLocale.split(':')[0] === name);
            if (doc && self.apos.permission.can(req, 'view', doc)) {
              doc.available = true;
              doc._url = `${self.apos.prefix}${manager.action}/${context._id}/locale/${name}`;
              if (doc._id === context._id) {
                doc.current = true;
              }
            }
            const info = doc || {};
            info.locale = name;
            info.label = self.locales[name].label;
            info.homePageUrl = `${localeReq.prefix}/`;
            req.data.localizations.push(info);
          }
        }
      }
    };
  },
  middleware(self) {
    return {
      async acceptCrossDomainSessionToken(req, res, next) {
        let crossDomainSessionToken = req.query.aposCrossDomainSessionToken;
        if (!crossDomainSessionToken) {
          return next();
        }
        crossDomainSessionToken = self.apos.launder.string(crossDomainSessionToken);
        try {
          const sessionData = await self.apos.cache.get('@apostrophecms/i18n:cross-domain-sessions', crossDomainSessionToken);
          for (const key of Object.keys(req.session)) {
            delete req.session[key];
          }
          Object.assign(req.session, sessionData || {});
          await self.apos.cache.set('@apostrophecms/i18n:cross-domain-sessions', crossDomainSessionToken, null);
        } catch (e) {
          self.apos.util.error(e);
        }
        // Since the req.session object at this stage is just
        // a plain Javascript object, getters and setters of
        // the Cookie prototype from the express-session module
        // (like req.session.cookie.data) are unavailable and
        // will return 'undefined' when called internally by the
        // express-session module. This ends up corrupting the
        // set-cookie headers generated by the express-session
        // module, thus breaking sessions. The express-session
        // module normally generates an instance of its Cookie
        // prototype which contains these methods and expects
        // that interface always to function properly. To ensure
        // this, we re-instantiate req.session.cookie as an
        // instance of the Cookie class from the express-session
        // module to ensure that the sessions remain intact even
        // across domains. Note that we use the cookie settings
        // from the Apostrophe Express module to ensure that user
        // defined cookie settings are respected.
        const aposExpressModule = self.apos.modules['@apostrophecms/express'];
        req.session.cookie = new ExpressSessionCookie(aposExpressModule.sessionOptions.cookie);
        return res.redirect(self.apos.url.build(req.url, { aposCrossDomainSessionToken: null }));
      },
      // If the `redirectToFirstLocale` option is enabled
      // and the homepage is requested,
      // redirects to the first locale configured with the
      // current requested hostname when all of the locales
      // configured with that hostname do have a prefix.
      //
      // However, if the request does not match any explicit
      // hostnames assigned to locales, redirects to the first
      // locale that does not have a configured hostname, if
      // all the locales without a hostname do have a prefix.
      redirectToFirstLocale(req, res, next) {
        if (!self.options.redirectToFirstLocale) {
          return next();
        }
        if (req.path !== '' && req.path !== '/') {
          return next();
        }

        const locales = Object.values(
          self.filterPrivateLocales(req, self.locales)
        );
        const localesWithoutHostname = locales.filter(
          locale => !locale.hostname
        );
        const localesWithCurrentHostname = locales.filter(
          locale => locale.hostname && locale.hostname.split(':')[0] === req.hostname
        );

        const localesToCheck = localesWithCurrentHostname.length
          ? localesWithCurrentHostname
          : localesWithoutHostname;

        if (!localesToCheck.length || !localesToCheck.every(locale => locale.prefix)) {
          return next();
        }

        // Add / for home page and to avoid being redirected again in the `locale` middleware:
        const redirectUrl = `${localesToCheck[0].prefix}/`;

        return res.redirect(redirectUrl);
      },
      locale(req, res, next) {
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
          locale = self.matchLocale(req);
        }
        const locales = self.filterPrivateLocales(req, self.locales);
        const localeOptions = locales[locale];
        if (localeOptions.prefix) {
          // Remove locale prefix so URL parsing can proceed normally from here
          if (req.path === localeOptions.prefix) {
            // Add / for home page
            req.redirect = `${req.url}/`;
          }
          if (req.path.substring(0, localeOptions.prefix.length + 1) === localeOptions.prefix + '/') {
            req.path = req.path.replace(localeOptions.prefix, '');
            req.url = req.url.replace(localeOptions.prefix, '');
            const superRedirect = res.redirect;
            res.redirect = function (status, url) {
              if (arguments.length === 1) {
                url = status;
                status = 302;
              }
              if (!url.match(/^[a-zA-Z]+:/)) {
                // We don't need all of req.prefix here because
                // the global site prefix middleware already extended
                // res.redirect once
                url = localeOptions.prefix + url;
              }
              return superRedirect.call(this, status, url);
            };
          }
        }
        let mode;
        if (validModes.includes(req.query.aposMode)) {
          mode = req.query.aposMode;
        } else {
          mode = 'published';
        }
        req.locale = locale;
        req.mode = mode;
        self.setPrefixUrls(req);
        if ((req.mode === 'draft') && (!self.apos.permission.can(req, 'view-draft'))) {
          return res.status(403).send({
            name: 'forbidden'
          });
        }
        _.defaults(req.data, _.pick(req, 'baseUrl', 'baseUrlWithPrefix', 'absoluteUrl'));
        return next();
      },
      localize(req, res, next) {
        req.t = (key, options = {}) => {
          return self.i18next.t(key, {
            ...options,
            lng: req.locale
          });
        };
        req.__ = key => {
          self.apos.util.warnDevOnce('old-i18n-req-helper', stripIndent`
            The req.__() and res.__() functions are deprecated and do not localize in A3.
            Use req.t instead.
          `);
          return key;
        };
        req.res.__ = req.__;
        return next();
      }
    };
  },
  apiRoutes(self) {
    return {
      get: {
        locales(req) {
          return self.locales;
        },
        async localesPermissions(req) {
          const action = self.apos.launder.string(req.query.action);
          const type = self.apos.launder.string(req.query.type);
          const locales = self.apos.launder.strings(req.query.locales);
          const allowed = await self.getLocalesPermissions(req, action, type, locales);

          return allowed;
        }
      },
      post: {
        async locale(req) {
          const sanitizedLocale = self.sanitizeLocaleName(req.body.locale);
          if (!sanitizedLocale) {
            throw self.apos.error('invalid', 'invalid locale');
          }
          // Clipboards transferring between locales needs to jump
          // from LocalStorage to the cross-domain session cache
          let clipboard = req.body.clipboard;
          if (clipboard && ((typeof clipboard) !== 'string')) {
            // Clipboard re-validation doesn't have to be more detailed here because
            // on any actual paste attempt it will go through server side validation
            // like any normal insert of a widget
            clipboard = null;
          }
          const _id = self.apos.launder.id(req.body.contextDocId);
          let doc;
          const localeReq = req.clone({
            locale: sanitizedLocale
          });
          if (_id) {
            doc = await self.apos.doc.find(localeReq, {
              aposDocId: _id.split(':')[0]
            }).toObject();
            if (!doc) {
              const publishedLocaleReq = localeReq.clone({ mode: 'draft' });
              doc = await self.apos.doc.find(publishedLocaleReq, {
                aposDocId: _id.split(':')[0]
              }).toObject();
            }
          }
          if (!sanitizedLocale) {
            throw self.apos.error('invalid');
          }
          const result = {};
          if (doc && doc._url) {
            result.redirectTo = doc && doc._url;
          } else {
            // No matching document, so as a fallback go to the home page
            // with the appropriate prefix
            result.redirectTo = localeReq.prefix;
          };
          if (self.locales[localeReq.locale].hostname !== self.locales[req.locale].hostname) {
            const crossDomainSessionToken = self.apos.util.generateId();
            const session = {
              ...req.session,
              aposCrossDomainClipboard: clipboard
            };
            await self.apos.cache.set('@apostrophecms/i18n:cross-domain-sessions', crossDomainSessionToken, session, 60 * 60);
            result.redirectTo = self.apos.url.build(result.redirectTo, {
              aposCrossDomainSessionToken: crossDomainSessionToken
            });
          }
          return result;
        },
        // Fast bulk query for doc `ids` that exist in the given `locale`.
        // `ids` may contain `_id` or `aposDocId` values.
        //
        // The response object contains `originalLocaleIds`, `newLocaleIds` and
        // `aposDocIds` arrays. Any documents not existing in `locale`
        // will not be included in these arrays.
        //
        // The original mode and locale are inferred from the given
        // `ids`, or from the request.
        //
        // This route is a POST route because large numbers of ids
        // might not be accepted as a query string.
        async existInLocale(req) {
          if (!req.user) {
            throw self.apos.error('notfound');
          }
          const ids = self.apos.launder.ids(req.body.ids);
          const locale = self.apos.launder.string(req.body.locale);
          const originalLocale = (ids[0] && ids[0].split(':')[1]) || req.locale;
          const originalMode = (ids[0] && ids[0].split(':')[2]) || req.mode;
          const mode = self.apos.launder.string(req.body.mode, originalMode);
          if (!self.isValidLocale(locale)) {
            throw self.apos.error('invalid');
          }
          const found = await self.apos.doc.db.find({
            aposLocale: `${locale}:${mode}`,
            aposDocId: {
              $in: ids.map(self.apos.doc.toAposDocId)
            }
          }).project({
            _id: 1,
            aposDocId: 1
          }).toArray();
          const result = {
            originalLocaleIds: found.map(doc => `${doc.aposDocId}:${originalLocale}:${originalMode}`),
            newLocaleIds: found.map(doc => doc._id),
            aposDocIds: found.map(doc => doc.aposDocId)
          };
          return result;
        }
      }
    };
  },
  methods(self) {
    return {
      // Add the i18next resources provided by the specified module,
      // merging with any existing phrases for the same locales and namespaces
      addResourcesForModule(module) {
        self.addDefaultResourcesForModule(module);
        self.addNamespacedResourcesForModule(module);
      },
      // Automatically adds any localizations found in .json files in the main `i18n` subdirectory
      // of a module.
      //
      // These are added to the `default` namespace, unless the legacy `i18n.ns` option is set
      // for the module (not the preferred way, use namespace subdirectories in new projects).
      addDefaultResourcesForModule(module) {
        const ns = (module.options.i18n && module.options.i18n.ns) || 'default';
        self.namespaces[ns] = self.namespaces[ns] || {};
        self.namespaces[ns].browser = self.namespaces[ns].browser || (module.options.i18n && module.options.i18n.browser);
        for (const entry of module.__meta.chain) {
          const localizationsDir = path.join(entry.dirname, 'i18n');
          if (!self.defaultLocalizationsDirsAdded.has(localizationsDir)) {
            self.defaultLocalizationsDirsAdded.add(localizationsDir);
            if (!fs.existsSync(localizationsDir)) {
              continue;
            }
            for (const localizationFile of fs.readdirSync(localizationsDir)) {
              if (!localizationFile.endsWith('.json')) {
                // Likely a namespace subdirectory
                continue;
              }
              const data = JSON.parse(fs.readFileSync(path.join(localizationsDir, localizationFile)));
              const locale = localizationFile.replace('.json', '');
              self.i18next.addResourceBundle(locale, ns, data, true, true);
            }
          }
        }
      },
      // Automatically adds any localizations found in subdirectories of the main `i18n`
      // subdirectory of a module. The subdirectory's name is treated as an i18n namespace
      // name.
      addNamespacedResourcesForModule(module) {
        for (const entry of module.__meta.chain) {
          const metadata = module.__meta.i18n[entry.name] || {};
          const localizationsDir = `${entry.dirname}/i18n`;
          if (!self.namespacedLocalizationsDirsAdded.has(localizationsDir)) {
            self.namespacedLocalizationsDirsAdded.add(localizationsDir);
            if (!fs.existsSync(localizationsDir)) {
              continue;
            }
            for (const ns of fs.readdirSync(localizationsDir)) {
              if (ns.endsWith('.json')) {
                // A JSON file for the default namespace, already handled
                continue;
              }
              self.namespaces[ns] = self.namespaces[ns] || {};
              self.namespaces[ns].browser = self.namespaces[ns].browser ||
                (metadata[ns] && metadata[ns].browser);
              const namespaceDir = path.join(localizationsDir, ns);
              if (!fs.statSync(namespaceDir).isDirectory()) {
                // Skip non-directory items, such as hidden files
                continue;
              }
              for (const localizationFile of fs.readdirSync(namespaceDir)) {
                if (!localizationFile.endsWith('.json')) {
                  // Exclude parsing of non-JSON files, like hidden files, in the namespace directory
                  continue;
                }
                const fullLocalizationFile = path.join(namespaceDir, localizationFile);
                const data = JSON.parse(fs.readFileSync(fullLocalizationFile));
                const locale = localizationFile.replace('.json', '');
                self.i18next.addResourceBundle(locale, ns, data, true, true);
              }
            }
          }
        }
      },
      // Adds i18next resources for modules initialized before the i18n module
      // itself, called by init. Later modules call addResourcesForModule(self),
      // making phrases available gradually as Apostrophe starts up
      addInitialResources() {
        self.defaultLocalizationsDirsAdded = new Set();
        self.namespacedLocalizationsDirsAdded = new Set();
        for (const module of Object.values(self.apos.modules)) {
          self.addResourcesForModule(module);
        }
      },
      isValidLocale(locale) {
        return locale && has(self.locales, locale);
      },
      // Return the best matching locale for the request based on the hostname
      // and path prefix. If available the first locale matching both
      // hostname and prefix is returned, otherwise the first matching locale
      // that specifies only a hostname or only a prefix. If no matches are
      // possible the default locale is returned.
      matchLocale(req) {
        const hostname = req.hostname;
        const locales = self.filterPrivateLocales(req, self.locales);
        let best = false;
        for (const [ name, options ] of Object.entries(locales)) {
          const matchedHostname = options.hostname
            ? (hostname === options.hostname.split(':')[0])
            : null;
          const matchedPrefix = options.prefix
            ? ((req.path === options.prefix) || req.path.startsWith(options.prefix + '/'))
            : null;
          if (options.hostname && options.prefix) {
            if (matchedHostname && matchedPrefix) {
              // Best possible match
              return name;
            }
          } else if (options.hostname) {
            if (matchedHostname) {
              if (!best) {
                best = name;
              }
            }
          } else if (options.prefix) {
            if (matchedPrefix) {
              if (!best) {
                best = name;
              }
            }
          }
        }
        return best || self.defaultLocale;
      },
      // Infer `req.locale` and `req.mode` from `_id` if they were
      // not set already by explicit query parameters. Conversely,
      // if the appropriate query parameters were set, rewrite
      // `_id` accordingly. Returns `_id`, after rewriting if appropriate.
      inferIdLocaleAndMode(req, _id) {
        let [ id, locale, mode ] = _id.split(':');
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
          return `${id}:${locale}:${mode}`;
        }
      },
      getBrowserData(req) {
        const adminLocale = req.user?.adminLocale === ''
          ? req.locale
          : req.user?.adminLocale || self.defaultAdminLocale || req.locale;
        const i18n = {
          [adminLocale]: self.getBrowserBundles(adminLocale)
        };
        if (adminLocale !== self.defaultLocale) {
          i18n[self.defaultLocale] = self.getBrowserBundles(self.defaultLocale);
        }
        // In case the default locale also has inadequate admin UI phrases
        if (!i18n.en) {
          i18n.en = self.getBrowserBundles('en');
        }
        const result = {
          i18n,
          locale: req.locale,
          adminLocale,
          defaultLocale: self.defaultLocale,
          defaultNamespace: self.defaultNamespace,
          locales: self.locales,
          debug: self.debug,
          show: self.show,
          action: self.action,
          crossDomainClipboard: req.session && req.session.aposCrossDomainClipboard
        };
        if (req.session && req.session.aposCrossDomainClipboard) {
          req.session.aposCrossDomainClipboard = null;
        }
        return result;
      },
      getBrowserBundles(locale) {
        const i18n = {};
        for (const [ name, options ] of Object.entries(self.namespaces)) {
          if (options.browser) {
            i18n[name] = self.i18next.getResourceBundle(locale, name);
            if (!i18n[name]) {
              // Attempt fallback to language only. This is not
              // the full fallback support of i18next because that
              // is difficult to tap into when calling getResourceBundle,
              // but it should work for most situations
              const [ lang, country ] = locale.split('-');
              if (country) {
                i18n[name] = self.i18next.getResourceBundle(lang, name);
              }
            }
          }
        }
        return i18n;
      },
      getLocales() {
        const locales = self.options.locales || {
          en: {
            label: 'English'
          }
        };
        for (const locale in locales) {
          locales[locale]._edit = true;
        }
        verifyLocales(locales, self.apos.options.baseUrl);
        return locales;
      },
      async getLocalesPermissions(req, action, type, locales) {
        const allowed = [];
        for (const locale of locales) {
          const clonedReq = req.clone({
            locale
          });
          if (await self.apos.permission.can(clonedReq, action, type)) {
            allowed.push(locale);
          }
        }
        return allowed;
      },
      sanitizeLocaleName(locale) {
        locale = self.apos.launder.string(locale);
        if (!has(self.locales, locale)) {
          return null;
        }
        return locale;
      },
      addLocalizeModal() {
        self.apos.modal.add(
          `${self.__meta.name}:localize`,
          self.getComponentName('localizeModal', 'AposI18nLocalize'),
          { moduleName: self.__meta.name }
        );
      },
      setPrefixUrls(req) {
        // In a production-like environment, use req.hostname, otherwise the Host header
        // to allow port numbers in dev.
        //
        // Watch out for modules that won't be set up if this is an afterInit task in an
        // early module like the asset module
        const host = (process.env.NODE_ENV === 'production') ? req.hostname : req.get('Host');
        const fallbackBaseUrl = `${req.protocol}://${host}`;
        if (self.hostnamesInUse) {
          req.baseUrl = (self.apos.page && self.apos.page.getBaseUrl(req)) || fallbackBaseUrl;
        } else {
          req.baseUrl = self.apos.page && self.apos.page.getBaseUrl(req);
        }
        req.baseUrlWithPrefix = `${req.baseUrl}${self.apos.prefix}`;
        req.absoluteUrl = req.baseUrlWithPrefix + req.url;
        req.prefix = `${req.baseUrlWithPrefix}${self.locales[req.locale].prefix || ''}`;
        if (!req.baseUrl) {
          // Always set for bc, but in the absence of locale hostnames we
          // set it later so it is not part of req.prefix
          req.baseUrl = fallbackBaseUrl;
        }
      },
      // Returns an Express route suitable for use in a module
      // like a piece type or the page module. The returned route will
      // expect req.params._id and req.params.toLocale and redirect,
      // if possible, to the corresponding version in toLocale.
      toLocaleRouteFactory(module) {
        return async (req, res) => {
          try {
            const _id = module.inferIdLocaleAndMode(req, req.params._id);
            const toLocale = self.sanitizeLocaleName(req.params.toLocale);
            if (!toLocale) {
              return res.status(400).send('invalid locale name');
            }
            const localeReq = req.clone({
              locale: toLocale
            });
            const corresponding = await module.find(localeReq, {
              _id: `${_id.split(':')[0]}:${localeReq.locale}:${localeReq.mode}`
            }).toObject();
            if (!corresponding) {
              return res.status(404).send('not found');
            }
            if (!corresponding._url) {
              return res.status(400).send('invalid (has no URL)');
            }
            return res.redirect(corresponding._url);
          } catch (e) {
            self.apos.util.error(e);
            return res.status(500).send('error');
          }
        };
      },
      // Exclude private locales when logged out
      filterPrivateLocales(req, locales) {
        return req.user
          ? locales
          : Object.fromEntries(
            Object
              .entries(locales)
              .filter(([ name, options ]) => options.private !== true)
          );
      },
      // Rename a locale. This is time consuming and should be
      // avoided when possible. If `keep` is present it must be set
      // to either `oldLocale` or `newLocale` and indicates which version
      // is kept in the event of a conflict
      async rename(oldLocale, newLocale, { keep } = {}) {
        let renamed = 0;
        let kept = 0;
        if (!oldLocale) {
          throw new Error('You must specify --old');
        }
        if (!newLocale) {
          throw new Error('You must specify --new');
        }
        if (oldLocale === newLocale) {
          throw new Error('The old and new locales must be different');
        }
        if (keep && (!(keep === oldLocale) && !(keep === newLocale))) {
          throw new Error('--keep must match --old or --new');
        }
        const ids = await self.apos.doc.db.find({ aposLocale: new RegExp(`^${self.apos.util.regExpQuote(oldLocale)}:`) }).project({ _id: 1 }).toArray();
        ({
          renamed,
          kept
        } = await self.apos.doc.changeDocIds(ids.map(doc => [ doc._id, doc._id.replace(`:${oldLocale}`, `:${newLocale}`) ]), {
          keep: (keep === oldLocale) ? 'old' : (keep === newLocale) ? 'new' : false
        }));
        return {
          renamed,
          kept
        };
      },
      // Localize a batch of documents.
      //
      // The `req.body` object must have properties
      // - `_ids`: an array of document `_id` values.
      // - `relatedTypes`: an array of related doc types to be localized in case
      //    they are found in the batch of documents to localize.
      // - `toLocales`: an array of locales to localize the documents to.
      // - `update`: a boolean indicating whether to localize existing related documents.
      // - `relatedOnly`: a boolean indicating whether to only localize related documents
      //    and skip the parent documents (`_ids`).
      //
      // Automatic translation instructions may be included in the `req.query` object:
      // - `aposTranslateProvider`: the unique name of the translation provider.
      // - `aposLocale`: the locale to translate from.
      // Note that without these instructions, the signal to the automatic translation
      // service will not be sent.
      //
      // `manager` is the `self` object of the module that is localizing the documents.
      // If the batch is a set of pages, `manager` should be an instance of
      // `@apostrophecms/page`. For pieces, `manager` should be an instance of
      // the piece type module.
      // `reporting` is an optional object that can be used to report progress. See
      // the `@apostrophecms/job` module for more information.
      //
      // The handler will return a log, array of objects with the following properties:
      // - `id`: the document `_id` value
      // - `aposId`: the document `aposDocId` value
      // - `type`: the document type, can be `null` if the document is not found
      // - `title`: the document title, can be `null` if the document is not found
      // - `relationship`: the `aposDocId` of the parent document,
      //    or `false` if the document is the parent.
      // - `error`: a boolean or string `reason` indicating whether an error
      //   occurred during localization. If `error` is a string, it will contain
      //   the error name. See `@apostrophecms/error` and `@apostrophecms/http` modules.
      // - `detail`: optional string (i18n key) explaining the error.
      async localizeBatch(req, manager, reporting = null) {
        if (!req.user) {
          throw self.apos.error('forbidden');
        }
        if (!Array.isArray(req.body._ids)) {
          throw self.apos.error('invalid');
        }
        if (!Array.isArray(req.body.toLocales)) {
          throw self.apos.error('invalid');
        }

        const ids = self.apos.launder.ids(req.body._ids)
          .map(id => self.inferIdLocaleAndMode(req, id));
        if (reporting) {
          reporting.setTotal(ids.length);
        }

        const toLocales = self.apos.launder.strings(req.body.toLocales)
          .filter(toLocale => !!self.sanitizeLocaleName(toLocale));
        const update = self.apos.launder.boolean(req.body.update);
        const relatedTypes = new Set(
          self.apos.launder.strings(req.body.relatedTypes)
        );
        normalizeTypes(relatedTypes);
        const relatedOnly = self.apos.launder.boolean(req.body.relatedOnly);

        // Result log used for batch reporting
        const log = [];
        // Global set to avoid duplicate processing
        const seen = new Set();

        for (const id of ids) {
          let doc;
          try {
            [ doc ] = await getDocs(req, manager, {
              ids: [ id ]
            });
          } catch (e) {
            logMissing(id, log, reporting);
            self.logError(
              req,
              'localize-batch-doc-error',
              'Error finding document',
              {
                id,
                error: e.message,
                stack: e.stack.split('\n').slice(1).map(line => line.trim())
              }
            );
            continue;
          }
          await localizeDoc(
            req,
            reporting,
            {
              doc,
              relatedTypes,
              toLocales,
              update,
              relatedOnly,
              log,
              seen
            }
          );
        }
        if (reporting) {
          reporting.setResults({
            log,
            ids
          });
        }
        self.logDebug(req, 'localize-batch-result', 'Batch localization complete', {
          log,
          ids
        });
        return log;

        // Convert the "any page types" to actual page types
        async function normalizeTypes(types) {
          if (types.has('@apostrophecms/page') || types.has('@apostrphecms/any-page-type')) {
            self.apos.instancesOf('@apostrophecms/page-type')
              .map(module => module.__meta.name)
              .forEach(type => types.add(type));
            types.delete('@apostrophecms/page');
            types.delete('@apostrophecms/any-page-type');
          }
        }

        function logMissing(id, log, reporting) {
          log.push({
            _id: id,
            aposDocId: id.split(':')[0],
            type: null,
            title: null,
            relationship: false,
            error: 'apostrophe:notFound'
          });
          if (reporting) {
            reporting.failure();
          }
        }

        // Get documents for localization
        async function getDocs(req, manager, { ids }) {
          if (!ids.length) {
            return [];
          }
          const docs = await manager
            .findForEditing(req.clone({ mode: 'draft' }), {
              _id: { $in: ids }
            })
            .toArray();

          return docs;
        }

        // Check if the document can be localized, retrieve related documents
        // if necessary, and localize the documents to the specified locales.
        async function localizeDoc(req, reporting, {
          doc,
          relatedTypes,
          toLocales,
          update,
          relatedOnly,
          log = [],
          seen = new Set()
        }) {
          const docs = [];
          if (seen.has(doc.aposDocId)) {
            return log;
          }
          seen.add(doc.aposDocId);
          if (!canLocalize(req, doc, false)) {
            log.push({
              _id: doc._id,
              aposDocId: doc.aposDocId,
              type: doc.type,
              title: doc.title,
              relationship: false,
              error: true
            });
            self.logError(
              req,
              'localize-batch-can-localize-error',
              'The document type can\'t be localized or insufficient permissions',
              {
                id: doc._id,
                type: doc.type,
                title: doc.title,
                relationship: false
              }
            );
            if (reporting) {
              reporting.failure();
            }
            return log;
          }
          if (!relatedOnly) {
            docs.push(doc);
          }

          if (relatedTypes.size > 0) {
            try {
              await findRelatedDocs(req.clone({ mode: 'draft' }), {
                doc,
                schema: self.apos.modules[doc.type].schema,
                relatedTypes,
                memo: docs,
                seen
              });
            } catch (e) {
              self.logError(
                req,
                'localize-batch-related-error',
                'Error finding related documents',
                {
                  id: doc._id,
                  type: doc.type,
                  title: doc.title,
                  error: e.message,
                  stack: e.stack.split('\n').slice(1).map(line => line.trim())
                }
              );
              if (reporting) {
                reporting.failure();
              }
              return log;
            }
          }

          let hasError = false;
          for (const item of docs) {
            const manager = self.apos.doc.getManager(item.type);
            // Not using Promise.allSettled because of potential
            // rate limit issues with external services when i.e.
            // automatically translating content.
            // Related info:
            // https://cookbook.openai.com/examples/how_to_handle_rate_limits
            for (const locale of toLocales) {
              const payload = {
                _id: item._id,
                aposDocId: item.aposDocId,
                locale,
                type: item.type,
                title: item.title,
                relationship: item.aposDocId !== doc.aposDocId ? doc.aposDocId : false,
                error: false
              };
              try {
                await manager.localize(req, item, locale, {
                  update: !payload.relationship ? true : update,
                  batch: true
                });
                log.push(payload);
              } catch (e) {
                hasError = true;
                payload.error = e.name ?? true;
                // This is the only detail that we know of.
                // XXX A better way to handle data sent to the UI as a
                // human-readable message is a standard error payload property.
                // For example `error.data.detail`.
                if (e.data?.parentNotLocalized) {
                  payload.detail = req.t('apostrophe:parentNotLocalized');
                } else {
                  payload.detail = e.data?.detail ? req.t(e.data.detail) : null;
                }
                log.push(payload);
                // Do not flood the logs with errors that are expected
                const fn = e.name === 'conflict' ? 'logDebug' : 'logError';
                const id = e.name === 'conflict'
                  ? 'localize-batch-doc-conflict'
                  : 'localize-batch-doc-error';
                self[fn](req, id, {
                  ...payload,
                  error: e.message,
                  reason: e.name,
                  stack: e.stack.split('\n').slice(1).map(line => line.trim())
                });
              }
            }
          }

          // Advance the progress bar so that if the main document fails,
          // the batch progress will report the correct number of failures.
          // The detailed result should be printed in a custom notification.
          if (reporting) {
            const status = hasError
              ? 'failure'
              : 'success';
            reporting[status]();
          }

          return log;
        }

        // Find related documents for localization
        async function findRelatedDocs(req, {
          doc, schema, relatedTypes, memo, seen
        }) {
          if (!schema) {
            return;
          }

          const partialDocs = getRelatedBySchema(req, doc, schema, seen)
            .filter(doc => relatedTypes.has(doc.type))
            .filter(doc => canLocalize(req, doc, true));

          const idsByType = partialDocs
            .reduce((acc, doc) => {
              acc[doc.type] ||= [];
              acc[doc.type].push(doc._id);
              return acc;
            }, {});
          const promises = Object.entries(idsByType)
            .map(([ type, ids ]) => {
              return getDocs(req, self.apos.doc.getManager(type), {
                ids
              });
            });
          const results = await Promise.allSettled(promises);
          return results.filter(result => result.status === 'fulfilled')
            .map(result => {
              memo.push(...result.value);
              return result.value;
            })
            .flat();
        }

        // Get related documents by schema
        function getRelatedBySchema(req, object, schema, seen) {
          const related = [];
          for (const field of schema || []) {
            switch (field.type) {
              case 'array': {
                for (const value of (object[field.name] || [])) {
                  related.push(...getRelatedBySchema(req, value, field.schema, seen));
                }
                break;
              }

              case 'object': {
                if (object[field.name]) {
                  related.push(
                    ...getRelatedBySchema(req, object[field.name], field.schema, seen)
                  );
                }
                break;
              }

              case 'area': {
                for (const widget of (object[field.name]?.items || [])) {
                  related.push(
                    ...getRelatedBySchema(
                      req,
                      widget,
                      self.apos.modules[`${widget?.type}-widget`]?.schema || [],
                      seen
                    )
                  );
                }
                break;
              }

              case 'relationship': {
                for (const item of (object[field.name] || [])) {
                  const id = item._id?.split(':')[0];
                  if (!id || seen.has(id)) {
                    continue;
                  }
                  related.push(item);
                  seen.add(id);
                }
                break;
              }

              default:
                // No-op
                break;
            }
          }

          return related;
        }

        // Filter out related doc types that opt out completely (pages should
        // never be considered "related" to other pages simply because
        // of navigation links, the feature is meant for pieces that feel more like
        // part of the document being localized)
        // We also remove non localized content like users and check for permissions.
        function canLocalize(req, doc, related) {
          if (!self.apos.modules[doc.type]) {
            return false;
          }
          if (self.apos.modules[doc.type].options?.localized === false) {
            return false;
          }
          if (related && self.apos.modules[doc.type].options?.relatedDocument === false) {
            return false;
          }
          return self.apos.permission.can(req, 'edit', doc.type);
        }
      }
    };
  },
  tasks(self) {
    return {
      'rename-locale': {
        usage: 'Usage: node app @apostrophecms/i18n:rename-locale --old=de-DE --new=de-de --keep=de-de',
        async task(argv) {
          const oldLocale = self.apos.launder.string(argv.old);
          const newLocale = self.apos.launder.string(argv.new);
          const keep = self.apos.launder.string(argv.keep);
          const {
            renamed,
            kept
          } = await self.rename(oldLocale, newLocale, { keep });
          console.log(`Renamed ${renamed} documents from ${oldLocale} to ${newLocale}`);
          if (keep) {
            console.log(`Due to conflicts, kept ${kept} documents from ${keep}`);
          }
        }
      }
    };
  }
};

function has(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}
