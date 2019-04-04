apos.define('apostrophe-attachments-focal-point-editor', {
  extend: 'apostrophe-modal',
  source: 'focal-point-editor',
  construct: function(self, options) {
    self.attachment = options.attachment;

    // Use afterShow so that imagesReady and width() work
    self.afterShow = function() {
      self.$focalPointImage = self.$el.find('[data-focal-point-image]');
      self.$focalPointImageBox = self.$el.find('[data-focal-point-image-box]');
      self.$saveButton = self.$el.find('[data-apos-save]');
      self.croppedWidth = (options.crop && options.crop.width) || self.attachment.width;
      self.croppedHeight = (options.crop && options.crop.height) || self.attachment.height;
      var boxWidth = self.$focalPointImageBox.width();
      var boxHeight = self.$focalPointImageBox.height();
      if (self.croppedWidth / self.croppedHeight >= boxWidth / boxHeight) {
        self.$focalPointImage.css('width', '100%');
      } else {
        self.$focalPointImage.css('height', '100%');
      }
      self.$focalPointImage.attr('src', apos.attachments.url(self.attachment, { size: 'original', crop: options.crop }));
      self.$focalPointImage.imagesReady(function() {
        self.viewWidth = self.$focalPointImage.width();
        self.viewHeight = self.$focalPointImage.height();
        self.focalPoint = options.focalPoint || {
          x: 50.0,
          y: 50.0
        };
        self.$focalPoint = self.$el.find('[data-focal-point]');
        self.$focalPointImage.on('click', self.click);
        self.render();
      });
    };

    // jQuery event handler for clicks on the image,
    // which updates the focal point.

    self.click = function(event) {
      var offset = self.$focalPointImage.offset();
      self.focalPoint = {
        x: self.scaleToPercentageX(event.pageX - offset.left),
        y: self.scaleToPercentageY(event.pageY - offset.top)
      };
      self.render();
      return false;
    };

    self.saveContent = function(callback) {
      self.options.setFocalPoint(self.focalPoint);
      return callback(null);
    };

    self.render = function() {
      self.$focalPoint.css({
        top: self.scaleToAbsoluteY(self.focalPoint.y),
        left: self.scaleToAbsoluteX(self.focalPoint.x)
      });
    };

    self.scaleToAbsoluteX = function(percentage) {
      return Math.round(percentage * self.viewWidth / 100);
    };

    self.scaleToAbsoluteY = function(percentage) {
      return Math.round(percentage * self.viewHeight / 100);
    };

    self.scaleToPercentageX = function(absolute) {
      return absolute * 100 / self.viewWidth;
    };

    self.scaleToPercentageY = function(absolute) {
      return absolute * 100 / self.viewHeight;
    };

    self.busy = function(state) {
      self.$saveButton.attr('data-busy', state ? '1' : '0');
    };
  }
});
