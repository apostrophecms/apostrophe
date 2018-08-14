// When choosing images, autocomplete by title is not a sensible primary
// interface; let them go straight to the browse button and just use the
// chooser to edit existing selections

apos.define('apostrophe-images-chooser', {
  extend: 'apostrophe-pieces-chooser',
  autocomplete: false,
  construct: function(self, options) {
    self.finalize = function(callback) {
      // autocrop if needed
      var aspectRatio = self.field.hints && self.field.hints.aspectRatio;
      if (!aspectRatio) {
        return callback(null);
      }
      aspectRatio = aspectRatio[0] / aspectRatio[1];
      var manager = apos.docs.getManager(self.field.withType);
      return self.get(function(err, choices) {
        if (err) {
          return callback(err);
        }
        apos.ui.globalBusy(true);
        return async.eachSeries(choices, function(choice, callback) {
          var attachment;
          if (choice.width && (withinOnePercent(choice.width / choice.height, aspectRatio))) {
            return setImmediate(callback);
          }

          return async.series([ retrieve, crop ], callback);

          function retrieve(callback) {
            return manager.api('retrieve', { _id: choice.value }, function(result) {
              if (result.status !== 'ok') {
                apos.notify('An error occurred while retrieving the image to be cropped. Perhaps it has been removed.', { type: 'error' });
                return;
              }
              attachment = result && result.data && result.data.attachment;
              return callback(null);
            });
          }

          function crop(callback) {
            if (!apos.attachments.options.croppable[attachment.extension]) {
              return callback(null);
            }
            var width = attachment.width;
            var height = attachment.width / aspectRatio;
            var left = 0;
            var top = (attachment.height - height) / 2;
            if (height > attachment.height) {
              width = attachment.height * aspectRatio;
              height = attachment.height;
              left = (attachment.width - width) / 2;
              top = 0;
            }
            return apos.attachments.api(
              'crop',
              {
                _id: attachment._id,
                crop: { top: top, left: left, width: width, height: height }
              },
              function(data) {
                if (data.status !== 'ok') {
                  apos.notify('An error occurred while cropping.', { type: 'error', dismiss: true });
                  return callback('fail');
                }
                choice.top = top;
                choice.left = left;
                choice.width = width;
                choice.height = height;
                return callback(null);
              }
            );
          }

          function withinOnePercent(a, b) {
            return (Math.abs(a - b) < (Math.max(a, b) * 0.01));
          }

        }, function(err) {
          apos.ui.globalBusy(false);
          return callback(err);
        });
      });
    };

    self.link('apos-focal-point', 'item', function($button, _id) {
      var choice = _.find(self.choices, { value: _id });
      if (!choice) {
        return;
      }
      var editorType = self.field.focalPointEditor || self.manager.getToolType('focal-point-editor');
      apos.create(editorType, {
        choice: choice,
        field: self.field,
        action: self.action,
        chooser: self
      });
    });
  }
});
