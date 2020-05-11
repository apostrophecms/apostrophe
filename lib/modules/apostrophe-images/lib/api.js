var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  // This method is available as a template helper: apos.images.first
  //
  // Find the first image attachment referenced within an object that may have attachments
  // as properties or sub-properties.
  //
  // For best performance be reasonably specific; don't pass an entire page or piece
  // object if you can pass page.thumbnail to avoid an exhaustive search, especially
  // if the page has many joins.
  //
  // For ease of use, a null or undefined `within` argument is accepted.
  //
  // Note that this method doesn't actually care if the attachment is part of
  // an `apostrophe-images` piece or not. It simply checks whether the `group`
  // property is set to `images`.
  //
  // Examples:
  //
  // 1. First image in the body area please
  //
  // apos.images.first(page.body)
  //
  // 2. Must be a GIF
  //
  // apos.images.first(page.body, { extension: 'gif' })
  //
  // (Note Apostrophe always uses .jpg for JPEGs.)
  //
  // OPTIONS:
  //
  // You may specify `extension` or `extensions` (an array of extensions)
  // to filter the results.

  self.first = function(within, options) {
    options = options ? _.clone(options) : {};
    options.group = 'images';
    var result = self.apos.attachments.first(within, options);
    return result;
  };

  // This method is available as a template helper: apos.images.all
  //
  // Find all image attachments referenced within an object that may have attachments
  // as properties or sub-properties.
  //
  // For best performance be reasonably specific; don't pass an entire page or piece
  // object if you can pass page.thumbnail to avoid an exhaustive search, especially
  // if the page has many joins.
  //
  // When available, the `_description`, `_credit`, `_creditUrl`, and '_title' are
  // also returned as part of the object.
  //
  // For ease of use, a null or undefined `within` argument is accepted.
  //
  // Note that this method doesn't actually care if the attachment is part of
  // an `apostrophe-images` piece or not. It simply checks whether the `group`
  // property is set to `images`.
  //
  // Examples:
  //
  // 1. All images in the body area please
  //
  // apos.images.all(page.body)
  //
  // 2. Must be GIFs
  //
  // apos.images.all(page.body, { extension: 'gif' })
  //
  // (Note Apostrophe always uses .jpg for JPEGs.)
  //
  // OPTIONS:
  //
  // You may specify `extension` or `extensions` (an array of extensions)
  // to filter the results.

  self.all = function(within, options) {
    options = options ? _.clone(options) : {};
    options.group = 'images';
    return self.apos.attachments.all(within, options);
  };

  // This method is available as a template helper: apos.images.srcset
  //
  // Given an image attachment, return a string that can be used as the value
  // of a `srcset` HTML attribute.

  self.srcset = function(attachment, cropRelationship) {
    if (!self.apos.attachments.isSized(attachment)) {
      return '';
    }

    // Since images are never scaled up once uploaded, we only need to include a
    // single image size that's larger than the original image (if such an image
    // size exists) to cover as many bases as possible
    var includedOriginalWidth = false;

    var sources = self.apos.attachments.imageSizes.filter(function(imageSize) {
      if (imageSize.width < attachment.width) {
        return true;
      } else if (!includedOriginalWidth) {
        includedOriginalWidth = true;
        return true;
      }
    }).map(function(imageSize) {
      var src = self.apos.attachments.url(attachment, { size: imageSize.name, crop: cropRelationship });
      var width = Math.min(imageSize.width, attachment.width);

      return src + ' ' + width + 'w';
    });

    return sources.join(', ');
  };

  self.isCroppable = function(image) {
    return image && self.apos.attachments.isCroppable(image.attachment);
  };

  self.enableHelpers = function() {
    self.addHelpers(_.pick(self, 'first', 'all', 'srcset', 'isCroppable'));
  };

  // Make the minimum size, if any, accessible to the templates
  self.afterList = function(req, results, callback) {
    var minSize = (req.body.filters && req.body.filters.minSize) || req.body.minSize;
    if (minSize) {
      results.minSize = [
        self.apos.launder.integer(minSize[0]),
        self.apos.launder.integer(minSize[1])
      ];
    }
    return callback(null);
  };

  var superGetListProjection = self.getListProjection;
  self.getListProjection = function(req) {
    var projection = superGetListProjection(req);
    projection.attachment = 1;
    return projection;
  };

};
