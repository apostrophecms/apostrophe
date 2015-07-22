module.exports = function(self, options) {
  self.pushAsset('script', 'user', { when: 'user' });
  self.pushAsset('script', 'editor', { when: 'user' });
  self.pushAsset('script', 'reorganize', { when: 'user' });
  self.pushAsset('script', 'vendor/tree.jquery', { when: 'user' });
  self.pushAsset('script', 'always', { when: 'always' });
  self.pushAsset('stylesheet', 'jqtree', { when: 'user' });

  // singleton is instantiated via req.browserCall so we can
  // pass information about the current page
};
