var async = require('async');
var oembed = require('oembed');

/**
 * videos
 * @augments Augments the apos object with resources supporting video storage and playback
 */

module.exports = function(self) {
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

  // Available separately from the REST API

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

  // Simple REST API to self.oembed

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

  // Store a video object for potential reuse. This is a component
  // of the forthcoming video library feature
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

