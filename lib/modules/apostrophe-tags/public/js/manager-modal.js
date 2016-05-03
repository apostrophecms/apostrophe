apos.define('apostrophe-tags-manager-modal', {
  extend: 'apostrophe-modal',
  source: 'manager',
  construct: function(self, options) {
    self.beforeShow = function(callback) {
      self.$results = self.$el.find('[data-apos-tags-view]');
      return self.refresh(callback);
    };

    self.refresh = function(callback) {
      // TODO implement options
      var listOptions = {};
      self.beforeRefresh(listOptions);
      return self.api('list', listOptions, function(response) {
        if (response.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return;
        }
        self.$results.html(response.data.results);
        apos.emit('enhance', self.$results);
        self.resizeContentHeight();
        self.afterRefresh();

        if (callback) {
          return callback();
        }
      });
    };

    self.add = function() {

    };

    self.edit = function() {

    };

    self.trash = function() {

    };

    self.beforeRefresh = function(options) {
      // Overridable hook
    };

    self.afterRefresh = function() {
      // Overridable hook
    };
  }
})
