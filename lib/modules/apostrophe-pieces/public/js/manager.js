apos.define('apostrophe-pieces-manager', {
  extend: 'apostrophe-modal',
  source: 'manager',
  construct: function(self, options) {
    self.page = 1;
    options.source = 'manage';
    self.beforeShow = function(callback) {
      self.$list = self.$el.find('[data-list]');
      self.$pager = self.$el.find('[data-pager]');
      // self.clickHandlers();
      self.refresh();
      return callback(null);
    };
    self.refresh = function() {
      $.jsonCall(self.options.action + '/list', {
        format: 'managePage',
        page: self.page
      }, function(response) {
        if (!response.status === 'ok') {
          alert('An error occurred. Please try again.');
          return;
        }
        self.$list.html(response.data.list);
        self.$pager.html(response.data.pager);
      });
    };
  }
});
