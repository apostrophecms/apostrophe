var async = require('async');
var request = require('request');
var cheerio = require('cheerio');

module.exports = {

  alias: 'oembed',

  // How long to cache oembed responses: 1 hour by default
  cacheLifetime: 60 * 60,

  afterConstruct: function(self) {
    self.createOembetter();
    self.enhanceOembetter();
    self.createRoutes();
  },

  construct: function(self, options) {

    self.createOembetter = function() {
      self.oembetter = require('oembetter')();
      // Don't permit oembed of untrusted sites, which could
      // lead to XSS attacks

      self.oembetter.whitelist(self.oembetter.suggestedWhitelist.concat(self.options.whitelist || [], [ 'wufoo.com', 'infogr.am', 'slideshare.net' ]));
      self.oembetter.endpoints(self.oembetter.suggestedEndpoints.concat(self.options.endpoints || []));
    };

    self.enhanceOembetter = function() {
      require('./lib/youtube.js')(self, self.oembetter);
      require('./lib/vimeo.js')(self, self.oembetter);
      require('./lib/wufoo.js')(self, self.oembetter);
      require('./lib/infogram.js')(self, self.oembetter);
    };

    self.createRoutes = function() {
      // Simple REST API to self.query, with caching. Accepts url and
      // alwaysIframe parameters; alwaysIframe is assumed false
      // if not provided. The response is a JSON object as returned
      // by apos.oembed. You may use GET or POST
      self.route('get', 'query', function(req, res) {
        var url = self.apos.launder.string(req.query.url);
        var options = {
          alwaysIframe: self.apos.launder.boolean(req.query.alwaysIframe),
          iframeHeight: self.apos.launder.integer(req.query.iframeHeight)
        };
        return self.query(url, options, function(err, result) {
          if (err) {
            res.statusCode = 404;
            return res.send('not found');
          }
          return res.send(result);
        });
      });
    };

    require('./lib/api.js')(self);
  }
};

