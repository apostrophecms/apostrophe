apos.define('apostrophe-versions-editor', {
  extend: 'apostrophe-modal',
  source: 'versions-editor',
  construct: function(self, options) {
    self.page = options.page;

    self.body = {
      _id: self.page._id
    };

    self.beforeShow = function(callback) {
      self.$el.on('click', '[data-open-changes]', function() {
        var $toggle = $(this);
        var $version = $toggle.closest('[data-version]');
        var currentId = $version.attr('data-version');
        var oldId = $version.attr('data-previous');
        self.html('compare', { oldId: oldId, currentId: currentId }, function(html) {
          $version.find('[data-changes]').html(html);
        });
        return false;
      });
      return callback(null);
    };
  }
});

