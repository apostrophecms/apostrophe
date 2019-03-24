// Provides the [apos.ui](browser-apostrophe-ui) singleton on the browser side, which
// implements various general purpose UI features for Apostrophe sites, and also
// the [apostrophe-context](browser-apostrophe-context) base class on the browser side,
// which is the base class of modals and of other types that benefit from being
// able to make API calls conveniently via `self.action` and link click handlers based on
// `self.$el`.

let _ = require('lodash');

module.exports = {
  userTimeFormat: 'h:mma',
  construct: function(self, options) {
  }
};
