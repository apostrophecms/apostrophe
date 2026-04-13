// Provides the `build` method, a flexible and powerful way to build
// URLs with query parameters and more. This method is made available
// as the `build` filter in Nunjucks. This is also the logical place
// to add new utility methods relating to URLs.

const _ = require('lodash');
const qs = require('qs');

module.exports = {

  options: {
    alias: 'url',
    static: false
  },

  restApiRoutes(self) {
    return {
      // GET /api/v1/@apostrophecms/url
      //
      // Returns the result of `getAllUrlMetadata` — an object
      // with `pages` and `attachments` properties.
      // See the `getAllUrlMetadata` method for full documentation.
      async getAll(req) {
        if (!self.isExternalFront(req)) {
          throw self.apos.error('forbidden');
        }
        if (!self.options.static) {
          throw self.apos.error('invalid',
            'The @apostrophecms/url module must be configured with the "static: true" option to use this API. ' +
            'Without it, URL metadata for filters and pagination cannot be fully enumerated for a static build.'
          );
        }

        // Parse and sanitize attachment options from the query string.
        const launder = self.apos.launder;
        const wantAttachments = launder.boolean(req.query.attachments);
        const splitSizes = (val) => {
          const list = launder.string(val)
            .split(',').map(s => s.trim()).filter(Boolean);
          return list.length ? list : undefined;
        };
        const attachments = wantAttachments
          ? {
            sizes: splitSizes(req.query.attachmentSizes),
            skipSizes: splitSizes(req.query.attachmentSkipSizes),
            scope: launder.select(
              req.query.attachmentScope,
              [ 'used', 'all' ],
              'used'
            )
          }
          : false;

        return self.getAllUrlMetadata(req, {
          attachments
        });
      }
    };
  },

  handlers(self) {
    return {
      '@apostrophecms/page:beforeSend': {
        addStaticUrlsFlag(req) {
          req.data.staticUrls = !!self.options.static;
        }
      }
    };
  },

  methods(self) {
    return {

      // Returns `true` if the given `req` represents a static build
      // request. This is the single source of truth — modules should
      // use this method rather than inspecting `req` properties
      // directly.
      //
      // Static build requests are those made by an external frontend
      // (e.g. Astro) that opted in to static-build URL handling via
      // the `x-apos-static-base-url: 1` header. The Express
      // middleware sets `req.aposStaticBuild` and (when configured)
      // `req.staticBaseUrl` in response.
      isStaticBuild(req) {
        return !!req.aposStaticBuild;
      },

      // Returns `true` if the given `req` originates from an
      // external frontend integration (e.g. Astro, Next.js).
      // This is the single source of truth — modules should use
      // this method rather than inspecting `req.aposExternalFront`
      // directly.
      isExternalFront(req) {
        return !!req.aposExternalFront;
      },

      // Returns the effective base URL for the given request.
      //
      // Resolution order:
      //  1. If a hostname is configured for the active locale,
      //     `<protocol>://<hostname>` is returned (locale-specific
      //     host always wins, prefix is never appended).
      //  2. If the request is a static build (`isStaticBuild(req)`),
      //     `req.staticBaseUrl` + prefix is returned (or the empty
      //     string when none is configured).
      //  3. Otherwise, `apos.baseUrl` + prefix is returned (or the
      //     empty string).
      //
      // ### `options.strict`
      //
      // When `true`, guarantees a non-empty return value:
      //  - In a static build where `staticBaseUrl` is empty,
      //    falls back to `apos.baseUrl`.
      //  - In a non-static context where `apos.baseUrl` is empty,
      //    still returns the empty string (nothing more to fall
      //    back to).
      //
      // Use `strict: true` when an absolute URL is required (e.g.
      // sitemap `<loc>` values).
      //
      // ### `options.prefix`
      //
      // When `true` (the default), the global `apos.prefix` is
      // appended to the returned URL (e.g. `/blog`).  The prefix
      // is **not** appended when a locale-specific hostname is
      // used — that hostname already represents the full origin.
      //
      // Pass `prefix: false` to obtain only the origin / base URL
      // without the prefix.  This is the legacy behavior of
      // `apos.page.getBaseUrl(req)` before the delegation to this
      // method.
      //
      // ### `options.relative`
      //
      // When `true`, the returned URL is relative and prefix-qualified.
      // The `prefix` option and i18n hosts are ignored in this case.
      //
      // ### `options.localePrefix`
      //
      // When `true`, the locale prefix (e.g. `/fr`) is appended
      // after the global prefix.  Defaults to `false` for
      // backward compatibility.
      getBaseUrl(req, {
        strict = false, prefix = true, relative = false,
        localePrefix = false
      } = {}) {
        if (relative) {
          const result = self.apos.prefix || '';
          return localePrefix
            ? result + (self.apos.i18n.locales[req.locale]?.prefix || '')
            : result;
        }
        const hostname = self.apos.i18n.locales?.[req.locale]?.hostname;
        if (hostname) {
          // Locale hostnames are fully qualified origins;
          // the global prefix does not apply.
          return `${req.protocol}://${hostname}`;
        }
        const aposPrefix = prefix ? (self.apos.prefix || '') : '';
        const lPrefix = localePrefix
          ? (self.apos.i18n.locales[req.locale]?.prefix || '')
          : '';
        if (self.isStaticBuild(req)) {
          const staticUrl = req.staticBaseUrl || '';
          if (staticUrl || !strict) {
            return staticUrl + aposPrefix + lPrefix;
          }
        }
        return (self.apos.baseUrl || '') + aposPrefix + lPrefix;
      },

      // Build filter URLs. `data` is an object whose properties
      // become new query parameters. These parameters override any
      // existing parameters of the same name in the URL. If you
      // pass a property with a value of `undefined`, `null` or an
      // empty string, that parameter is removed from the
      // URL if already present (note that the number `0` does not
      // do this). This is very useful for maintaining filter
      // parameters in a query string without redundant code.
      //
      // Pretty URLs
      //
      // If the optional `path` argument is present, it must be an
      // array. (You may skip this argument if you are just
      // adding query parameters.)
      //
      // Any properties of `data` whose names appear in `path`
      // are concatenated to the URL directly, separated by slashes,
      // in the order they appear in that array.
      //
      // The first missing or empty value for a property in `path`
      // stops this process to prevent an ambiguous URL.
      //
      // Note that there is no automatic detection that this has
      // already happened in an existing URL, so you can't override
      // existing components of the path.
      //
      // If a property's value is not equal to the slugification of
      // itself as determined by apos.util.slugify, then a query
      // parameter is set instead.
      //
      // If you don't want to handle a property as a query parameter,
      // make sure it is always slug-safe.
      //
      // Overrides: multiple data objects
      //
      // You may pass additional data objects. The last one wins, so
      // you can pass your existing parameters first and pass new
      // parameters you are changing as a second data object.
      //
      // Working with Arrays
      //
      // Normally, a new value for a property replaces any old one,
      // and `undefined`, `null` or `''` removes the old one. If you
      // wish to build up an array property instead you'll need
      // to use the MongoDB-style $addToSet and $pull operators to add and
      // remove values from an array field in the URL:
      //
      // Add colors[]=blue to the query string, if not already present
      //
      // `{ colors: { $addToSet: 'blue' } }`
      //
      // Remove colors[]=blue from the query string, if present
      //
      // `{ colors: { $pull: 'blue' } }`
      //
      // All values passed to $addToSet or $pull must be strings or
      // convertible to strings via `toString()` (e.g. numbers, booleans)
      //
      // (The actual query string syntax includes array indices and
      // is fully URI escaped, so it's slightly different but has
      // the same impact. PHP does the same thing.)

      build(url, path, data) {

        let hash;
        // Preserve hash separately
        const matches = url.match(/^(.*)?#(.*)$/);
        if (matches) {
          url = matches[1];
          hash = matches[2];
          if (url === undefined) {
            // Why, JavaScript? Why? -Tom
            url = '';
          }
        }

        // Sometimes necessary with nunjucks, we may otherwise be
        // exposed to a SafeString object and throw an exception
        url = url.toString();

        const qat = url.indexOf('?');
        let base = url;
        const dataObjects = [];
        let pathKeys;
        let original;
        const query = {};
        let i, j;
        let key;

        if (qat !== -1) {
          original = qs.parse(url.substr(qat + 1));
          base = url.substr(0, qat);
        }
        let dataStart = 1;
        if (path && Array.isArray(path)) {
          pathKeys = path;
          dataStart = 2;
        } else {
          pathKeys = [];
        }

        // Process data objects in reverse order so the last
        // override wins
        for (i = arguments.length - 1; i >= dataStart; i--) {
          dataObjects.push(arguments[i]);
        }
        if (original) {
          dataObjects.push(original);
        }
        const done = {};
        let stop = false;
        let dataObject;
        let value;

        for (i = 0; i < pathKeys.length; i++) {
          if (stop) {
            break;
          }
          key = pathKeys[i];
          for (j = 0; j < dataObjects.length; j++) {
            dataObject = dataObjects[j];
            if (dataObject[key] !== undefined) {
              value = dataObject[key];
              // If we hit an empty value we need to stop all path processing
              // to avoid ambiguous URLs
              if (value === undefined || value === null || value === '') {
                done[key] = true;
                stop = true;
                break;
              }
              // If the value is an object it can't be stored in the path,
              // so stop path processing, but don't mark this key 'done'
              // because we can still store it as a query parameter
              if (typeof value === 'object') {
                stop = true;
                break;
              }
              const s = dataObject[key].toString();
              if (s === self.apos.util.slugify(s)) {
                // Don't append double /
                if (base !== '/') {
                  base += '/' + s;
                } else {
                  base += s;
                }
                done[key] = true;
                break;
              } else {
                // A value that cannot be slugified also forces an end to
                // path processing
                stop = true;
                break;
              }
            }
          }
        }

        // For non-path parameters we process starting with the original
        // object so cumulative operations like $addToSet and $pull can work

        for (i = dataObjects.length - 1; i >= 0; i--) {
          dataObject = dataObjects[i];
          for (key in dataObject) {
            if (done[key]) {
              continue;
            }
            value = dataObject[key];
            if (value && value.$pull !== undefined) {
              value = _.difference(query[key] || [], [ value.$pull.toString() ]);
              if (!value.length) {
                value = undefined;
              }
            } else if (value && value.$addToSet !== undefined) {
              value = _.union(query[key] || [], [ value.$addToSet.toString() ]);
              if (!value.length) {
                value = undefined;
              }
            }
            if (value === undefined || value === null || value === '') {
              delete query[key];
            } else {
              query[key] = value;
            }
          }
        }

        function restoreHash(url) {
          if (hash !== undefined) {
            return url + '#' + hash;
          } else {
            return url;
          }
        }

        if (_.size(query)) {
          return restoreHash(base + '?' + qs.stringify(query));
        } else {
          return restoreHash(base);
        }
      },

      // Generate a list of all URLs reachable with the given
      // req object. Used internally to implement static site
      // generation and sitemaps. Usually called in a loop,
      // once for each locale.
      //
      // ## Returned shape
      //
      // The return value is always:
      //
      // ```js
      // {
      //   pages: [ ...page metadata entries ],
      //   attachments: { // null when not requested
      //     uploadsUrl: '/uploads',
      //     results: [
      //       { _id: 'abc', urls: [{ size?, path }], base? },
      //       ...
      //     ]
      //   }
      // }
      // ```
      //
      // ## Page metadata entries (`pages`)
      //
      // Each entry in the `pages` array may contain the
      // following properties:
      //
      // ### `url` (string, always present)
      // The URL path for this entry — a purely relative path
      // without origin or prefix (e.g. `/articles` or
      // `/articles/category/tech`, never
      // `https://example.com/my-repo/articles`).
      //
      // For document entries, the framework strips the base
      // URL (origin + prefix) automatically after collection.
      // For **literal content** entries added by event
      // handlers, the URL **must** be provided as a relative,
      // prefix-free path (e.g. `/robots.txt`, not
      // `/my-repo/robots.txt`). The consumer (e.g. Astro
      // integration) is responsible for prepending the prefix
      // when fetching from the backend.
      //
      // ### `i18nId` (string, always present)
      // A stable identifier that is consistent across localized
      // versions of the same logical URL. Used by external
      // frontends (e.g. Astro) to correlate URLs across locales.
      // For the primary view of a document this equals `aposDocId`.
      // For derived URLs (pagination, filter combinations) it is
      // built by appending suffixes to the base doc's `aposDocId`,
      // e.g. `myDocId.category.tech.1` or `myDocId.2`.
      //
      // ### `type` (string, present for document entries)
      // The Apostrophe doc `type` name (e.g. `'article'`,
      // `'@apostrophecms/home-page'`). Absent on non-document
      // entries such as literal content URLs.
      //
      // ### `aposDocId` (string, present for document entries)
      // The locale-independent document ID. Absent on
      // non-document entries.
      //
      // ### `_id` (string, present for document entries)
      // The full locale-qualified MongoDB `_id` of the document
      // (e.g. `'xyz:en:published'`). Absent on non-document
      // entries.
      //
      // ### `contentType` (string, present for literal content entries only)
      // A MIME type such as `'text/css'` or `'text/plain'`.
      // When present, this signals that the URL returns non-HTML
      // content that should be proxied literally by the consumer
      // (e.g. an Astro static build). The consumer should fetch
      // the `url` and write the response body to disk with the
      // given content type instead of rendering it as a page.
      // When absent, the URL is an ordinary HTML page.
      //
      // Document entries (pages, pieces, etc.) should NEVER set
      // `contentType`. Consumers such as the sitemap module and
      // Astro use its absence to identify renderable HTML pages
      // vs literal assets.
      //
      // Literal content entries should NOT include `changefreq`
      // or `priority` — those are only meaningful for document
      // entries in sitemaps.
      //
      // ### `sitemap` (boolean, optional, default `true`)
      // When explicitly set to `false`, the entry is excluded
      // from sitemap generation but still included in static
      // builds. Useful for URLs that must exist in the build
      // (e.g. paginated filter pages, CSS files) but should
      // not appear in `sitemap.xml`. If omitted, the entry is
      // included in sitemaps.
      //
      // ### `changefreq` (string, optional, document entries only)
      // Sitemap hint (e.g. `'daily'`). Included for legacy
      // sitemap compatibility. Google explicitly ignores this.
      // Must NOT be set on literal content entries.
      //
      // ### `priority` (number, optional, document entries only)
      // Sitemap priority hint (e.g. `1.0`). Included for legacy
      // sitemap compatibility. Google explicitly ignores this.
      // Must NOT be set on literal content entries.
      //
      // ## Literal content entries
      //
      // Some entries represent non-HTML content that should be
      // served literally with a specific MIME type, such as
      // CSS stylesheets, `robots.txt`, `llms.txt`, etc. These
      // entries include a `contentType` property (e.g.
      // `text/css`, `text/plain`). Consumers of this API
      // (e.g. an Astro static build) should fetch the `url`
      // and serve the response body with the specified content
      // type rather than rendering it as an HTML page.
      //
      // ## Extension points
      //
      // This method emits the
      // `@apostrophecms/url:getAllUrlMetadata` event, so
      // that handlers in any module can add URLs to the
      // results. The default implementation already calls
      // `getAllUrlMetadata` on every doc type manager that
      // has at least one doc in the database, so listening
      // for the event is only for edge cases that can't be
      // covered by extending `getAllUrlMetadata` or
      // `getUrlMetadata` on such a manager.
      //
      // Handlers should respect `excludeTypes`.
      //
      // **Important:** handlers that push literal content
      // entries must provide a relative, prefix-free `url`
      // path (e.g. `/robots.txt`). The base URL stripping
      // that runs after collection only applies to document
      // entries whose `url` starts with the effective base
      // URL — it will not strip a prefix that was manually
      // added by a handler. Providing a relative path
      // ensures correct behaviour regardless of whether a
      // prefix is configured.
      //
      // ## Attachment metadata (`attachments`)
      //
      // When `options.attachments` is a truthy object, attachment
      // metadata is collected after URL enumeration and returned
      // alongside the pages.  The option accepts:
      //
      // - `scope` (`'used'` | `'all'`): `'used'` (default) limits
      //   to attachments referenced by documents present in the
      //   results.  `'all'` returns every non-archived attachment.
      // - `sizes` (string[]): explicit image sizes to include.
      // - `skipSizes` (string[]): image sizes to exclude.
      //
      // `attachments.uploadsUrl` is the uploadfs base URL prefix
      // (e.g. `/uploads` or `https://cdn.example.com`).
      //
      // Each entry in `attachments.results` contains:
      // - `_id` (string): the attachment record ID.
      // - `urls` (array): `{ size, path }` objects where `path`
      //   is the uploadfs-relative file path.
      // - `base` (string, optional): when present, overrides the
      //   global `uploadsUrl` for this entry.  Set by
      //   `@apostrophecms/file.applyPrettyUrlPaths` for file
      //   pieces with pretty URLs enabled.  The value is a
      //   relative, prefix-qualified path (e.g. `/files` or
      //   `/cms/files`).  Consumers should use
      //   `entry.base || attachments.uploadsUrl` as the download
      //   and output base for each entry.
      //
      // After attachment metadata is collected, the
      // `@apostrophecms/url:getAllAttachmentMetadata` event is
      // emitted. Handlers receive `(req, results, options)` where
      // `results` is the attachments results array and `options`
      // includes `{ sizes, skipSizes, scope, uploadsUrl }`. This
      // is an escape hatch for edge cases where a module needs to
      // contribute additional attachment entries or modify the
      // results programmatically.
      //
      async getAllUrlMetadata(req, { excludeTypes = [], attachments = false } = {}) {
        // Ensure global doc is available for event handlers
        // that may need it (e.g. @apostrophecms/styles)
        await self.apos.global.addGlobalToData(req);
        const results = [];
        const allAttachmentDocIds = new Set();
        const collectDocIds = !!attachments && attachments.scope !== 'all';
        const types = await self.apos.doc.db.distinct('type');
        for (const type of types) {
          if (!excludeTypes.includes(type)) {
            const manager = self.apos.doc.getManager(type);
            if (!manager?.getAllUrlMetadata) {
              continue;
            }
            const {
              metadata,
              attachmentDocIds
            } = await manager
              .getAllUrlMetadata(req, { attachments: collectDocIds });
            for (const entry of metadata) {
              results.push(entry);
            }
            for (const id of attachmentDocIds) {
              allAttachmentDocIds.add(id);
            }
          }
        }
        await self.emit('getAllUrlMetadata', req, results, { excludeTypes });

        const response = {
          pages: results,
          attachments: null
        };

        if (attachments) {
          const {
            sizes, skipSizes, scope
          } = attachments;

          const docIds = collectDocIds
            ? [ ...allAttachmentDocIds ]
            : undefined;

          response.attachments = {
            uploadsUrl: self.apos.attachment.uploadfs.getUrl(),
            results: await self.apos.attachment.getStaticMetadata({
              docIds,
              sizes,
              skipSizes
            })
          };
          await self.apos.file.applyPrettyUrlPaths(
            req, response.attachments
          );
          await self.emit(
            'getAllAttachmentMetadata',
            req,
            response.attachments.results,
            {
              sizes,
              skipSizes,
              scope,
              uploadsUrl: response.attachments.uploadsUrl
            }
          );
        }

        // Strip the base URL (origin + prefix) that `_url` values
        // were built with, producing purely relative, prefix-free
        // paths (e.g. `/about`, `/fr/articles/page/2`).
        const effectiveBaseUrl = self.getBaseUrl(req);
        if (effectiveBaseUrl) {
          for (const entry of response.pages) {
            if (entry.url?.startsWith(effectiveBaseUrl)) {
              entry.url = entry.url.slice(effectiveBaseUrl.length) || '/';
            }
          }
        }

        // Strip the backend origin from uploadsUrl so that the
        // consumer receives a relative, prefix-qualified path
        // (e.g. `/uploads` or `/cms/uploads`).
        // CDN URLs (different origin) and already-relative URLs
        // are left untouched.
        if (response.attachments) {
          const baseUrl = self.apos.baseUrl || '';
          if (baseUrl && response.attachments.uploadsUrl.startsWith(baseUrl)) {
            response.attachments.uploadsUrl =
              response.attachments.uploadsUrl.slice(baseUrl.length);
          }
        }

        return response;
      },
      // Returns a string suitable to append to the original page URL when we're
      // specifying a particular filter and a page number. Pages start with 1
      getChoiceFilter(name, value, page) {
        if (value === null) {
          return '';
        }
        name = encodeURIComponent(name);
        value = encodeURIComponent(value);
        if (self.options.static) {
          return `/${name}/${value}${page > 1 ? `/page/${page}` : ''}`;
        } else {
          return `?${name}=${value}${page > 1 ? `&page=${page}` : ''}`;
        }
      },
      // Returns a string suitable to append to the original page URL when all we're
      // adding is a page number. Pages start with 1
      getPageFilter(page) {
        if (page <= 1) {
          return '';
        }
        if (self.options.static) {
          return `/page/${page}`;
        } else {
          return `?page=${page}`;
        }
      }
    };
  }
};
