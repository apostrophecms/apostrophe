// Implements "soft redirects." When a 404 is about to occur, Apostrophe will look
// for a page or piece that has been associated with that URL in the past, and
// redirect if there is one. This only comes into play if a 404 is about to occur.
//
// ## Options
//
// ### `enable`
//
// Set this option explicitly to `false` to shut off this feature.
//
// ### `statusCode`
//
// Set this option to return another HTTP status code when redirecting. You may use
// e.g. HTTP 301 for permanent redirects. Defaults to HTTP 302.
//
// For example in your `app.js` module configuration:
//
// ```javascript
// '@apostrophecms/soft-redirect': {
//   statusCode: 301
// }
// ```

const parseurl = require('parseurl');

module.exports = {
  async init(self) {
    self.options.statusCode = self.options.statusCode || 302;

    if (self.options.enable === false) {
      return;
    }
    if (self.options.enable === false) {
      return;
    }
    await self.createIndexes();
  },
  handlers(self) {
    return {
      '@apostrophecms/page:notFound': {
        async notFoundRedirect(req) {
          const urlPathname = parseurl.original(req).pathname;

          const doc = await self.apos.doc
            .find(req, {
              historicUrls: {
                $in: [ urlPathname ]
              }
            })
            .sort({ updatedAt: -1 })
            .toObject();
          if (!(doc && doc._url)) {
            return;
          }
          if (self.local(doc._url) !== urlPathname) {
            req.statusCode = self.options.statusCode;
            req.redirect = doc._url;
          }
        }
      },
      '@apostrophecms/doc-type:beforeSave': {
        addHistoricUrl(req, doc) {
          const shouldAddHistoricUrl = doc && doc._url && !(doc.historicUrls || []).includes(self.local(doc._url));
          if (!shouldAddHistoricUrl) {
            return;
          }

          doc.historicUrls = [
            ...(doc.historicUrls || []),
            self.local(doc._url)
          ];
        }
      }
    };
  },
  methods(self) {
    return {
      async createIndexes() {
        return self.apos.doc.db.createIndex({ historicUrls: 1 });
      },
      // Remove any protocol, `//` and host/port/auth from URL
      local(url) {
        return url.replace(/^(https?:)?\/\/[^/]+/, '');
      }
    };
  }
};
