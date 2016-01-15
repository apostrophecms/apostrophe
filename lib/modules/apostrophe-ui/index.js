module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'ui', { when: 'always' });
    self.pushAsset('script', 'context', { when: 'always' });
    self.pushAsset('stylesheet', 'always', { when: 'always' });
    self.pushAsset('stylesheet', 'vendor/font-awesome/font-awesome', { when: 'always' });
    // TODO figure out issue with scene, when: 'user' doesn't work
    self.pushAsset('stylesheet', 'user', { when: 'user' });
    self.apos.push.browserCall('always', 'apos.create("apostrophe-ui")');
  }
};
