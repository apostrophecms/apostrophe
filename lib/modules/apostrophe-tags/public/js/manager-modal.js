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
      // TODO implement options
      var listOptions = {};
      self.beforeRefresh(listOptions);
      return self.api('list', listOptions, function(response) {
        if (response.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return;
        }
        self.$results.html(response.data.results);
        self.$pager.html(response.data.pager);
        apos.emit('enhance', self.$results);
        apos.emit('enhance', self.$pager);
        self.resizeContentHeight();
        self.afterRefresh();

        if (callback) {
          return callback(response);
        }
      });
    };

    self.beforeRefresh = function(options) {
      // Overridable hook
    };

    self.afterRefresh = function() {
      // Overridable hook
    };
  }
})
