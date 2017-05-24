var async = require('async');
var request = require('request');
var oembetter = require('oembetter')();
var cheerio = require('cheerio');

/**
 * videos
 * @augments Augments the apos object with resources supporting video storage and playback
 */

module.exports = function(self) {
  // Retrieve videos. Query parameters are `skip`, `limit` and `q`.
  //
  // `q` searches the metadata of videos.
  // `skip` and `limit` are used to implement pagination. `limit` defauls to 10 and cannot
  // exceed 100.
  //
  // The response is a JSON object with `total` and
  // `videos` properties. The `total` property indicates how many total videos could be returned if
  // pagination were not taking place. `videos` contains an array of video objects with
  // metadata fields `title`, `thumbnail`, `tags`, `video` (the URL of the original video on
  // YouTube or a similar service), `width`, `height`, `credit`, `createdAt`, and `description`
  // among others.
  //
  // In case of error an appropriate HTTP status code is returned.
  //
  // The edit-file permission also applies to videos although they aren't
  // actually stored in local files.

  self.app.get('/apos/browse-videos', function(req, res) {
    if (!self.permissions.can(req, 'edit-file', null)) {
      res.statusCode = 404;
      return res.send('not found');
    }
    var criteria = {};
    var limit = 10;
    var skip = 0;
    var q;
    skip = self.sanitizeInteger(req.query.skip, 0, 0);
    limit = self.sanitizeInteger(req.query.limit, 0, 0, 100);
    if (req.query.q) {
      criteria.searchText = self.searchify(req.query.q);
    }
    if (req.query.type) {
      criteria.type = self.sanitizeString(req.query.type);
    }
    if (req.query.notType) {
      criteria.type = { $ne: self.sanitizeString(req.query.notType) };
    }
    var result = {};
    async.series([
      function(callback) {
        return self.videos.count(criteria, function(err, count) {
          result.total = count;
          return callback(err);
        });
      },
      function(callback) {
        return self.videos.find(criteria).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(function(err, videos) {
          result.videos = videos;
          return callback(err);
        });
      }
    ], function(err) {
      if (err) {
        res.statusCode = 500;
        return res.send('error');
      }
      return res.send(result);
    });
  });

  // Don't permit oembed of untrusted sites, which could
  // lead to XSS attacks

  oembetter.whitelist(oembetter.suggestedWhitelist.concat(self.options.oembedWhitelist || [], [ 'wufoo.com', 'infogr.am', 'slideshare.net' ]));
  oembetter.endpoints(oembetter.suggestedEndpoints.concat(self.options.oembedEndpoints || []));

  // Make YouTube thumbnails bigger, and embeds opaque to
  // fix z-index problems

  oembetter.addAfter(function(url, options, response, callback) {
    if (!url.match(/youtube/)) {
      return setImmediate(callback);
    }

    // Fix YouTube iframes to use wmode=opaque so they don't
    // ignore z-index in Windows Chrome
    response.html = response.html.replace('feature=oembed', 'feature=oembed&wmode=opaque');

    // Fix thumbnail to be largest available if it exists
    if (!response.thumbnail_url) {
      return setImmediate(callback);
    }

    var maxResImage = response.thumbnail_url.replace('hqdefault.jpg', 'maxresdefault.jpg');

    return request.head(maxResImage, function(err, httpResponse) {
      if (response.statusCode < 400) {
        response.thumbnail_url = maxResImage;
      }
      return callback(null);
    });
  });
  
  // Fake oembed for YouTube playlists, they don't have
  // it for playlists for some crazy reason
  //
  // Example:
  // https://www.youtube.com/playlist?list=PL8E30EA58E2FDB48B

  oembetter.addBefore(function(url, options, response, callback) {
    if (!url.match(/youtube.*?playlist/)) {
      return setImmediate(callback);
    }
    var matches = url.match(/list=([^&]+)/);
    if (!matches) {
      return setImmediate(callback);
    }
    var id = matches[1];
    return request(url, function(err, response, body) {
      if (err) {
        return callback(err);
      }
      var $ = cheerio.load(body);
      var $title = $('title');
      var title = $title.text();
      if (title) {
        title = title.trim();
      }
      // This is a terrible hack but it's effective for now
      // and means every single A2 developer doesn't need
      // their own API key
      var firstVideoId = $('#pl-video-list [data-video-id]').attr('data-video-id');
      if (!firstVideoId) {
        // Unable to continue without a thumbnail
        return callback(null);
      }
      return callback(null, url, options, { type: 'video', html:
        '<iframe width="560" height="315" src="//www.youtube.com/embed/videoseries?list=' + id + '" frameborder="0" allowfullscreen></iframe>',
          title: title || 'YouTube Playlist',
          thumbnail_url: 'https://i.ytimg.com/vi/' + firstVideoId + '/hqdefault.jpg'
        }
      );
    });
  });

  // Make vimeo thumbnails bigger

  oembetter.addAfter(function(url, options, response, callback) {
    if (!url.match(/vimeo/)) {
      return setImmediate(callback);
    }
    // Fix vimeo thumbnails to be larger
    response.thumbnail_url = response.thumbnail_url.replace('640.jpg', '1000.jpg');
    return callback(null);
  });

  // Fake oembed for wufoo
  oembetter.addBefore(function(url, options, response, mainCallback) {
    var who, what, title;
    return async.series({
      // If they used a pretty wufoo URL, we have to
      // fetch it and find the canonical URL in it first.
      canonicalize: function(callback) {
        var matches = url.match(/(\w+)\.wufoo\.com\/forms\/[\w]+\-[\w\-]+/);
        if (!matches) {
          return setImmediate(callback);
        }
        return request(url, function(err, response, body) {
          if (err) {
            return callback(err);
          }
          var matches = body.match(/\"(https?\:\/\/\w+\.wufoo\.com\/forms\/\w+)\/\"/);
          if (matches) {
            url = matches[1];
          }
          return callback(null);
        });
      },
      canonical: function(callback) {
        // Is it a canonical Wufoo URL?
        var matches = url.match(/(\w+)\.wufoo\.com\/forms\/([\w]+)/);
        if (!matches) {
          // None of our beeswax
          return mainCallback(null);
        }
        who = matches[1];
        what = matches[2];
        return callback(null);
      },
      title: function(callback) {
        return request(url, function(err, response, body) {
          if (err) {
            return callback(err);
          }
          var $ = cheerio.load(body);
          var $title = $('title');
          title = $title.text();
          if (title) {
            title = title.trim();
          }

          return callback(null);
        });
      }
    }, function(err) {
      // wufoo embed code as of 2014-07-16. -Tom
      return mainCallback(null, url, options, { type: 'rich', html:
        '<div id="wufoo-' + what + '"></div>' +
        afterScriptLoads('//wufoo.com/scripts/embed/form.js', false, false,
          'var s = d.createElement(t), options = {' +
          "'userName':'" + who + "'," +
          "'formHash':'" + what + "'," +
          "'autoResize':true," +
          "'height':'363'," +
          "'async':true," +
          "'host':'wufoo.com'," +
          "'header':'show'," +
          "'ssl':true};" +
          "try { " + what + " = new WufooForm();" + what + ".initialize(options);" + what + ".display(); } catch (e) {};"),
        title: title || 'Wufoo Form',
        thumbnail_url: 'https://www.wufoo.com/images/v3/home/banner.jpg'
      });
    });
  });

  // Fake oembed for infogr.am
  oembetter.addBefore(function(url, options, response, callback) {
    var parse = require('url').parse;
    var parsed = parse(url);
    var title;
    if (!oembetter.inDomain('infogr.am', parsed.hostname)) {
      return setImmediate(callback);
    }
    var matches = url.match(/infogr\.am\/([^\?]+)/);
    if (!matches) {
      return setImmediate(callback);
    }
    var slug = matches[1];
    var anchorId = 'apos_infogram_anchor_0_' + slug;
    return request(url, function(err, response, body) {
      if (err) {
        return callback(err);
      }
      var $ = cheerio.load(body);
      var $title = $('title');
      title = $title.text();
      if (title) {
        title = title.trim();
      }

      return callback(null, url, options, { thumbnail_url: 'https://infogr.am/infogram.png', title: title || 'Infogram', type: 'rich', html: '<div id="' + anchorId + '"></div>' + afterScriptLoads("//e.infogr.am/js/embed.js", anchorId, 'infogram_0_' + slug, ';')
      });
    });
  });

  // Given a URL, return a nice oembed response for it
  // based on its Open Graph tags, or the best we can
  // fake, based on the HTML markup of the page.

  self.openGraphEmbed = function(url, callback) {
    return request(url, function(err, response, body) {
      if (err) {
        return callback(err);
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
      description = self.truncatePlaintext(description, 300);
      url = $('meta[property="og:url"]').attr('content') ||
        url;
      var markup = self.partial('openGraphEmbed.html', { title: title, type: type, image: image, description: description, url: url });
      return callback(null, {
        thumbnail_url: image,
        title: title,
        type: 'rich',
        html: markup
      });
    });
  };

  // Given a URL, return an oembed response for it
  // which just iframes the URL given. The response
  // does have a title property, so we do have to
  // fetch the URL
  //
  // If options.iframeHeight is set, use that # of
  // pixels, otherwise do not specify & let CSS do it

  self.iframeEmbed = function(url, options, callback) {
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
  // that use js-based embed codes.

  function afterScriptLoads(script, beforeId, scriptId, then) {

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
  }

  // This method fetches the specified URL, determines its best embedded
  // representation via oembed, and on success invokes its callback with null
  // and an object containing the oembed API response from the service provider.
  //
  // Responses are automatically cached.
  //
  // If options.alwaysIframe is true, the result is a simple
  // iframe of the URL.
  //
  // IF YOU WANT TO ADJUST THE RESPONSE: look ^^^ at the
  // "oembetter.addAfter" calls above. Also see the oembetter
  // documentation. Do NOT special case them in the function below.
  //
  // Thanks! -Tom

  self.oembed = function(url, options, mainCallback) {
    if (!mainCallback) {
      mainCallback = options;
      options = {};
    }
    if (!self._oembedCache) {
      self._oembedCache = self.getCache('oembed');
    }
    var response;
    var key = url + ':' + JSON.stringify(options);
    return async.series({
      checkCache: function(callback) {
        return self._oembedCache.get(key, function(err, _response) {
          if (err) {
            return callback(err);
          }
          if (_response !== undefined) {
            return mainCallback(err, _response);
          }
          return callback(null);
        });
      },
      fetch: function(callback) {
        if (options.alwaysIframe) {
          return self.iframeEmbed(url, options, function(err, _response) {
            if (err) {
              return callback(err);
            }
            response = _response;
            return callback(null);
          });
        }
        return oembetter.fetch(url, function(err, _response) {
          if (err) {
            // Try open graph as a fallback
            return self.openGraphEmbed(url, function(err, _response) {
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
          s = s.replace(/^http\:\/\//, '//');
          return s.replace(/(["'])http\:\/\//g, '$1//');
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
        return self._oembedCache.set(url, response, 60 * 60, callback);
      }
    }, function(err) {
      if (err) {
        return mainCallback(err);
      }
      return mainCallback(err, response);
    });
  };

  // Simple REST API to apos.oembed. Accepts url and
  // alwaysIframe parameters; alwaysIframe is assumed false
  // if not provided. The response is a JSON object as returned
  // by apos.oembed. You may use GET or POST

  self.app.all('/apos/oembed', function(req, res) {
    var data = (req.method === 'POST') ? req.body : req.query;
    var url = self.sanitizeString(data.url);
    var alwaysIframe = self.sanitizeBoolean(data.alwaysIframe);
    var iframeHeight = self.sanitizeInteger(data.iframeHeight);
    var options = {
      alwaysIframe: alwaysIframe,
      iframeHeight: iframeHeight
    };
    return self.oembed(url, options, function(err, result) {
      if (err) {
        console.error(err);
        res.statusCode = 404;
        return res.send('not found');
      }
      return res.send(result);
    });
  });

  // Store a video or other oembed object for potential reuse.
  // Saves metadata such as the title, width, height, video URL,
  // thumbnail URL and search text. The URL should be sent in
  // the `video` POST parameter. The response is
  // a JSON object with the video information if successful,
  // otherwise an appropriate HTTP status code.

  self.app.post('/apos/remember-video', function(req, res) {
    return self.acceptVideo(req, req.body, function(err, video) {
      if (err) {
        console.log(err);
        res.statusCode = 404;
        return res.send('not found');
      }
      return res.send(video);
    });
  });

  // Insert or update a video in Apostrophe's video reuse library.
  // req is passed for permissions purposes. info should
  // be an object with a `url` property. The video is examined
  // via apos.oembed and, if successful, added to the video
  // reuse collection. The callback is invoked (err, video),
  // where video (if any) is the video object recorded
  // in the reuse library.
  //
  // Note that this method does not give you back an embed code.
  // For that, see apos.oembed.
  //
  // If the optional `alwaysIframe` parameter is true, then
  // an iframe is always used to present the given `url`,
  // at the height specified by the `iframeHeight` parameter.

  self.acceptVideo = function(req, info, callback) {
    // for bc we also accept info.video
    var url = self.sanitizeString(info.url || info.video);
    var alwaysIframe = self.sanitizeBoolean(info.alwaysIframe);
    var iframeHeight = self.sanitizeInteger(info.iframeHeight);
    return self.oembed(url, { alwaysIframe: alwaysIframe }, function(err, result) {
      if (err) {
        return callback(err);
      }
      var width = result.width;
      var height = result.height;
      var video = {
        title: result.title,
        width: width,
        height: height,
        video: url,
        type: result.type,
        alwaysIframe: alwaysIframe,
        thumbnail: result.thumbnail_url,
        landscape: width > height,
        portrait: height > width,
        searchText: self.sortify(result.title),
        createdAt: new Date(),
        iframeHeight: iframeHeight
      };
      var doc;
      return async.series({
        find: function(callback) {
          return self.videos.findOne({ video: url }, function(err, _doc) {
            if (err) {
              return callback(err);
            }
            doc = _doc;
            return callback(null);
          });
        },
        update: function(callback) {
          if (!doc) {
            return setImmediate(callback);
          }
          video._id = doc._id;
          return self.videos.update({ video: url }, video, callback);
        },
        insert: function(callback) {
          if (doc) {
            return setImmediate(callback);
          }
          return self.videos.insert(video, function(err, _doc) {
            if (err) {
              return callback(err);
            }
            doc = _doc;
            return callback(null);
          });
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, doc || video);
      });
    });
  };

  self.tasks.oembed = function(callback) {
    console.log('Refreshing all oembed data for videos');
    // iterator receives page object, area name, area object, item offset, item object.
    var oembedCache = {};
    var n = 0;
    return self.forEachItem(function(page, name, area, offset, item, callback) {

      function go(result) {
        n++;
        console.log('examining video ' + n);
        item.thumbnail = result.thumbnail_url;
        item.title = result.title;
        return self.pages.update({ _id: page._id }, page, function(err, count) {
          return callback(err);
        });
      }

      if (item.type !== 'video') {
        return callback(null);
      }
      if (oembedCache[item.video]) {
        go(oembedCache[item.video]);
      } else {
        // 1/10th second pause between oembed hits to avoid being rate limited
        // (I don't know what their rate limit is, but...)
        setTimeout(function() {
          return oembetter.fetch(item.video, {}, function (err, result) {
            if (!err) {
              oembedCache[item.video] = result;
              go(result);
            } else {
              // A few oembed errors are normal and not cause for panic.
              // Videos go away, for one thing. If you get a zillion of these
              // it's possible you have hit a rate limit
              console.log('Warning: oembed error for ' + item.video + '\n');
              console.log(err);
              return callback(null);
            }
          });
        }, 100);
      }
    }, callback);
  };
};
