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
// 'apostrophe-soft-redirects': {
//   statusCode: 301
// }
// ```

module.exports = {
  async init(self, options) {
    options.statusCode = options.statusCode || 302;
    
    if (self.options.enable === false) {
      return;
    }
    if (self.options.enable === false) {
      return;
    }
    await self.createIndexes();
  },
  handlers(self, options) {
    return {
      'apostrophe-pages:notFound': {
        async notFoundRedirect(req) {
          const doc = await self.apos.docs.find(req, { historicUrls: { $in: [req.url] } }).sort({ updatedAt: -1 }).toObject();
          if (!(doc && doc._url)) {
            return;
          }
          if (self.local(doc._url) !== req.url) {
            req.statusCode = options.statusCode;
            req.redirect = self.local(doc._url);
          }
        }
      },
      'apostrophe-pages:beforeSend': {
        async updateHistoricUrls(req) {
          let docs = [];
          if (req.data.page) {
            docs.push(req.data.page);
          }
          if (req.data.piece) {
            docs.push(req.data.piece);
          }
          docs = docs.filter(function (doc) {
            if (doc._url) {
              return !(doc.historicUrls || []).includes(self.local(doc._url));
            } else {
              return false;
            }
          });
          for (const doc of docs) {
            await self.apos.docs.db.updateOne({ _id: doc._id }, { $addToSet: { historicUrls: self.local(doc._url) } });
          }
        }
      }
    };
  },
  methods(self, options) {
    return {
      
      async createIndexes() {
        return self.apos.docs.db.createIndex({ historicUrls: 1 });
      },
      
      // Remove any protocol, `//` and host/port/auth from URL
      local(url) {
        return url.replace(/^(https?:)?\/\/[^/]+/, '');
      }
    };
  }
};  
