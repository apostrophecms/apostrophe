apos.define('apostrophe-attachments-crop-editor', {
  extend: 'apostrophe-modal',
  source: 'crop-editor',
  construct: function(self, options) {
    self.attachment = options.attachment;

    // Use afterShow so that .width() works
    self.afterShow = function() {

      self.$cropImage = self.$el.find('[data-crop-image]');
      self.cropWidth = self.$cropImage.width();
      self.busy(true);
      self.$cropImage.attr('src', apos.attachments.url(self.attachment));
      self.viewWidth = self.scaleDown(self.attachment.width);
      self.viewHeight = self.scaleDown(self.attachment.height);
      self.$cropImage.css('width', self.viewWidth + 'px');
      self.$cropImage.css('height', self.viewHeight + 'px');
      var jcropArgs = {};
      if (self.attachment.crop) {
        jcropArgs.setSelect = self.cropToJcrop(self.attachment.crop);
      }
      if (options.minSize) {
        jcropArgs.minSize = [ self.scaleDown(minSize[0]), self.scaleDown(minSize[1]) ];
      }
      if (options.aspectRatio) {
        jcropArgs.aspectRatio = options.aspectRatio[0] / options.aspectRatio[1];
      }
      // Pass jcrop arguments and capture the jcrop API object so we can call
      // tellSelect at a convenient time
      self.$cropImage.Jcrop(jcropArgs, function() {
        self.jcrop = this;
      });
      self.busy(false);
    };

    self.saveContent = function(callback) {
      var c = self.jcrop.tellSelect();
      // If no crop is possible there may
      // be NaN present. Just cancel with no crop performed
      if ((c.w === undefined) || isNaN(c.w) || isNaN(c.h)) {
        return callback(null);
      }
      // Ask the server to render this crop
      self.busy(true);
      self.attachment.crop = self.jcropToCrop(c);
      apos.log(self.attachment.crop);
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

    self.cropToJcrop = function(crop) {
      return [ self.scaleDown(crop.left), self.scaleDown(crop.top), self.scaleDown(crop.left + crop.width), self.scaleDown(crop.top + crop.height) ];
    };

    self.jcropToCrop = function(jcrop) {
      return {
        top: self.scaleUp(jcrop.y),
        left: self.scaleUp(jcrop.x),
        width: self.scaleUp(jcrop.w),
        height: self.scaleUp(jcrop.h)
      };
    };

    self.busy = function(state) {
      if (state) {
        self.$el.find('[data-progress]').show();
        self.$el.find('[data-finished]').hide();
      } else {
        self.$el.find('[data-progress]').hide();
        self.$el.find('[data-finished]').show();
      }
    };
  }
});
