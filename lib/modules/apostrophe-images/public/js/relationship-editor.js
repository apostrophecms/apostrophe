apos.define('apostrophe-images-relationship-editor', {

  extend: 'apostrophe-context',

  afterConstruct: function(self) {
    return async.series([ self.retrieve ], self.edit);
  },

  construct: function(self, options) {

    // The API URL for the images module
    self.action = apos.docs.getManager(options.field.withType).options.action;
    // The relationship we are editing. Note that self.choice.value is the _id of
    // the thing we're related to
    self.choice = self.options.choice;
    // The complete field definition for the join. Subclasses might use this to
    // present a form for non-cropping-related fields
    self.field = self.options.field;
    // Not always present; extra fields describing relationship between the two objects
    self.relationship = self.options.field.relationship;
    self.chooser = self.options.chooser;

    self.retrieve = function(callback) {
      return self.api('retrieve', { _id: self.choice.value }, function(result) {
        if (result.status !== 'ok') {
          apos.notify('An error occurred while retrieving the image to be cropped. Perhaps it has been removed.', { type: 'error' });
          return;
        }
        self.image = result.data;
        return callback(null);
      });
    };

    self.edit = function() {
      self.crop();
    };

    self.crop = function() {
      var options = self.field.hints || {};
      if (_.isNumber(self.choice.top) && _.isNumber(self.choice.left) && _.isNumber(self.choice.width) && _.isNumber(self.choice.height)) {
        options.crop = {
          top: self.choice.top,
          left: self.choice.left,
          width: self.choice.width,
          height: self.choice.height
        };
      }
      return apos.attachments.crop(self.image.attachment, options, function(err, crop) {
        if (err) {
          apos.notify('An error occurred while cropping.', { type: 'error', dismiss: true });
          return;
        }
        _.assign(self.choice, crop);
        if (self.chooser) {
          self.chooser.refresh();
        }
        // And that's it. We're not a modal ourselves, so there's nothing to dismiss.
      });
    };
  }
});
