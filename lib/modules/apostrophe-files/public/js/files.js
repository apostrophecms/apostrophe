apos.define('apostrophe-files', {
  afterConstruct: function(self) {
    self.addLinks();
  },
  construct: function(self, options) {
    self.options = options;
    self.action = options.action;
    self.uploadsUrl = self.options.uploadsUrl || '';

    self.addLinks = function() {
      apos.ui.link('launch', 'mediaLibrary', function() {
        if (!self.mediaLibrary) {
          self.mediaLibrary = apos.create('apostrophe-media-library', self.options);
        }
      });
    };

    // Given a file object (as found in a slideshow widget for instance),
    // return the file URL. If options.size is set, return the URL for
    // that size (one-third, one-half, two-thirds, full). full is
    // "full width" (1140px), not the original.
    //
    // If you don't pass the options object, or options does not
    // have a size property, you'll get the URL of the original.

    self.url = function(file, options) {
      var path = self.uploadsUrl + '/files/' + file._id + '-' + file.name;
      if (!options) {
        options = {};
      }
      // NOTE: the crop must actually exist already, you can't just invent them
      // browser-side without the crop API never having come into play
      if (file.crop) {
        var c = file.crop;
        path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
      }
      if (options.size) {
        path += '.' + options.size;
      }
      return path + '.' + file.extension;
    };
    apos.files = self;
  }
});
