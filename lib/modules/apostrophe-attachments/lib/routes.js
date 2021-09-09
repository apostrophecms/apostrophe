const _ = require('@sailshq/lodash');
const request = require('request');
const path = require('path');

module.exports = function(self, options) {

  self.apiRoute('post', 'upload',
    self.middleware.canUpload,
    self.apos.middleware.files,
    self.apos.middleware.heicImages,
    function(req, res, next) {
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
    }
  );

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

  // Provides a simple route to download a file as an attachment, rather than
  // viewing it. Pipes it from the regular public URL to avoid acting as a
  // bypass of permissions
  self.apiRoute('get', 'download', async (req, res) => {
    const _id = self.apos.launder.id(req.query._id);
    const info = await self.db.findOne({
      _id: _id
    });
    if (!info) {
      return res.status(404).send('notfound');
    }
    const url = self.url(info, { size: 'original' });
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(url)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const resolvedUrl = (new URL(url, req.absoluteUrl)).toString();
    await request(resolvedUrl).pipe(res);
  });
};
