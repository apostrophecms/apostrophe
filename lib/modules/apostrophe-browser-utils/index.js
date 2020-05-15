// Pushes utility methods to the browser as the `apos.utils` singleton. This module
// is separate from [apostrophe-utils](/reference/modules/apostrophe-utils) because that
// module is initialized very early, before it is possible to push assets to the browser.

module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'lean', { when: 'lean' });
    self.pushAsset('script', 'always');
    // Extend the lean apos.utils object with the properties of the
    // legacy moog one, so that everybody sees what they expect to see
    self.apos.push.browserCall('always', 'apos.utils.assign(apos.utils, apos.create("apostrophe-browser-utils"))');
  }
};
