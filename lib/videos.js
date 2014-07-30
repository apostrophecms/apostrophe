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
    var maxResImage = response.thumbnail_url.replace('hqdefault.jpg', 'maxresdefault.jpg');

    return request.head(maxResImage, function(err, httpResponse) {
      if (response.statusCode < 400) {
        response.thumbnail_url = maxResImage;
      }
      return callback(null);
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
      canonical: function(callback) {
        var matches = url.match(/(\w+)\.wufoo\.com\/forms\/[\w]+\-[\w\-]+/);
        if (!matches) {
          return mainCallback(null);
        }
        return request(url, function(err, response, body) {
          if (err) {
            return callback(err);
          }
          var matches = body.match(/\"(https?\:\/\/\w+\.wufoo\.com\/forms\/\w+)\/\"/);
          if (matches) {
            url = matches[1];
          }
          // Is it a canonical Wufoo URL?
          matches = url.match(/(\w+)\.wufoo\.com\/forms\/([\w]+)/);
          if (!matches) {
            // None of our beeswax
            return mainCallback(null);
          }
          who = matches[1];
          what = matches[2];

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
  // IF YOU WANT TO ADJUST THE RESPONSE: look ^^^ at the
  // "oembetter.addAfter" calls above. Also see the oembetter
  // documentation. Do NOT special case them in the function below.
  //
  // Thanks! -Tom

  self.oembed = function(url, mainCallback) {
    if (!self._oembedCache) {
      self._oembedCache = self.getCache('oembed');
    }
    var response;
    return async.series({
      checkCache: function(callback) {
        return self._oembedCache.get(url, function(err, _response) {
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
        return oembetter.fetch(url, function(err, _response) {
          if (err) {
            return callback(err);
          }
          response = _response;
          return callback(null);
        });
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

  // Simple REST API to apos.oembed. The URL is passed via the url property of the
  // query string. The response is a JSON object as returned by apos.oembed

  self.app.get('/apos/oembed', function(req, res) {
    return self.oembed(self.sanitizeString(req.query.url), function(err, result) {
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
    var url = self.sanitizeString(req.body.video);
    return self.oembed(url, function(err, result) {
      if (err) {
        console.log(err);
        res.statusCode = 404;
        return res.send('not found');
      }
      var width = result.width;
      var height = result.height;
      var video = {
        title: result.title,
        width: width,
        height: height,
        video: url,
        type: result.type,
        thumbnail: result.thumbnail_url,
        landscape: width > height,
        portrait: height > width,
        searchText: self.sortify(req.body.title),
        createdAt: new Date()
      };
      return self.videos.findOne({ video: req.body.video }, function(err, doc) {
        if (err) {
          res.statusCode = 500;
          return res.send('error');
        }
        if (doc) {
          return res.send(doc);
        }
        return self.videos.insert(video, function(err, doc) {
          if (err) {
            res.statusCode = 500;
            return res.send('error');
          }
          return res.send(doc);
        });
      });
    });
  });

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
