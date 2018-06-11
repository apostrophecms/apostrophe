var async = require('async');
var request = require('request');
var cheerio = require('cheerio');

module.exports = function(self, options) {

  // This method fetches the specified URL, determines its best embedded
  // representation via `oembetter`, and on success invokes its callback with null
  // and an object containing the oembed API response from the service provider.
  //
  // If `oembetter` has no luck, open graph is used as a fallback,
  // unless `options.neverOpenGraph` is set.
  //
  // If `options.alwaysIframe` is true, the result is a simple
  // iframe of the URL. If `options.iframeHeight` is set, the iframe
  // has that height in pixels, otherwise it is left to CSS.
  //
  // The `options` object is passed on to `oembetter.fetch`.
  //
  // Responses are automatically cached, by default for one hour. See the
  // cacheLifetime option to the module.

  self.query = function(req, url, options, mainCallback) {
    if (!mainCallback) {
      mainCallback = options;
      options = {};
    }
    if (!self.cache) {
      self.cache = self.apos.caches.get('oembed');
    }
    var response;
    // Tolerant URL handling
    url = self.apos.launder.url(url);
    if (!url) {
      return mainCallback("Video URL invalid");
    }
    var key = url + ':' + JSON.stringify(options);
    return async.series({
      checkCache: function(callback) {
        return self.cache.get(key, function(err, response) {
          if (err) {
            return callback(err);
          }
          if (response !== undefined) {
            return mainCallback(err, response);
          }
          return callback(null);
        });
      },
      fetch: function(callback) {
        if (options.alwaysIframe) {
          return self.iframe(req, url, options, function(err, _response) {
            if (err) {
              return callback(err);
            }
            response = _response;
            return callback(null);
          });
        }
        return self.oembetter.fetch(url, options, function(err, _response) {
          if (err) {
            if (options.neverOpenGraph) {
              return callback(err);
            }
            // Try open graph as a fallback
            return self.openGraph(req, url, function(err, _response) {
              if (err) {
                return callback(err);
              }
              response = _response;
              return callback(null);
            });
          }
          response = _response;
          return callback(null);
        });
      },
      forceSsl: function(callback) {
        // Make non-secure URLs protocol relative and
        // let the browser upgrade them to https if needed
        function makeProtocolRelative(s) {
          s = s.replace(/^http:\/\//, '//');
          return s.replace(/(["'])http:\/\//g, '$1//');
        }
        if (response.thumbnail_url) {
          response.thumbnail_url = makeProtocolRelative(response.thumbnail_url);
        }
        if (response.html) {
          response.html = makeProtocolRelative(response.html);
        }
        return setImmediate(callback);
      },
      setCache: function(callback) {
        // cache oembed responses for one hour
        return self.cache.set(key, response, self.options.cacheLifetime, callback);
      }
    }, function(err) {
      if (err) {
        return mainCallback(err);
      }
      return mainCallback(err, response);
    });
  };

  // Given a URL, return a nice oembed response for it
  // based on its Open Graph tags, or the best we can
  // fake, based on the HTML markup of the page. Called
  // for you by `self.query` if `oembetter` is unsuccessful.

  self.openGraph = function(req, url, callback) {
    return request(url, function(err, response, body) {
      if (err) {
        return callback(err);
      }
      if (response.statusCode >= 400) {
        return callback(response.statusCode);
      }
      var $;
      try {
        $ = cheerio.load(body);
      } catch (e) {
        return callback('cheerio parsing error');
      }
      var title = $('meta[property="og:title"]').attr('content') ||
        $('title').text();
      if (!title) {
        // A common goof these days
        title = $('h1').text();
        if (!title) {
          // Oh c'mon
          title = url;
        }
      }
      var type = $('meta[property="og:type"]').attr('content') ||
        'website';

      var image = $('meta[property="og:image"]').attr('content');
      if (!image) {
        // Looks like cheerio doesn't do :first yet?
        var $img = $('img');
        if ($img.length) {
          image = $img.attr('src');
        }
      }
      if (image) {
        if (image.match(/^\w+:/)) {
          if (!image.match(/^https?:/)) {
            // No dangerous schemes
            image = undefined;
          }
        } else {
          // Relative URL
          image = require('url').resolve(url, image);
        }
      }
      if (!image) {
        image = undefined;
      }
      var description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
      if (!description) {
        // Remove text that isn't text
        $('script').remove();
        $('styles').remove();
        description = $('body').text();
      }
      description = self.apos.utils.truncatePlaintext(description, 300);
      url = $('meta[property="og:url"]').attr('content') ||
        url;
      var markup = self.render(req, 'openGraphEmbed.html', { title: title, type: type, image: image, description: description, url: url });
      return callback(null, {
        thumbnail_url: image,
        title: title,
        type: 'rich',
        html: markup
      });
    });
  };

  // Given a URL, return an oembed response for it
  // which just iframes the URL given. Fetches the page
  // first to get the title property.
  //
  // If options.iframeHeight is set, use that # of
  // pixels, otherwise do not specify & let CSS do it.
  //
  // Called by `self.query` if the `alwaysIframe` option
  // is true.

  self.iframe = function(req, url, options, callback) {
    return request(url, function(err, response, body) {
      if (err) {
        return callback(err);
      }
      try {
        var $ = cheerio.load(body);
      } catch (e) {
        // don't let cheerio take us down if body is dodgy
      }
      var title = url;
      if ($) {
        title = $('meta[property="og:title"]').attr('content') ||
          $('title').text();
        if (!title) {
          // A common goof these days
          title = $('h1').text();
          if (!title) {
            // Oh c'mon
            title = url;
          }
        }
      }
      var style = '';
      var html = '<iframe STYLE src="' + self.escapeHtml(url) + '" class="apos-always-iframe"></iframe>';
      if (options.iframeHeight) {
        style = 'style="height:' + options.iframeHeight + 'px"';
      }
      html = html.replace('STYLE', style);
      return callback(null, {
        title: title,
        type: 'rich',
        html: html
      });
    });
  };

  // Returns browser-side javascript to load a given
  // cross-domain js file dynamically and then run
  // the javascript code in the `then` string argument.
  // `script` should be a URL pointing to the third-party
  // js file and may start with // to autoselect
  // http or https depending on how the page was loaded.
  //
  // You may supply an id attribute for the script tag.
  // Some services rely on these (infogr.am).
  //
  // You may also supply the ID of an element that the
  // script should be inserted immediately before. Some
  // services try to infer how they should behave from the
  // context the script tag is in (infogr.am).
  //
  // This code was inspired by the wufoo embed code and
  // is used to dynamically load wufoo and other services
  // that use js-based embed codes. See the oembetter
  // filter in `wufoo.js`.

  self.afterScriptLoads = function(script, beforeId, scriptId, then) {

    if (script.match(/^\/\//)) {
      script = "('https:' == d.location.protocol ? 'https:' : 'http:') + '" + script + "'";
    } else {
      script = "'" + script + "'";
    }
    if (scriptId) {
      scriptId = 's.id = "' + scriptId + '"; ';
    } else {
      scriptId = '';
    }
    var before;
    if (beforeId) {
      before = 'd.getElementById("' + beforeId + '")';
    } else {
      before = 'd.getElementsByTagName(t)[0]';
    }
    return '<script type="text/javascript">' +
      '(function(d, t) {' +
      'var s = d.createElement(t);' +
      "s.src = " + script + ";" +
      scriptId +
      "s.onload = s.onreadystatechange = function() {" +
        "var rs = this.readyState; if (rs) if (rs != 'complete') if (rs != 'loaded') return;" +
        then +
      "};" +
      "var scr = " + before + ", par = scr.parentNode; par.insertBefore(s, scr);" +
      "})(document, 'script');" +
      "</script>";
  };

};
