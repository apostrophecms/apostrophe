apos.define('apostrophe-pieces-create-modal', {
  extend: 'apostrophe-pieces-editor-modal',
  source: 'create',

  construct: function(self, options) {
    self.displayResponse = function(result, callback) {
      window.location.href = result.data._url;
    };
  }
});
