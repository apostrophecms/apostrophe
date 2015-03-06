// A lot more needs to be migrated here, found this in assets.js

module.exports = {
  construct: function(self, options) {
    if (options.browseByType) {
      options.browseByType = _.filter(mediaOptions.browseByType, function(byType) {
        return byType.value = byType.extensions.join(',');
      });
    }
    _.defaults(options, { browser: {} });
    _.extend(options.browser, {
      action: self.action
    });
    self.pushAsset('script', 'always', { when: 'always' });
    self.pushAsset('script', 'mediaLibrary', { when: 'user' });
    self.apos.push.browserCall('apos.files = moog.create("apostrophe-files", ?)', options.browser);
  }
}
