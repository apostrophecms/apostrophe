// The oembed module provides an oembed query service for embedding
// third-party website content, such as YouTube videos. The service includes
// enhancements and substitutes for several services that do not support
// oembed or do not support it well, and it is possible to add more by
// extending the `enhanceOembetter` method. The server-side
// code provides a query route with caching. The browser-side code
// provides methods to make a query, and also to make a query and then immediately
// display the result.
//
// Also see the [oembetter](https://www.npmjs.com/package/oembetter) npm module and
// the [oembed](http://oembed.com/) documentation.
//
// Sites to be embedded need to be whitelisted, to avoid XSS attacks. Many
// widely trusted sites are already whitelisted.
//
// Your `whitelist` option is concatenated with `oembetter`'s standard
// whitelist, plus wufoo.com, infogr.am, and slideshare.net.
//
// Your `endpoints` option is concatenated with `oembetter`'s standard
// endpoints list.

module.exports = {

  alias: 'oembed',

  // How long to cache oembed responses: 1 hour by default
  cacheLifetime: 60 * 60,

  afterConstruct: function(self) {
    self.createOembetter();
    self.enhanceOembetter();
    self.createRoutes();
    self.pushAssets();
    self.pushCreateSingleton();
  },

  construct: function(self, options) {

    // Create the browser-side object `apos.oembed` for convenient oembed queries
    // and display of oembed responses. Called by `afterConstruct`.

    self.pushCreateSingleton = function() {
      self.apos.push.browserCall('always', 'apos.create("apostrophe-oembed", ?)', { action: self.action });
    };

    // Creates an instance of the `oembetter` module and adds the standard whitelist.
    // Called by `afterConstruct`.

    self.createOembetter = function() {
      self.oembetter = require('oembetter')();
      // Don't permit oembed of untrusted sites, which could
      // lead to XSS attacks

      self.oembetter.whitelist(self.oembetter.suggestedWhitelist.concat(self.options.whitelist || [], [ 'wufoo.com', 'infogr.am', 'slideshare.net' ]));
      self.oembetter.endpoints(self.oembetter.suggestedEndpoints.concat(self.options.endpoints || []));
    };

    // Enhances oembetter to support services better or to support services
    // that have no oembed support by default. Called by `afterConstruct`.
    // Extend this method to add additional `oembetter` filters.

    self.enhanceOembetter = function() {
      require('./lib/youtube.js')(self, self.oembetter);
      require('./lib/vimeo.js')(self, self.oembetter);
      require('./lib/wufoo.js')(self, self.oembetter);
      require('./lib/infogram.js')(self, self.oembetter);
    };

    // Add oembed query API routes. Called by `afterConstruct`.

    self.createRoutes = function() {
      // Simple API to self.query, with caching. Accepts url and
      // alwaysIframe parameters; alwaysIframe is assumed false
      // if not provided. The response is a JSON object as returned
      // by apos.oembed.
      self.route('get', 'query', function(req, res) {
        var url = self.apos.launder.string(req.query.url);
        var options = {
          alwaysIframe: self.apos.launder.boolean(req.query.alwaysIframe),
          iframeHeight: self.apos.launder.integer(req.query.iframeHeight),
          neverOpenGraph: self.apos.launder.boolean(req.query.neverOpenGraph)
        };
        return self.query(req, url, options, function(err, result) {
          if (err) {
            if ((typeof (err) === 'number') && ((err >= 400) && (err < 600))) {
              // Disclose the HTTP error from upstream
              return res.status(err).send('error');
            } else {
              // Doesn't look like a clean HTTP status code
              return res.status(404).send('error');
            }
          }
          return res.send(result);
        });
      });
    };

    require('./lib/api.js')(self, options);
    require('./lib/browser.js')(self, options);
  }
};
