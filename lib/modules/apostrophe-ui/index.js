module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'ui', { when: 'always' });
    self.pushAsset('script', 'context', { when: 'always' });
    self.apos.push.browserCall('always', 'apos.create("apostrophe-ui")');
  }
};
