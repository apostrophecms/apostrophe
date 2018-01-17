module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'modal', { when: 'user' });
    self.pushAsset('stylesheet', 'user', { when: 'user' });
  };
};
