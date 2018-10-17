// This module provides a framework for triggering notifications within the Apostrophe admin UI.

module.exports = {
  extend: 'apostrophe-module',

  construct: function(self, options) {
    /**
     * Render a notification partial with the passed message.
     */
    self.route('post', 'notification', function (req, res) {
      const message = self.apos.launder.string(req.body.message);
      const strings = self.apos.launder.strings(req.body.strings);
      const args = [ message ].concat(strings);
      self.send(req, 'notification', { message: message });
    });
  },

  afterConstruct: function(self) {
  }
};
