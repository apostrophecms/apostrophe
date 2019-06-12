const _ = require('lodash');

module.exports = function(self, options) {

  self.apiRoute('post', 'upload', self.middleware.canUpload, self.apos.middleware.files, async function(req) {
    // The name attribute could be anything because of how fileupload
    // controls work; we don't really care.
    const file = _.values(req.files || {})[0];
    if (!file) {
      throw 'notfound';
    }
    return self.accept(req, file);
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

  self.apiRoute('post', 'crop', self.middleware.canUpload, async function(req) {
    let _id = self.apos.launder.id(req.body._id);
    let crop = req.body.crop;
    if ((typeof crop) !== 'object') {
      throw 'invalid';
    }
    crop = self.sanitizeCrop(crop);
    if (!crop) {
      throw 'invalid';
    }
    await self.crop(req, _id, crop);
    return true;
  });

};
