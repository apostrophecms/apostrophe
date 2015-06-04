apos.define('apostrophe-pieces-editor', {
  extend: 'apostrophe-modal',
  source: 'editor',
  construct: function(self, options) {
    self.page = 1;
    options.source = options._id ? 'editor' : 'editor-create';
    self.beforeShow = function(callback) {
      self.$list = self.$el.find('[data-list]');
      self.$itemTemplate = self.$el.find('[data-list] [data-item]');
      self.$itemTemplate.remove();
      // self.clickHandlers();
      self.refresh();
      return callback(null);
    };
    self.refresh = function() {
      $.jsonCall(self.options.action + '/list', {
        format: 'manage',
        page: self.page
      }, function(html) {
        self.$list.html(html);
      }, 'html');
    };
  }

});
