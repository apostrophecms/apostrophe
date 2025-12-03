const oembed = require('./oembed.js');
const async = require('async');
const filters = require('./filters.js');

module.exports = function(options) {

  const self = {};

  if (!options) {
    options = {};
  }

  self.before = filters.before.concat(options.before || []);
  self.after = filters.after.concat(options.after || []);
  self.fallback = filters.fallback.concat(options.fallback || []);

  self.fetch = function(url, options, callback) {
    let i;
    if (arguments.length === 2) {
      callback = options;
      options = {};
    }

    if (url.match(/^\/\//)) {
      // Protocol-relative URLs are commonly found
      // in markup these days and can be upgraded
      // to https so that they work
      url = 'https:' + url;
    }
    let response;
    const warnings = [];
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return callback(new Error('oembetter: invalid URL: ' + url));
    }
    if ((parsed.protocol !== 'http:') && (parsed.protocol !== 'https:')) {
      return callback(new Error('oembetter: URL is neither http nor https: ' + url));
    }
    if (self._allowlist) {
      let good = false;
      for (i = 0; (i < self._allowlist.length); i++) {
        if (!parsed.hostname) {
          continue;
        }
        if (self.inDomain(self._allowlist[i], parsed.hostname)) {
          good = true;
          break;
        }
      }
      if (!good) {
        return callback(new Error('oembetter: ' + url + ' is not in an allowed domain.'));
      }
    }
    let endpoint = false;
    if (self._endpoints) {
      for (i = 0; i < self._endpoints.length; i++) {
        if (!parsed.hostname) {
          continue;
        }
        if (!self.inDomain(self._endpoints[i].domain, parsed.hostname)) {
          continue;
        }
        if (self._endpoints[i].path) {
          if ((!parsed.pathname) || (!parsed.pathname.match(self._endpoints[i].path))) {
            continue;
          }
        }
        endpoint = self._endpoints[i].endpoint;
        break;
      }
    }
    return async.series({
      before: function(callback) {
        return async.eachSeries(self.before, function(before, callback) {
          return before(url, options, response, function(err, _url, _options, _response) {
            // Nonfatal
            if (err) {
              warnings.push(err);
              return callback(null);
            }
            url = _url || url;
            options = _options || options;
            response = _response || response;
            return callback(null);
          });
        }, callback);
      },
      fetch: function(callback) {
        if (response) {
          // Preempted by a before
          return callback(null);
        }
        return oembed(url, options, endpoint, function (err, result) {

          response = result;
          if (err) {
            // not necessarily fatal
            warnings.push(err);
          }
          return callback(null);
        });
      },
      fallback: function(fallbackCallback) {
        if (response) {
          return setImmediate(fallbackCallback);
        }
        return async.eachSeries(self.fallback, function(fallback, callback) {
          return fallback(url, options, function(err, _response) {
            if (err) {
              warnings.push(err);
              return callback(err);
            }
            response = _response || response;
            if (response) {
              // Stop trying fallbacks, we got one
              return fallbackCallback(null);
            }
            return callback(null);
          });
        }, fallbackCallback);
      },
      after: function(callback) {
        if (!response) {
          return setImmediate(callback);
        }
        return async.eachSeries(self.after, function(after, callback) {
          return after(url, options, response, function(err, _response) {
            if (err) {
              warnings.push(err);
              return callback(err);
            }
            response = _response || response;
            return callback(null);
          });
        }, callback);
      }
    }, function(err) {
      // Handle fatal errors
      if (err) {
        return callback(err);
      }
      // If there is no response, treat the first
      // warning as a fatal error
      if (!response) {
        if (warnings.length) {
          return callback(warnings[0], warnings);
        }
      }

      // If there is a response, make the warnings available as the
      // third argument
      return callback(null, response, warnings);
    });
  };

  self.addBefore = function(fn) {
    self.before.push(fn);
  };

  self.addAfter = function(fn) {
    self.after.push(fn);
  };

  self.addFallback = function(fn) {
    self.fallback.push(fn);
  };

  self.inDomain = function(domain, hostname) {

    hostname = hostname.toLowerCase();
    domain = domain.toLowerCase();
    if (hostname === domain) {
      return true;
    }
    if (hostname.substr(-domain.length - 1) === ('.' + domain)) {
      return true;
    }
    return false;
  };

  self.allowlist = function(_allowlist) {
    self._allowlist = _allowlist;
  };

  self.suggestedAllowlist = [
    'youtube.com',
    'youtu.be',
    'blip.tv',
    'dailymotion.com',
    'flickr.com',
    'hulu.com',
    'nfb.ca',
    'qik.com',
    'revision3.com',
    'scribd.com',
    'viddler.com',
    'vimeo.com',
    'youtube.com',
    'dotsub.com',
    'yfrog.com',
    'photobucket.com',
    'soundcloud.com',
    'instagram.com',
    'twitter.com',
    'facebook.com'
  ];

  self.suggestedEndpoints = [
    {
      domain: 'instagram.com',
      endpoint: 'http://api.instagram.com/oembed'
    },
    {
      domain: 'facebook.com',
      path: /\/videos\//,
      endpoint: 'https://www.facebook.com/plugins/video/oembed.json/'
    },
    {
      domain: 'facebook.com',
      path: /\/posts\//,
      endpoint: 'https://www.facebook.com/plugins/post/oembed.json/'
    },
    {
      domain: 'vimeo.com',
      endpoint: 'https://vimeo.com/api/oembed.json'
    },
    {
      domain: 'youtube.com',
      endpoint: 'https://www.youtube.com/oembed'
    },
    {
      domain: 'youtu.be',
      endpoint: 'https://www.youtube.com/oembed'
    }
  ];

  self.endpoints = function(_endpoints) {
    self._endpoints = _endpoints;
  };

  return self;
};
