const cheerio = require('cheerio');

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
  options: {
    alias: 'oembed',
    cacheLifetime: 60 * 60
  },
  init(self, options) {
    self.createOembetter();
    self.enhanceOembetter();
    self.enableBrowserData();
  },
  methods(self, options) {
    return {

      // Creates an instance of the `oembetter` module and adds the standard whitelist.
      // Called by `afterConstruct`.

      createOembetter() {
        self.oembetter = require('oembetter')();
        // Don't permit oembed of untrusted sites, which could
        // lead to XSS attacks

        self.oembetter.whitelist(self.oembetter.suggestedWhitelist.concat(self.options.whitelist || [], [
          'wufoo.com',
          'infogr.am',
          'slideshare.net'
        ]));
        self.oembetter.endpoints(self.oembetter.suggestedEndpoints.concat(self.options.endpoints || []));
      },

      // Enhances oembetter to support services better or to support services
      // that have no oembed support by default. Called by `afterConstruct`.
      // Extend this method to add additional `oembetter` filters.

      enhanceOembetter() {
        require('./lib/youtube.js')(self, self.oembetter);
        require('./lib/vimeo.js')(self, self.oembetter);
        require('./lib/wufoo.js')(self, self.oembetter);
        require('./lib/infogram.js')(self, self.oembetter);
      },

      // This method fetches the specified URL, determines its best embedded
      // representation via `oembetter`, and on success returns an
      // object containing the oembed API response from the service provider.
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
      async query(req, url, options) {
        if (!options) {
          options = {};
        }
        if (!self.cache) {
          self.cache = self.apos.cache.get('oembed');
        }
        // Tolerant URL handling
        url = self.apos.launder.url(url);
        if (!url) {
          throw new Error('Video URL invalid');
        }
        const key = url + ':' + JSON.stringify(options);
        let response = await self.cache.get(key);
        if (response !== undefined) {
          return response;
        }
        if (options.alwaysIframe) {
          response = await self.iframe(req, url, options);
        } else {
          try {
            response = await require('util').promisify(self.oembetter.fetch)(url, options);
          } catch (err) {
            if (!options.neverOpenGraph) {
              response = await self.openGraph(req, url);
            }
          }
        }
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
        // cache oembed responses for one hour
        await self.cache.set(key, response, self.options.cacheLifetime);
        return response;
      },
      // Given a URL, return a nice oembed response for it
      // based on its Open Graph tags, or the best we can
      // fake, based on the HTML markup of the page. Called
      // for you by `self.query` if `oembetter` is unsuccessful.
      async openGraph(req, url) {
        const body = await self.apos.http.get(url);
        const $ = cheerio.load(body);
        let title = $('meta[property="og:title"]').attr('content') || $('title').text();
        if (!title) {
          // A common goof these days
          title = $('h1').text();
          if (!title) {
            // Oh c'mon
            title = url;
          }
        }
        const type = $('meta[property="og:type"]').attr('content') || 'website';
        let image = $('meta[property="og:image"]').attr('content');
        if (!image) {
          // Looks like cheerio doesn't do :first yet?
          const $img = $('img');
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
            image = new URL(image, url).toString();
          }
        }
        if (!image) {
          image = undefined;
        }
        let description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
        if (!description) {
          // Remove text that isn't text
          $('script').remove();
          $('styles').remove();
          description = $('body').text();
        }
        description = self.apos.util.truncatePlaintext(description, 300);
        url = $('meta[property="og:url"]').attr('content') || url;
        const markup = self.render(req, 'openGraphEmbed.html', {
          title: title,
          type: type,
          image: image,
          description: description,
          url: url
        });
        return {
          thumbnail_url: image,
          title: title,
          type: 'rich',
          html: markup
        };
      },
      // Given a URL, return an oembed response for it
      // which just iframes the URL given. Fetches the page
      // first to get the title property.
      //
      // If options.iframeHeight is set, use that # of
      // pixels, otherwise do not specify & let CSS do it.
      //
      // Called by `self.query` if the `alwaysIframe` option
      // is true.
      async iframe(req, url, options) {
        const body = await self.apos.http.get(url);
        const $ = cheerio.load(body);
        let title = url;
        if ($) {
          title = $('meta[property="og:title"]').attr('content') || $('title').text();
          if (!title) {
            // A common goof these days
            title = $('h1').text();
            if (!title) {
              // Oh c'mon
              title = url;
            }
          }
        }
        let style = '';
        let html = '<iframe STYLE src="' + self.escapeHtml(url) + '" class="apos-always-iframe"></iframe>';
        if (options.iframeHeight) {
          style = 'style="height:' + options.iframeHeight + 'px"';
        }
        html = html.replace('STYLE', style);
        return {
          title: title,
          type: 'rich',
          html: html
        };
      },
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
      afterScriptLoads(script, beforeId, scriptId, then) {
        if (script.match(/^\/\//)) {
          script = '(\'https:\' == d.location.protocol ? \'https:\' : \'http:\') + \'' + script + '\'';
        } else {
          script = '\'' + script + '\'';
        }
        if (scriptId) {
          scriptId = 's.id = "' + scriptId + '"; ';
        } else {
          scriptId = '';
        }
        let before;
        if (beforeId) {
          before = 'd.getElementById("' + beforeId + '")';
        } else {
          before = 'd.getElementsByTagName(t)[0]';
        }
        return '<script type="text/javascript">' + '(function(d, t) {' + 'var s = d.createElement(t);' + 's.src = ' + script + ';' + scriptId + 's.onload = s.onreadystatechange = function() {' + 'var rs = this.readyState; if (rs) if (rs != \'complete\') if (rs != \'loaded\') return;' + then + '};' + 'var scr = ' + before + ', par = scr.parentNode; par.insertBefore(s, scr);' + '})(document, \'script\');' + '</script>';
      },
      getBrowserData(req) {
        // api is public
        return { action: self.action };
      }
    };
  },
  routes(self, options) {
    return {
      // Simple API to self.query, with caching. Accepts url and
      // alwaysIframe parameters; alwaysIframe is assumed false
      // if not provided. The response is a JSON object as returned
      // by apos.oembed. A GET request because it is cache-friendly.
      get: {
        async query(req, res) {
          let url = self.apos.launder.string(req.query.url);
          let options = {
            alwaysIframe: self.apos.launder.boolean(req.query.alwaysIframe),
            iframeHeight: self.apos.launder.integer(req.query.iframeHeight),
            neverOpenGraph: self.apos.launder.boolean(req.query.neverOpenGraph)
          };
          try {
            const result = await self.query(req, url, options);
            res.send(result);
          } catch (err) {
            if ((typeof err) === 'number' && (err >= 400 && err < 600)) {
              // Disclose the HTTP error from upstream
              res.status(err).send('error');
            } else {
              // Doesn't look like a clean HTTP status code
              res.status(404).send('error');
            }
          }
        }
      }
    };
  }
};
