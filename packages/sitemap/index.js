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
    alias: 'sitemap',
    // The number of pieces to index in each loop.
    piecesPerBatch: 100
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

    self.piecesPerBatch = options.piecesPerBatch;

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
          return self.sendCache(res, 'sitemap.xml');
        },
        '/sitemaps/*': async function(req, res) {
          return self.sendCache(res, 'sitemaps/' + req.params[0]);
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
      map: async function () {
        const argv = self.apos.argv;

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
            const req = self.getReq(locale);

            await self.getPages(req);
            await self.getPieces(req);
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
          return self.writeSitemap();
        }

        async function unlock() {
          await self.apos.lock.unlock('apos-sitemap');
        }
      },
      // Reqturn a req suitable for fetching content in the given locale
      // that belongs in the sitemap. A useful extension point for projects
      // that do unusual things with proxied URLs, etc.
      getReq(locale) {
        return self.apos.task.getAnonReq({
          locale,
          mode: 'published'
        });
      },
      writeSitemap: function() {
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

          self.writeIndex();
        }
        if (self.updatingCache) {
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
      writeIndex: function() {
        const now = new Date();
        if (!self.baseUrl) {
          throw new Error(noBaseUrlWarning);
        }

        self.writeFile('sitemaps/index.xml',

          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
          ' xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +

          Object.keys(self.maps).map(function(key) {
            const sitemap = '  <sitemap>\n' +
              '    <loc>' + self.baseUrl + self.apos.prefix + '/sitemaps/' + key + '.xml' +
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
      async getPages (req) {
        const pages = await self.apos.page.find(req, {}).areas(false)
          .relationships(false).sort({
            level: 1,
            rank: 1
          }).toArray();

        pages.forEach(self.output);
      },
      async getPieces(req) {
        const modules = Object.values(self.apos.modules).filter(function(mod) {
          return mod.__meta.chain.find(entry => {
            return entry.name === '@apostrophecms/piece-type';
          });
        });

        let skip = 0;

        for (const appModule of modules) {
          if (self.excludeTypes.includes(appModule.__meta.name)) {
            continue;
          }
          await stashPieces(appModule);
          skip = 0;
        }

        async function stashPieces(appModule) {
          // Paginate through 100 (by default) at a time to avoid slamming
          // memory
          const pieceSet = await appModule.find(req, {})
            .relationships(false).areas(false).skip(skip)
            .limit(self.piecesPerBatch).toArray();

          pieceSet.forEach(function(piece) {
            if (!piece._url) {
            // This one has no page to be viewed on
              return;
            }
            // Results in a reasonable priority relative
            // to regular pages
            piece.level = 3;

            self.output(piece);
          });

          if (pieceSet.length) {
            skip += pieceSet.length;

            await stashPieces(appModule);
          }
        }
      },
      // Output the sitemap entry for the given doc, including its children if
      // any. The entry is buffered for output as part of the map for the
      // appropriate locale.
      output: async function(page) {
        const locale = (page.aposLocale || self.defaultLocale).split(':')[0];

        if (!self.excludeTypes.includes(page.type)) {
          let url;

          // TODO: Revisit when supporting text format
          if (self.format === 'text') {
            if (self.indent) {
              let i;

              for (i = 0; (i < page.level); i++) {
                self.write(locale, '  ');
              }

              self.write(locale, page._url + '\n');
            }
          } else {
            url = page._url;
            let priority = (page.level < 10) ? (1.0 - page.level / 10) : 0.1;

            if (typeof (page.siteMapPriority) === 'number') {
              priority = page.siteMapPriority;
            }

            self.write(locale, {
              url: {
                id: page.aposDocId,
                locale,
                priority,
                changefreq: 'daily',
                loc: url
              }
            });
          }
        }

      },
      // Append `str` to an array set aside for the map entries
      // for the host `locale`.
      write: function(locale, str) {
        self.maps[locale] = self.maps[locale] || [];
        self.maps[locale].push(str);
      },
      sendCache: async function(res, path) {
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
            return self.cacheAndRetry(res, path);
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
      cacheAndRetry: async function(res, path) {
        try {
          await self.map();
          return self.sendCache(res, path);
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
