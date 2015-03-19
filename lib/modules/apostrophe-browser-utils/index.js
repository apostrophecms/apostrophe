module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'always');
    self.apos.push.browserCall('always', 'apos.create("apostrophe-browser-utils")');
  }
};
