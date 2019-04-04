var _ = require('@sailshq/lodash');

module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('stylesheet', 'user', { when: 'user' });
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'manager-modal', { when: 'user' });
  };

  self.pushDefinitions = function() {
    var tools = [ 'manager-modal' ];
    _.each(tools, function(tool) {
      self.apos.push.browserMirrorCall('user', self, { 'tool': tool, 'stop': 'apostrophe-tags-manager-modal' });
    });
  };
};
