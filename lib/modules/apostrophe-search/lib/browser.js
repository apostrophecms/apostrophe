module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'always', { when: 'always' });
    self.apos.push.browserCall('always', 'apos.searchSuggestions = ?', self.options.suggestions);
  };
};
