var request = require('request');
var cheerio = require('cheerio');

module.exports = function(self, oembetter) {

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
      if ((!err) && (response.statusCode < 400)) {
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
      return callback(null, url, options, { type: 'video',
        html:
        '<iframe width="560" height="315" src="//www.youtube.com/embed/videoseries?list=' + id + '" frameborder="0" allowfullscreen></iframe>',
        title: title || 'YouTube Playlist',
        thumbnail_url: 'https://i.ytimg.com/vi/' + firstVideoId + '/hqdefault.jpg'
      }
      );
    });
  });
};
