// Interface between the image chooser and the attachment focal point editor.

apos.define('apostrophe-images-focal-point-editor', {

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
    // The complete field definition for the join.
    self.field = self.options.field;
    // Not always present; extra fields describing relationship between the two objects
    self.relationship = self.options.field.relationship;
    self.chooser = self.options.chooser;

    self.retrieve = function(callback) {
      return self.api('retrieve', { _id: self.choice.value }, function(result) {
        if (result.status !== 'ok') {
          alert('An error occurred while retrieving the image to edit its focal point. Perhaps it has been removed.');
          return;
        }
        self.image = result.data;
        return callback(null);
      });
    };

    self.edit = function() {
      var options = {};
      if (_.isNumber(self.choice.x) && _.isNumber(self.choice.y)) {
        options.focalPoint = {
          x: self.choice.x,
          y: self.choice.y
        };
      }
      // Needed so we can pick a focal point within the crop
      if (_.isNumber(self.choice.top) && _.isNumber(self.choice.left) && _.isNumber(self.choice.width) && _.isNumber(self.choice.height)) {
        options.crop = {
          top: self.choice.top,
          left: self.choice.left,
          width: self.choice.width,
          height: self.choice.height
        };
      }
      return apos.attachments.focalPoint(self.image.attachment, options, function(err, focalPoint) {
        if (err) {
          alert('An error occurred during focal point editing.');
          return;
        }
        _.assign(self.choice, focalPoint);
        if (self.chooser) {
          self.chooser.refresh();
        }
        // And that's it. We're not a modal ourselves, so there's nothing to dismiss.
      });
    };
  }
});
