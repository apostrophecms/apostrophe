var _ = require('lodash');

module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'user', { when: 'user' });
  };

  self.pushCreateSingleton = function() {
    _.defaults(options, { browser: {} });
    _.extend(options.browser, {
      action: self.action
    });
    self.apos.push.browserCall('user', 'apos.docs = apos.create("apostrophe-docs", ?)', options.browser);
  };

};
