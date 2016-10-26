apos.define('apostrophe-doc-type-manager-relationship-editor', {
  extend: 'apostrophe-modal',
  source: 'relationship-editor',
  construct: function(self, options) {
    self.manager = options.manager;
    // The relationship we are editing. Note that self.choice.value is the _id of
    // the thing we're related to
    self.choice = self.options.choice;
    // The complete field definition for the join
    self.field = self.options.field;
    // The only part we care about, by default, but subclasses might have other interests
    self.relationship = self.options.field.relationship;
    self.chooser = self.options.chooser;
    // Pass the field definition back to the server
    self.body = self.body || {};
    self.body.field = self.field;
    self.nonInlineSchema = _.filter(self.relationship, function(field) {
      return !field.inline;
    });
    self.beforeShow = function(callback) {
      self.$form = self.$el.find('[data-apos-form]');
      return apos.schemas.populate(self.$form, self.nonInlineSchema, self.choice, callback);
    };
    self.saveContent = function(callback) {
      return apos.schemas.convert(self.$form, self.nonInlineSchema, self.choice, {}, function(err) {
        if (err) {
          return callback(err);
        }
        // refresh the chooser, in case chooserChoice.html features the relationship fields
        // we just edited. However don't bomb if we're not in a chooser
        if (self.chooser) {
          self.chooser.refresh();
        }
        return callback(null);
      });
    };
  }
});
