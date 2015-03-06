var lodash = require('lodash');

module.exports = function(self, options) {
  self.pushAsset('script', 'always', { when: 'always' });
  self.pushAsset('script', 'mediaLibrary', { when: 'user' });
  self.apos.push.browserCall('apos.files = moog.create("apostrophe-files", ?)', options.browser);
  _.defaults(options, { browser: {} });
  _.extend(options.browser, {
    action: self.action,
    fileGroups: self.fileGroups
  });
};


