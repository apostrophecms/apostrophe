module.exports = function(self, options) {

  self.pushAssets = function() {
    self.pushAsset('stylesheet', 'user', { when: 'user' });
    self.pushAsset('script', 'user', { when: 'user' });
  };

};
