// A modal that displays a list of past versions and allows the user
// to explore changes and commit to rolling back to a particular previous
// version of a doc.

apos.define('apostrophe-versions-editor', {
  extend: 'apostrophe-modal',
  source: 'versions-editor',
  // Requires document id as the _id option
  construct: function(self, options) {
    self._id = options._id;

    self.body = {
      _id: self._id
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
      self.$el.on('click', '[data-apos-revert]', function() {
        self.api('revert', {
            _id: $(this).closest('[data-version]').attr('data-version')
          },
          function(result) {
            if (result.status !== 'ok') {
              alert('An error occurred.');
              return;
            }
            self.hide();
            return self.options.afterRevert();
          }
        );
        return false;
      });
      return callback(null);
    };
  }
});
