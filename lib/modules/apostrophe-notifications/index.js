// This module provides a framework for triggering notifications within the Apostrophe admin UI.

module.exports = {
  extend: 'apostrophe-module',

  construct: function(self, options) {
    self.pushAssets = function() {
      self.pushAsset('script', 'user', { when: 'user' });
      // self.pushAsset('stylesheet', 'user', { when: 'user' });
    };

    /**
     * Render a notification partial with the passed message.
     */
    self.route('post', 'notification', function (req, res) {
      res.send(self.render(req, 'notification', { message: req.body.message }));
    });
  },

  afterConstruct: function(self) {
    self.pushAssets();
    self.pushCreateSingleton();
  }
};
