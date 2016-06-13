module.exports = function(self, oembetter) {

  // Make vimeo thumbnails bigger

  oembetter.addAfter(function(url, options, response, callback) {
    if (!url.match(/vimeo/)) {
      return setImmediate(callback);
    }
    // Fix vimeo thumbnails to be larger
    response.thumbnail_url = response.thumbnail_url.replace('640.jpg', '1000.jpg');
    return callback(null);
  });
};
