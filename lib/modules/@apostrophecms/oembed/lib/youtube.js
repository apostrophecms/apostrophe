const cheerio = require('cheerio');

module.exports = function(self, oembetter) {

  // Make YouTube thumbnails bigger, and embeds opaque to
  // fix z-index problems

  oembetter.addAfter(async (url, options, response, cb) => {
    if (!url.match(/youtube/)) {
      return setImmediate(cb);
    }

    // Fix YouTube iframes to use wmode=opaque so they don't
    // ignore z-index in Windows Chrome
    response.html = response.html.replace('feature=oembed', 'feature=oembed&wmode=opaque');

    // Fix thumbnail to be largest available if it exists
    if (!response.thumbnail_url) {
      return setImmediate(cb);
    }

    let maxResImage = response.thumbnail_url.replace('hqdefault.jpg', 'maxresdefault.jpg');

    try {
      const response = await self.apos.http.head(maxResImage);
      response.thumbnail_url = maxResImage;
      return cb(null);
    } catch (e) {
      return cb(e);
    }
  });

  // Fake oembed for YouTube playlists, they don't have
  // it for playlists for some crazy reason
  //
  // Example:
  // https://www.youtube.com/playlist?list=PL8E30EA58E2FDB48B

  oembetter.addBefore(async (url, options, response, cb) => {
    if (!url.match(/youtube.*?playlist/)) {
      return setImmediate(cb);
    }
    let matches = url.match(/list=([^&]+)/);
    if (!matches) {
      return setImmediate(cb);
    }
    let id = matches[1];
    try {
      const body = await self.apos.http.get(url);
      let $ = cheerio.load(body);
      let $title = $('title');
      let title = $title.text();
      if (title) {
        title = title.trim();
      }
      // This is a terrible hack but it's effective for now
      // and means every single A2 developer doesn't need
      // their own API key
      let firstVideoId = $('#pl-video-list [data-video-id]').attr('data-video-id');
      if (!firstVideoId) {
        // Unable to continue without a thumbnail
        return cb(null);
      }
      return cb(null, url, options, { type: 'video',
        html:
        '<iframe width="560" height="315" src="//www.youtube.com/embed/videoseries?list=' + id + '" frameborder="0" allowfullscreen></iframe>',
        title: title || 'YouTube Playlist',
        thumbnail_url: 'https://i.ytimg.com/vi/' + firstVideoId + '/hqdefault.jpg'
      });
    } catch (e) {
      return cb(e);
    }
  });
};
