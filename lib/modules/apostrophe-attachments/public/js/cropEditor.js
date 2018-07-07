apos.define('apostrophe-attachments-crop-editor', {
  extend: 'apostrophe-modal',
  source: 'crop-editor',
  construct: function(self, options) {
    self.attachment = options.attachment;

    // Use afterShow so that .width() works
    self.afterShow = function() {

      self.$cropImage = self.$el.find('[data-crop-image]');
      self.cropWidth = self.attachment.width;
      self.$saveButton = self.$el.find('[data-apos-save]');
      self.busy(true);
      self.$cropImage.attr('src', apos.attachments.url(self.attachment, {size: 'original'}));
      self.viewWidth = self.scaleDown(self.attachment.width);
      self.viewHeight = self.scaleDown(self.attachment.height);
      self.$cropImage.css('width', self.viewWidth + 'px');
      self.$cropImage.css('height', self.viewHeight + 'px');
      self.initCropper();
      self.busy(false);
    };

    self.initCropper = function() {
      var cropperOpts = { viewMode: 1, autoCropArea: 1, checkCrossOrigin: false };
      if (options.aspectRatio) {
        cropperOpts.aspectRatio = options.aspectRatio[0] / options.aspectRatio[1];
      }
      if (options.minSize) {
        _.assign(cropperOpts, {
          // minCropBoxWidth: self.scaleDown(options.minSize[0]),
          // minCropBoxHeight: self.scaleDown(options.minSize[1]),
          viewMode: 1,
          // This is a bad idea, it prevents starting a new crop
          dragMode: 'crop',
          autoCrop: true,
          cropmove: function(e) {
            self.testMinimumSize(e);
          },
          cropstart: function(e) {
            self.testMinimumSize(e);
          },
          cropend: function(e) {
            self.testMinimumSize(e);
          },
          zoom: function(e) {
            self.zoom(e);
          }
        });
      }
      if (options.crop) {
        // TODO: this doesn't work so far, but recropping isn't that hard,
        // and you can always cancel
        cropperOpts.data = self.deserializeCrop(options.crop);
      }
      self.$cropImage.cropper(cropperOpts);
    };

    self.testMinimumSize = function(e) {
      var minWidth = self.options.minSize[0];
      var minHeight = self.options.minSize[1];
      var data = $(e.target).cropper('getData');
      var realHeight = data.height;
      var realWidth = data.width;
      if (realHeight < minHeight) {
        data.height = minHeight + 1; // +1 for rounding margin of error
      }

      if (realWidth < minWidth) {
        data.width = minWidth + 1; // +1 for rounding margin of error
      }

      if (realWidth < minWidth || realHeight < minHeight) {
        $(e.target).cropper('setData', data); // revert back to minimums since cropper can over-crop
        return false; // fails test
      }

      return true; // passes test
    };

    self.zoom = function(e) {
      var minWidth = self.options.minSize[0];
      var minHeight = self.options.minSize[1];
      if (e.ratio > 1) { // prevent zooming in past natural resolution
        e.preventDefault();
        return;
      }

      if (e.ratio > e.oldRatio) { // Zooming In
        var displayedWidth = $(e.target).cropper('getImageData').width;
        var displayedHeight = $(e.target).cropper('getImageData').height;
        var newNaturalWidth = displayedWidth / e.ratio;
        var newNaturalHeight = displayedHeight / e.ratio;
        if (newNaturalWidth < minWidth || newNaturalHeight < minHeight) {
          // Prevent zooming in to a point where you
          // can't possibly crop enough
          e.preventDefault();
        }
      }

      // Clear the crop box on a successful zoom, keeping it the same
      // display size is just weird and unhelpful. Make clear they need to
      // crop differently at the new zoom
      $(e.target).cropper('clear');
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
          apos.notify('An error occurred.', { type: 'error' });
          return callback('fail');
        }
        self.busy(false);
        self.options.cropped(self.attachment.crop);
        return callback(null);
      }, function() {
        self.busy(false);
        apos.notify('Server error, please retry', { type: 'error' });
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
