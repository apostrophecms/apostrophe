apos.define('apostrophe-tags-manager-modal', {
  extend: 'apostrophe-modal',
  source: 'manager',
  construct: function(self, options) {
    self.beforeShow = function(callback) {
      self.$results = self.$el.find('[data-apos-tags-view]');
      self.$pager = self.$el.find('[data-apos-pager]');
      return self.refresh(callback);
    };

    self.refresh = function(callback) {
      return callback();
    };
  }
})
