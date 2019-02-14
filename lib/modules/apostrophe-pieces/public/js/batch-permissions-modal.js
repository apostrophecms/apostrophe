// A modal for selecting permissions to be applied to a batch of pieces

apos.define('apostrophe-pieces-batch-permissions-modal', {

  extend: 'apostrophe-pieces-batch-permissions-modal',

  source: 'batch-permissions-modal',

  verb: 'permissions',

  construct: function(self, options) {

    self.beforeInit = function(callback) {
      self.permissions = apos.schemas.newInstance(options.schema);
      return apos.schemas.populate(self.$el, options.schema, self.permissions, callback);
    };

    self.saveContent = function(callback) {
      return apos.schemas.convert(self.$el, options.schema, self.permissions, {}, callback);
    };

  }
});
