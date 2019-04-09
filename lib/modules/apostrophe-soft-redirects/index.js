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

  afterConstruct: async function(self) {
    if (self.options.enable === false) {
      return;
    }
    await self.createIndexes();
  },

  construct: function(self, options) {
    let statusCode = self.options.statusCode || 302;

    if (self.options.enable === false) {
      return;
    }

    self.createIndexes = async function() {
      return self.apos.docs.db.createIndex({ historicUrls: 1 });
    };

    self.on('apostrophe-pages:notFound', 'notFoundRedirect', async function(req) {
      const doc = await self.apos.docs.find(req, { historicUrls: { $in: [ req.url ] } }).sort({ updatedAt: -1 }).toObject();
      if (!(doc && doc._url)) {
        return;
      }
      if (self.local(doc._url) !== req.url) {
        req.statusCode = statusCode;
        req.redirect = self.local(doc._url);
      }
    });

    self.on('apostrophe-pages:beforeSend', 'updateHistoricUrls', async function(req) {
      let docs = [];
      if (req.data.page) {
        docs.push(req.data.page);
      }
      if (req.data.piece) {
        docs.push(req.data.piece);
      }
      docs = docs.filter(docs, function(doc) {
        if (doc._url) {
          return (doc.historicUrls || []).includes(self.local(doc._url));
        } else {
          return false;
        }
      });
      for (const doc of docs) {
        await self.apos.docs.db.update({ _id: doc._id }, {
          $addToSet: {
            historicUrls: self.local(doc._url)
          }
        });
      }
    });

    // Remove any protocol, `//` and host/port/auth from URL
    self.local = function(url) {
      return url.replace(/^(https?:)?\/\/[^/]+/, '');
    };

  }

};
