module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'ui', { when: 'always' });
    self.pushAsset('script', 'context', { when: 'always' });
    self.pushAsset('stylesheet', 'always', { when: 'always' });
    // TODO figure out issue with scene, when: 'user' doesn't work
    self.pushAsset('stylesheet', 'user', { when: 'always' });
    self.apos.push.browserCall('always', 'apos.create("apostrophe-ui")');
  }
};
