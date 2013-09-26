var async = require('async');
var oembed = require('oembed');

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

  self.app.get('/apos/browse-videos', function(req, res) {
    return self.permissions(req, 'edit-media', null, function(err) {
      if (err) {
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
  });

  // A simple oembed proxy to avoid cross-site scripting restrictions.
  // Includes bare-bones caching to avoid hitting rate limits.
  // TODO: expiration for caching.
  // TODO: whitelist to avoid accepting oembed from evil XSS sites.

  var oembedCache = {};

  // This method fetches the specified URL, determines its best embedded
  // representation via oembed, and on success invokes its callback with null
  // and an object containing the oembed API response from the service provider.
  //
  // Responses are automatically cached, currently for the lifetime of the
  // server process.
  //
  // YouTube responses are automatically adjusted to use `wmode=opaque` to prevent
  // z-index problems in the browser. Additional customization of responses,
  // virtual responses for less cooperative service providers, and whitelisting
  // are planned.

  self.oembed = function(url, callback) {
    if (oembedCache[url]) {
      return callback(null, oembedCache[url]);
    }
    return oembed.fetch(url, {}, function (err, result) {
      if (err) {
        return callback(err);
      } else {
        // Hack: fix YouTube iframes to used wmode=opaque so they don't bleed through
        // dialogs and editors in Windows Chrome. TODO: an elegant way of registering
        // oembed fixer-uppers for various dodgy oembed services
        if (url.match(/youtube/)) {
          result.html = result.html.replace('feature=oembed', 'feature=oembed&wmode=opaque');
        }
        oembedCache[url] = result;
        return callback(null, result);
      }
    });
  };

  // Simple REST API to apos.oembed. The URL is passed via the url property of the
  // query string. The response is a JSON object as returned by apos.oembed

  self.app.get('/apos/oembed', function(req, res) {
    return self.oembed(self.sanitizeString(req.query.url), function(err, result) {
      if (err) {
        console.log(err);
        res.statusCode = 404;
        return res.send('not found');
      }
      return res.send(result);
    });
  });

  // Store a video object for potential reuse. Saves metadata
  // such as the title, width, height, video URL, thumbnail URL
  // and search text. TODO: get more information from the
  // service providers if possible. The URL should be sent in
  // the `video` POST parameter. The response is
  // a JSON object containing metadata about the video, or
  // an appropriate HTTP error status code.
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
        title: req.body.title,
        width: width,
        height: height,
        video: url,
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
          return oembed.fetch(item.video, {}, function (err, result) {
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

