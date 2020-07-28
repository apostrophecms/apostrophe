module.exports = function(self, oembetter) {

  // Make vimeo thumbnails bigger

  oembetter.addAfter(function(url, options, response, cb) {
    if (!url.match(/vimeo/)) {
      return setImmediate(cb);
    }
    // Fix vimeo thumbnails to be larger
    response.thumbnail_url = response.thumbnail_url.replace('640.jpg', '1000.jpg');
    return cb(null);
  });
};
