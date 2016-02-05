var _ = require('lodash');

module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'manager-modal', { when: 'user' });
    self.pushAsset('script', 'chooser-modal', { when: 'user' });
    self.pushAsset('script', 'editor-modal', { when: 'user' });
    self.pushAsset('script', 'create-modal', { when: 'user' });
    self.pushAsset('stylesheet', 'manager', { when: 'user' });
    self.pushAsset('stylesheet', 'chooser', { when: 'user' });

  };
  self.pushCreateSingleton = function() {
    // Define the browser-side singleton with the
    // same inheritance tree as our own
    self.apos.push.browserMirrorCall('user', self);
    // Do that for the various tools, too. The base classes for these live in
    // apostrophe-docs because it's legitimate to use some of them with doc types
    // that don't have a corresponding module, so we make a substitution in the
    // inheritance tree
    var tools =[ 'manager', 'editor-modal', 'create-modal', 'manager-modal', 'chooser', 'chooser-modal', 'relationship-editor' ];
    _.each(tools, function(tool) {
      self.apos.push.browserMirrorCall('user', self, { 'tool': tool, 'substitute': { 'apostrophe-module': 'apostrophe-docs' } });
    });

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
