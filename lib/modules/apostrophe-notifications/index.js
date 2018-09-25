// This module provides a framework for triggering notifications within the Apostrophe admin UI.

module.exports = {
  extend: 'apostrophe-module',

  construct: function(self, options) {
    /**
     * Render a notification partial with the passed message.
     */
    self.route('post', 'notification', function (req, res) {
      var message = self.apos.launder.string(req.body.message);
      var strings = self.apos.launder.strings(req.body.strings);
      var args = [ message ].concat(strings);
      message = self.apos.i18n.__.apply(self.apos.i18n, args);
      res.send(self.render(req, 'notification', { message: message }));
    });
  },

  afterConstruct: function(self) {
  }
};
