var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  // Push assets to the browser. Called by `afterConstruct`.

  self.pushAssets = function() {
    self.pushAsset('script', 'always', { when: 'always' });
    self.pushAsset('stylesheet', 'always', { when: 'always' });
  };

  // Create the browser-side `apos.oembed` singleton, enabling
  // calls to `apos.oembed.query` and `apos.oembed.queryAndPlay`.
  // Called by `afterConstruct`.

  self.pushCreateSingleton = function() {
    _.defaults(options, { browser: {} });
    _.extend(options.browser, {
      action: self.action
    });
    self.apos.push.browserCall('always', 'apos.create(?, ?)', self.__meta.name, options.browser);
  };

};
