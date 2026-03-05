const fs = require('fs');
const { stripIndent } = require('common-tags');

const sitemapCacheName = 'apos-sitemap';

const noBaseUrlWarning = stripIndent`
  ⚠️ You must specify the site-level baseUrl option for the  application when
  configuring Apostrophe to use sitemap indexes.

  Example: \`baseUrl: "https://mycompany.com"\` (no trailing slash)

  Usually you will only do this in \`data/local.js\` in production.
`;

module.exports = {
  options: {
    alias: 'sitemap'
  },
  init(self, options) {
    self.updatingCache = true;
    // Cache sitemaps for 1 hour by default. Depending on page rank Google may
    // look at your sitemap somewhere between daily and monthly, so don't get
    // your hopes up too far about changing this
    self.cacheLifetime = 60 * 60;

    if (typeof options.cacheLifetime === 'number' && options.cacheLifetime > 0) {
      self.cacheLifetime = options.cacheLifetime;
    } else if (options.cacheLifetime || options.cacheLifetime === 0) {
      self.apos.util.warn('⚠️ The sitemap cacheLifetime option must be a number greater than zero.');
    }

    self.baseUrl = self.apos.baseUrl;

    if (!self.baseUrl) {
      throw new Error(noBaseUrlWarning);
    }

    self.defaultLocale = self.apos.i18n.defaultLocale;
  },
  tasks (self) {
    return {
      print: {
        usage: 'Print a sitemap',
        async task (argv) {
          return self.mapTask(false);
        }
      },
      'update-cache': {
        usage: 'Update the sitemap cache',
        async task (argv) {
          return self.mapTask(true);
        }
      },
      clear: {
        usage: 'Clear the existing sitemap',
        async task (argv) {
          // Just forget the current sitemaps to make room
          // for regeneration on the next request
          return self.apos.cache.clear(sitemapCacheName);
        }
      }
    };
  },
  routes (self) {
    return {
      get: {
        '/sitemap.xml': async function(req, res) {
          return self.sendCache(req, res, 'sitemap.xml');
        },
        '/sitemaps/*': async function(req, res) {
          return self.sendCache(req, res, 'sitemaps/' + req.params[0]);
        }
      }
    };
  },
  handlers(self) {
    return {
      '@apostrophecms/url:getAllUrlMetadata': {
        // Provide literal content entries so static builds
        // can include the dynamically generated sitemap XML files.
        // URLs must be relative and prefix-free — the
        // consumer prepends the prefix when fetching.
        addSitemapFiles(req, results) {
          // Sitemap files are site-wide (not per-locale),
          // so only include them for the default locale to avoid
          // duplicates during per-locale static builds.
          // TODO: in the future when per one locale static builds are supported,
          // use the current locale if it has configured host, for path prefixes
          // the behavior is the same.
          if (req.locale !== self.apos.i18n.defaultLocale) {
            return;
          }
          if (self.options.perLocale) {
            results.push({
              url: '/sitemaps/index.xml',
              contentType: 'text/xml',
              i18nId: '@apostrophecms/sitemap:index',
              sitemap: false
            });
            const locales = Object.keys(self.apos.i18n.getLocales());
            for (const locale of locales) {
              results.push({
                url: `/sitemaps/${locale}.xml`,
                contentType: 'text/xml',
                i18nId: `@apostrophecms/sitemap:${locale}`,
                sitemap: false
              });
            }
          } else {
            results.push({
              url: '/sitemap.xml',
              contentType: 'text/xml',
              i18nId: '@apostrophecms/sitemap:sitemap',
              sitemap: false
            });
          }
        }
      }
    };
  },
  methods (self, options) {
    return {
      mapTask: async function (caching) {
        self.updatingCache = caching;

        if (!self.baseUrl) {
          const error = noBaseUrlWarning;

          return self.apos.util.error(error);
        }

        return self.map();
      },
      map: async function (httpReq) {
        const argv = self.apos.argv;
        const isStaticBuild = httpReq
          ? self.apos.url.isStaticBuild(httpReq)
          : false;
        const isExternalFront = httpReq
          ? self.apos.url.isExternalFront(httpReq)
          : false;
        // Skip cache when serving a static build request from an
        // external frontend — avoids poisoning the cache with
        // build-specific URLs.
        const skipCache = isStaticBuild && isExternalFront;

        if (self.updatingCache) {
          self.cacheOutput = [];
        }
        await lock();
        initConfig();
        await map();
        await hreflang();
        await write();
        await unlock();

        async function lock() {
          await self.apos.lock.lock('apos-sitemap');
        }

        function initConfig() {
          // TODO: Bring this back when supporting multiple formats.
          // self.format = argv.format || options.format || 'xml';
          self.format = 'xml';

          // TODO: Bring back when supporting text format.
          // self.indent = (typeof argv.indent !== 'undefined')
          //   ? argv.indent
          //   : options.indent;
          self.indent = false;

          self.excludeTypes = options.excludeTypes || [];

          if (argv['exclude-types']) {
            self.excludeTypes = self.excludeTypes.concat(argv['exclude-types']
              .split(','));
          }

          self.perLocale = options.perLocale || argv['per-locale'];

          // Exception: plaintext sitemaps and sitemap indexes don't go
          // together, so we can presume that if they explicitly ask
          // for plaintext they are just doing content strategy and we
          // should produce a single report
          // TODO: Revisit when supporting text format
          if (self.format === 'text') {
            self.perLocale = false;
          }
        }

        async function map () {
          self.maps = {};

          const locales = Object.keys(self.apos.i18n.getLocales());

          for (const locale of locales) {
            const req = self.getReq(locale, {
              staticBuild: isStaticBuild,
              externalFront: isExternalFront
            });
            const baseUrl = self.apos.url.getBaseUrl(req, { strict: true });
            const { pages } = await self.apos.url.getAllUrlMetadata(req, {
              excludeTypes: self.excludeTypes
            });
            for (const entry of pages) {
              // Skip entries explicitly excluded from sitemaps.
              // Always skip literal content entries (CSS, robots.txt, etc.)
              if (entry.sitemap === false || entry.contentType) {
                continue;
              }
              self.write(locale, {
                url: {
                  id: entry.i18nId,
                  locale,
                  priority: entry.priority ?? 1.0,
                  changefreq: entry.changefreq || 'daily',
                  loc: baseUrl + entry.url
                }
              });
            }
          }
        }

        async function hreflang() {
          const alternativesByAposId = {};

          for (const [ locale, entries ] of Object.entries(self.maps)) {
            entries.forEach(entry => {
              entry.url['xhtml:link'] = [ {
                _attributes: {
                  rel: 'alternate',
                  hreflang: locale,
                  href: entry.url.loc
                }
              } ];

              alternativesByAposId[entry.url.id] ??= [];
              alternativesByAposId[entry.url.id].push(entry);
            });
          }

          for (const entries of Object.values(self.maps)) {
            entries.forEach(entry => {
              const links = alternativesByAposId[entry.url.id]
                .filter(alternative => alternative !== entry)
                .map(alternative => ({
                  _attributes: {
                    rel: 'alternate',
                    hreflang: alternative.url.locale,
                    href: alternative.url.loc
                  }
                }));
              entry.url['xhtml:link'].push(...links);
            });
          }

          for (const entries of Object.values(self.maps)) {
            entries.forEach(entry => {
              delete entry.url.id;
              delete entry.url.locale;
            });
          }
        }

        function write() {
          // Sitemap requires absolute URLs — use strict: true
          const baseUrl = self.apos.url.getBaseUrl(
            self.getReq(self.defaultLocale, {
              staticBuild: isStaticBuild,
              externalFront: isExternalFront
            }),
            { strict: true }
          );
          return self.writeSitemap({
            skipCache,
            baseUrl
          });
        }

        async function unlock() {
          await self.apos.lock.unlock('apos-sitemap');
        }
      },
      // Return a req suitable for fetching content in the given locale
      // that belongs in the sitemap. A useful extension point for projects
      // that do unusual things with proxied URLs, etc.
      //
      // When `options.staticBuild` is `true`, the returned req will
      // have the static build flags set, so that `url.isStaticBuild(req)`
      // and `url.getBaseUrl(req)` behave correctly.
      //
      // When `options.externalFront` is `true`, the returned req will
      // also have `req.aposExternalFront = true`. This is needed because
      // `task.getAnonReq({ staticBuild })` applies static build headers
      // but does not set the external front flag — that flag is normally
      // set by the Express middleware when a real HTTP request arrives
      // with the `x-requested-with: AposExternalFront` header. Without
      // it, `url.isExternalFront(req)` returns `false`, which can cause
      // incorrect cache behavior (e.g. poisoning the sitemap cache with
      // static-build URLs).
      getReq(locale, { staticBuild = false, externalFront = false } = {}) {
        const req = self.apos.task.getAnonReq({
          locale,
          mode: 'published',
          staticBuild
        });
        if (externalFront) {
          req.aposExternalFront = true;
        }
        return req;
      },
      writeSitemap: function({ skipCache, baseUrl } = {}) {
        if (!self.perLocale) {
          // Simple single-file sitemap
          self.file = self.updatingCache
            ? 'sitemap.xml'
            : (self.apos.argv.file || '/dev/stdout');

          const map = Object.keys(self.maps).map(locale => {
            return self.maps[locale].map(self.stringify).join('\n');
          }).join('\n');

          self.writeMap(self.file, map);
        } else {
          // They should be broken down by host, in which case we automatically
          // place them in public/sitemaps in a certain naming pattern
          self.ensureDir('sitemaps');

          for (const key in self.maps) {
            let map = self.maps[key];
            // TODO: Revisit when supporting text format
            const extension = (self.format === 'xml') ? 'xml' : 'txt';

            map = map.map(self.stringify).join('\n');

            self.writeMap('sitemaps/' + key + '.' + extension, map);

          }

          self.writeIndex(baseUrl);
        }
        // Static builds serve directly from cacheOutput without
        // persisting to the database cache.
        if (self.updatingCache && !skipCache) {
          return self.writeToCache();
        }
        return null;
      },
      writeToCache: async function(callback) {
        await self.apos.cache.clear(sitemapCacheName);
        await insert();

        async function insert() {
          for (const doc of self.cacheOutput) {
            await self.apos.cache.set(
              sitemapCacheName,
              doc.filename,
              doc,
              self.cacheLifetime
            );
          }
        }

        return null;
      },
      writeIndex: function(baseUrl) {
        const now = new Date();
        if (!baseUrl) {
          throw new Error(noBaseUrlWarning);
        }

        self.writeFile('sitemaps/index.xml',

          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
          ' xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +

          Object.keys(self.maps).map(function(key) {
            const sitemap = '  <sitemap>\n' +
              '    <loc>' + baseUrl + '/sitemaps/' + key + '.xml' +
                '</loc>\n' +
              '    <lastmod>' + now.toISOString() + '</lastmod>\n' +
            '  </sitemap>\n';
            return sitemap;
          }).join('') +
          '</sitemapindex>\n'
        );

      },
      writeMap: function(file, map) {
        // TODO: Revisit when supporting text format
        if (self.format === 'xml') {
          self.writeXmlMap(file, map);
        } else {
          self.writeFile(file, map);
        }
      },
      writeXmlMap: function(file, map) {
        self.writeFile(file,
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
          ' xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
          map +
          '</urlset>\n'
        );
      },
      writeFile: function(filename, str) {
        if (!self.updatingCache) {
          filename = require('path').resolve(self.apos.rootDir + '/public', filename);
          if (filename === '/dev/stdout') {
            // Strange bug on MacOS when using writeFileSync with /dev/stdout
            fs.writeSync(1, str);
          } else {
            fs.writeFileSync(filename, str);
          }
        } else {
          self.cacheOutput.push({
            filename,
            data: str,
            createdAt: new Date()
          });
        }
      },
      // Append `str` to an array set aside for the map entries
      // for the host `locale`.
      write: function(locale, str) {
        self.maps[locale] = self.maps[locale] || [];
        self.maps[locale].push(str);
      },
      sendCache: async function(req, res, path) {
        // Static builds: generate fresh without reading or writing cache.
        // This avoids poisoning the cache with build-specific URLs and
        // ensures the output always reflects the current staticBaseUrl.
        if (self.apos.url.isStaticBuild(req) && self.apos.url.isExternalFront(req)) {
          return self.generateAndSend(req, res, path);
        }
        try {
          const file = await self.apos.cache.get(sitemapCacheName, path);

          if (!file) {
            // If anything else exists in our little filesystem, this should be
            // a 404 (think of a URL like /sitemap/madeupstuff). Otherwise it
            // just means the cache has expired or has never been populated.
            //
            // Check for the sitemap index or, if we're not running in that
            // mode, check for sitemap.xml.
            //
            // Without this check every 404 would cause a lot of work to be
            // done.
            const sitemapFile = self.perLocale ? 'sitemaps/index.xml' : 'sitemap.xml';
            const exists = await self.apos.cache.get(sitemapCacheName, sitemapFile);

            if (exists) {
              return notFound();
            }
            return self.cacheAndRetry(req, res, path);
          }
          return res.contentType('text/xml').send(file.data);
        } catch (error) {
          return fail(error);
        }

        function notFound() {
          return res.status(404).send('not found');
        }

        function fail(err) {
          self.apos.util.error(err);
          return res.status(500).send('error');
        }
      },
      // Generate sitemap fresh for static build requests.
      // Output is collected in self.cacheOutput but never persisted
      // to the database cache, and served directly to the response.
      generateAndSend: async function(req, res, path) {
        try {
          await self.map(req);
          const file = self.cacheOutput.find(doc => doc.filename === path);
          if (!file) {
            return res.status(404).send('not found');
          }
          return res.contentType('text/xml').send(file.data);
        } catch (error) {
          self.apos.util.error(error);
          return res.status(500).send('error');
        }
      },
      cacheAndRetry: async function(req, res, path) {
        try {
          await self.map(req);
          return self.sendCache(req, res, path);
        } catch (error) {
          return fail(error);
        }

        function fail(err) {
          self.apos.util.error('cacheAndRetry error:', err);
          return res.status(500).send('error');
        }
      },
      stringify(value) {
        // TODO: Revisit when supporting text format
        if (Array.isArray(value) && (self.format !== 'xml')) {
          return value.join('');
        }
        if (typeof (value) !== 'object') {
          // TODO: Revisit when supporting text format
          if (self.format === 'xml') {
            return self.apos.util.escapeHtml(value);
          }
          return value;
        }
        let xml = '';
        for (const k in value) {
          const v = value[k];
          if (k === '_attributes') {
            return;
          }
          if (Array.isArray(v)) {
            v.forEach(function(el) {
              element(k, el);
            });
          } else {
            element(k, v);
          }
        }

        function element(k, v) {
          xml += '<' + k;
          if (v && v._attributes) {
            for (const a in v._attributes) {
              const av = v._attributes[a];

              xml += ' ' + a + '="' + self.apos.util.escapeHtml(av) + '"';
            }
          }
          // Ensure that empty tags are self-closing
          const value = self.stringify(v || '');
          if (typeof value === 'undefined' || value === '') {
            xml += ' />\n';
            return;
          }
          xml += '>';
          xml += value;
          xml += '</' + k + '>\n';
        }

        return xml;
      },
      ensureDir (dir) {
        if (!self.updatingCache) {
          dir = self.apos.rootDir + '/public/' + dir;
          try {
            fs.mkdirSync(dir);
          } catch (e) {
            // The directory already exists.
          }
        }
      }
      // End of methods obj
    };
  }
};
