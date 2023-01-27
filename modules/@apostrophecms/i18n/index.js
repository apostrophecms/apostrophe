// This module makes an instance of the [i18next](https://npmjs.org/package/i18next) npm module available
// in Nunjucks templates via the `__t()` helper function. That function is also available on `req` objects
// as `req.t()`. Any options passed to this module are passed on to `i18next`.
//
// `apos.i18n.i18next` can be used to directly access the `i18next` npm module instance if necessary.
// It usually is not necessary. Use `req.t` if you need to localize in a route.

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

    const i18nextOptions = self.show ? {
      postProcess: 'apostropheI18nDebugPlugin'
    } : {};

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
            return res.redirect(`${req.url}/`);
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
              for (const localizationFile of fs.readdirSync(namespaceDir)) {
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
            ? (hostname === options.hostname.split(':')[0]) : null;
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
      },
      getBrowserData(req) {
        const i18n = {
          [req.locale]: self.getBrowserBundles(req.locale)
        };
        if (req.locale !== self.defaultLocale) {
          i18n[self.defaultLocale] = self.getBrowserBundles(self.defaultLocale);
        }
        // In case the default locale also has inadequate admin UI phrases
        if (!i18n.en) {
          i18n.en = self.getBrowserBundles('en');
        }
        const result = {
          i18n,
          locale: req.locale,
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
        verifyLocales(locales, self.apos.options.baseUrl);
        return locales;
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
          await self.apos.migration.eachDoc({ aposLocale: new RegExp(`^${self.apos.util.regExpQuote(oldLocale)}:`) }, async doc => {
            const newDoc = {
              ...doc,
              aposLocale: doc.aposLocale.replace(oldLocale, newLocale),
              _id: doc._id.replace(`:${oldLocale}`, `:${newLocale}`)
            };
            try {
              // Remove old first to cut down on duplicate key conflicts due to
              // custom properties
              await self.apos.doc.db.removeOne({ _id: doc._id });
              await self.apos.doc.db.insertOne(newDoc);
              renamed++;
            } catch (e) {
              // First reinsert old doc to prevent content loss on new doc insert failure
              await self.apos.doc.db.insertOne(doc);
              if (!self.apos.doc.isUniqueError(e)) {
                throw e;
              }
              const existing = await self.apos.doc.db.findOne({ _id: newDoc._id });
              if (!existing) {
                // We don't know the cause of this error
                throw e;
              }
              if (keep === newLocale) {
                // New content already exists in new locale, delete old locale
                // and keep new
                await self.apos.doc.db.removeOne({ _id: doc._id });
                kept++;
              } else if (keep === oldLocale) {
                // We want to keep the old locale's content. Once again we
                // need to remove the old doc first to cut down on conflicts
                try {
                  await self.apos.doc.db.removeOne({ _id: doc._id });
                  await self.apos.doc.db.deleteOne({ _id: newDoc._id });
                  await self.apos.doc.db.insertOne(newDoc);
                } catch (e) {
                  // Reinsert old doc to prevent content loss on new doc insert failure
                  await self.apos.doc.db.insertOne(doc);
                  throw e;
                }
                kept++;
              } else {
                console.error('A conflict occurred. Use --keep to specify a locale to keep and retry');
                throw e;
              }
            }
          });
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
