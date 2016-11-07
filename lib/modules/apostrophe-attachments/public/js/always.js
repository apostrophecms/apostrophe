apos.define('apostrophe-attachments', {
  extend: 'apostrophe-context',
  construct: function(self, options) {

    // Given an attachment field value,
    // return the file URL. If options.size is set, return the URL for
    // that size (one-third, one-half, two-thirds, full). full is
    // "full width" (1140px), not the original.
    //
    // If you don't pass the options object, or options does not
    // have a size property, you'll get the URL of the original.
    //
    // You can also pass a crop object (the crop must already exist).

    self.url = function(file, options) {
      var path = self.uploadsUrl + '/attachments/' + file._id + '-' + file.name;
      if (!options) {
        options = {};
      }
      // NOTE: the crop must actually exist already, you can't just invent them
      // browser-side without the crop API ever having come into play. If the
      // width is 0 the user hit save in the cropper without cropping, use
      // the regular version
      if (file.crop && file.crop.width) {
        var c = file.crop;
        path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
      }
      var effectiveSize;
      if ((file.group !== 'images') || (options.size === 'original')) {
        effectiveSize = false;
      } else {
        effectiveSize = options.size || 'full';
      }
      if (effectiveSize) {
        path += '.' + effectiveSize;
      }
      return path + '.' + file.extension;
    };

    apos.attachments = self;
  }
});
