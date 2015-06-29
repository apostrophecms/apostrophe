var _ = require('lodash');

module.exports = function(self, options) {

  self.pushAssets = function() {
    self.pushAsset('script', 'files', { when: 'always' });
    self.pushAsset('script', 'mediaLibrary', { when: 'always' });
  };

  self.pushCreateSingleton = function() {
    _.defaults(options, { browser: {} });
    _.extend(options.browser, {
      action: self.action,
      fileGroups: self.fileGroups,
      schema: self.schema
    });
    self.apos.push.browserCall('always', 'apos.files = apos.create("apostrophe-files", ?)', options.browser);
  };
};


