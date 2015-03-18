module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'ui', { when: 'always' });
    self.apos.push.browserCall('always', 'apos.create("apostrophe-ui")');
  }
};
