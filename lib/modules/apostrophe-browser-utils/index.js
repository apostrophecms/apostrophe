// Pushes utility methods to the browser as the `apos.utils` singleton. This module
// is separate from [apostrophe-utils](https://docs.apostrophecms.org/apostrophe/modules/apostrophe-utils) because that
// module is initialized very early, before it is possible to push assets to the browser.

module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'always');
    self.apos.push.browserCall('always', 'apos.create("apostrophe-browser-utils")');
  }
};
