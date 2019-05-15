var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.apiRoute('post', 'upload', self.middleware.canUpload, self.apos.middleware.files, function(req, res, next) {
    // Must use text/plain for file upload responses in IE <= 9,
    // doesn't hurt in other browsers. -Tom
    res.header("Content-Type", "text/plain");
    // The name attribute could be anything because of how fileupload
    // controls work; we don't really care.
    var file = _.values(req.files || {})[0];
    if (!file) {
      return next('notfound');
    }
    return self.accept(req, file, function(err, file) {
      if (err) {
        return next(err);
      }
      if (req.query.html) {
        res.setHeader('Content-Type', 'text/html');
      }
      return next(null, { file: file });
    });
  });

  // Crop a previously uploaded image, based on the `id` POST parameter
  // and the `crop` POST parameter. `id` should refer to an existing
  // file in /attachments. `crop` should contain top, left, width and height
  // properties.
  //
  // This route uploads a new, cropped version of
  // the existing image to uploadfs, named:
  //
  // /attachments/ID-NAME.top.left.width.height.extension
  //
  // The `crop` object is appended to the `crops` array property
  // of the file object.

  self.apiRoute('post', 'crop', self.middleware.canUpload, function(req, res, next) {
    var _id = self.apos.launder.id(req.body._id);
    var crop = req.body.crop;
    if (typeof (crop) !== 'object') {
      return next('invalid');
    }
    crop = self.sanitizeCrop(crop);
    if (!crop) {
      return next('nocrop');
    }
    return self.crop(req, _id, crop, next);
  });

  self.renderRoute('post', 'crop-editor', self.middleware.canUpload, function(req, res, next) {
    return next(null, {
      template: 'cropEditor'
    });
  });

  self.renderRoute('post', 'focal-point-editor', self.middleware.canUpload, function(req, res, next) {
    return next(null, {
      template: 'focalPointEditor'
    });
  });

};
