var _ = require('lodash');

module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'manager', { when: 'user' });
    self.pushAsset('script', 'editor', { when: 'user' });
    self.pushAsset('stylesheet', 'manager', { when: 'user' });
  };
  self.pushCreateSingleton = function() {
    // Define the browser-side singleton with the
    // same inheritance tree as our own
    self.apos.push.browserMirrorCall('user', self);
    options.browser = options.browser || {};
    _.defaults(options.browser, _.pick(options, 'name', 'label', 'pluralLabel'));
    options.browser.action = options.browser.action || self.action;
    options.browser.schema = self.schema;
    options.browser.filters = self.filters;
    options.browser.columns = self.columns;
    options.browser.sorts = self.sorts;
    self.apos.push.browserCall('user', 'apos.create(?, ?)', self.__meta.name, self.options.browser);
  };
};
