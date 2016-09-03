// Pushes utility methods to the browser as the `apos.utils` singleton. This module
// is separate from [apostrophe-utils](../apostrophe-utils/index.html) because that
// module is initialized very early, before it is possible to push assets to the browser.

module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'always');
    self.apos.push.browserCall('always', 'apos.create("apostrophe-browser-utils")');
  }
};
