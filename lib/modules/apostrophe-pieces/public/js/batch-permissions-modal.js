// A modal for selecting permissions to be applied to a batch of pieces

apos.define('apostrophe-pieces-batch-permissions-modal', {

  extend: 'apostrophe-modal',

  source: 'batch-permissions-modal',

  verb: 'permissions',

  construct: function(self, options) {
    self.beforeShow = function(callback) {
      _.assign(options.body, apos.schemas.newInstance(options.schema));
      return apos.schemas.populate(self.$el, options.schema, options.body, callback);
    };

    self.saveContent = function(callback) {
      return apos.schemas.convert(self.$el, options.schema, options.body, {}, function(err) {
        if (!err) {
          self.ok = true;
        }
        return callback(err);
      });
    };

    self.afterHide = function() {
      return options.after(self.ok ? null : 'Canceled');
    };
  }
});
