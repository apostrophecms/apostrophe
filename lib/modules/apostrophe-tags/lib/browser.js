var _ = require('lodash');

module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'manager-modal', { when: 'user' });
  };

  self.pushCreateSingleton = function() {
    var tools =[ 'manager-modal' ];
    _.each(tools, function(tool) {
      self.apos.push.browserMirrorCall('user', self, { 'tool': tool, 'substitute': { 'apostrophe-module': 'apostrophe-docs' } });
    });
    options.browser = options.browser || {};
    options.browser.action = options.browser.action || self.action;
    self.apos.push.browserCall('user', 'apos.create(?, ?)', self.__meta.name, options.browser);

  };
};
