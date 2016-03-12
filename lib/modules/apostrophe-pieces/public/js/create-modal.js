apos.define('apostrophe-pieces-create-modal', {
  extend: 'apostrophe-pieces-editor-modal',
  source: 'create',

  construct: function(self, options) {
    var superDisplayResponse = self.displayResponse;
    self.displayResponse = function(result, callback) {
      if (!result.data._url) {
        return superDisplayResponse(result, callback);
      }
      // If the response contains a _url populated, we should redirect to the
      // _url to edit the piece contextually.
      window.location.href = result.data._url;
    };
  }
});
