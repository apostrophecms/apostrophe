module.exports = function(self, options) {
  self.pushAsset('script', 'user', { when: 'user' });
  self.pushAsset('script', 'editor', { when: 'user' });
  self.pushAsset('script', 'always', { when: 'always' });

  // singleton is instantiated via req.browserCall so we can
  // pass information about the current page
};
