var _ = require('lodash');

module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'always', { when: 'always' });
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'cropEditor', { when: 'user' });
    self.pushAsset('stylesheet', 'user', { when: 'user' });
  };

  self.pushCreateSingleton = function() {
    _.defaults(options, { browser: {} });
    _.extend(options.browser, {
      action: self.action,
      fileGroups: self.fileGroups,
      name: self.name,
      uploadsUrl: self.uploadfs.getUrl()
    });
    self.apos.push.browserCall('user', 'apos.create("apostrophe-attachments", ?)', options.browser);
  };

};
