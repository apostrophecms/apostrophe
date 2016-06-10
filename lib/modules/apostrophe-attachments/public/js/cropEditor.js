apos.define('apostrophe-attachments-crop-editor', {
  extend: 'apostrophe-modal',
  source: 'crop-editor',
  construct: function(self, options) {
    self.attachment = options.attachment;

    // Use afterShow so that .width() works
    self.afterShow = function() {

      self.$cropImage = self.$el.find('[data-crop-image]');
      self.cropWidth = self.$cropImage.width();
      self.$saveButton = self.$el.find('[data-apos-save]');
      self.busy(true);
      self.$cropImage.attr('src', apos.attachments.url(self.attachment, {size: 'original'} ));
      self.viewWidth = self.scaleDown(self.attachment.width);
      self.viewHeight = self.scaleDown(self.attachment.height);
      self.$cropImage.css('width', self.viewWidth + 'px');
      self.$cropImage.css('height', self.viewHeight + 'px');
      self.initCropper();
      self.busy(false);
    };

    self.initCropper = function() {
      var cropperOpts = { viewMode: 1, autoCropArea: 1 };
      if (options.aspectRatio) {
        cropperOpts.aspectRatio = options.aspectRatio[0] / options.aspectRatio[1];
      }
      if (options.minSize) {
        cropperOpts.minCropBoxWidth = self.scaleDown(options.minSize[0]);
        cropperOpts.minCropBoxHeight = self.scaleDown(options.minSize[1]);
      }
      if (options.crop) {
        cropperOpts.data = self.deserializeCrop(options.crop);
      }
      self.$cropImage.cropper(cropperOpts);
    };

    self.getCropperData = function() {
      if (!self.$cropImage) {
        return null;
      }
      return self.$cropImage.cropper("getData", true);
    };

    self.saveContent = function(callback) {
      // Ask the server to render this crop
      self.busy(true);
      self.attachment.crop = self.serializeCrop(self.getCropperData());
      self.api('crop', { _id: self.attachment._id, crop: self.attachment.crop }, function(data) {
        if (data.status !== 'ok') {
          alert('An error occurred.');
          return callback('fail');
        }
        self.busy(false);
        self.options.cropped(self.attachment.crop);
        return callback(null);
      }, function() {
        self.busy(false);
        alert('Server error, please retry');
        return callback('fail');
      });
    };

    self.scaleDown = function(coord) {
      return Math.round(coord * self.cropWidth / self.attachment.width);
    };

    self.scaleUp = function(coord) {
      return Math.round(coord * self.attachment.width / self.cropWidth);
    };

    self.deserializeCrop = function(data) {
      return {
        y: self.scaleDown(data.top),
        x: self.scaleDown(data.left),
        width: self.scaleDown(data.width),
        height: self.scaleDown(data.height)
      };
    };

    self.serializeCrop = function(data) {
      return {
        top: self.scaleUp(data.y),
        left: self.scaleUp(data.x),
        width: self.scaleUp(data.width),
        height: self.scaleUp(data.height)
      };
    };

    self.busy = function(state) {
      self.$saveButton.attr('data-busy', state ? '1' : '0');
    };
  }
});
