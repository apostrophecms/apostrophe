console.log('defining focal point editor');

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
      self.croppedTop = options.crop ? options.crop.top : 0;
      self.croppedLeft = options.crop ? options.crop.left : 0;
      var boxWidth = self.$focalPointImageBox.width();
      var boxHeight = self.$focalPointImageBox.height();
      if (self.croppedWidth / self.croppedHeight >= boxWidth / boxHeight) {
        self.$focalPointImage.css('width', '100%');
      } else {
        self.$focalPointImage.css('height', '100%');
      }
      self.$focalPointImage.attr('src', apos.attachments.url(self.attachment, { size: 'original', crop: options.crop } ));
      self.$focalPointImage.imagesReady(function() {
        self.viewWidth = self.$focalPointImage.width();
        self.viewHeight = self.$focalPointImage.height();
        self.focalPoint = options.focalPoint || {
          x: self.croppedWidth / 2 + self.croppedLeft,
          y: self.croppedHeight / 2 + self.croppedTop
        };
        self.$focalPoint = self.$el.find('[data-focal-point]');
        self.$focalPointImage.on('click', function(event) {
          var offset = self.$focalPointImage.offset();
          self.focalPoint = {
            x: self.scaleUp(event.pageX - offset.left) + self.croppedLeft,
            y: self.scaleUp(event.pageY - offset.top) + self.croppedTop
          };
          self.render();
          return false;
        });
        self.render();
      });
    };

    self.saveContent = function(callback) {
      self.options.setFocalPoint(self.focalPoint);
      return callback(null);
    };
    
    self.render = function() {
      console.log(self.focalPoint.y, self.croppedTop);
      self.$focalPoint.css({
        top: self.scaleDown(self.focalPoint.y - self.croppedTop),
        left: self.scaleDown(self.focalPoint.x - self.croppedLeft)
      });
    };

    self.scaleDown = function(coord) {
      console.log(self.viewWidth, self.croppedWidth);
      return Math.round(coord * self.viewWidth / self.croppedWidth);
    };

    self.scaleUp = function(coord) {
      return Math.round(coord * self.croppedWidth / self.viewWidth);
    };

    self.busy = function(state) {
      self.$saveButton.attr('data-busy', state ? '1' : '0');
    };
  }
});
