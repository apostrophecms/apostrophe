var _ = require('lodash');

module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'manager-modal', { when: 'user' });
    self.pushAsset('script', 'editor-modal', { when: 'user' });
    self.pushAsset('stylesheet', 'manager', { when: 'user' });
    self.pushAsset('stylesheet', 'chooser', { when: 'user' });

  };

  self.pushDefineSingleton = function() {
    // Define the browser-side singleton with the
    // same inheritance tree as our own
    self.apos.push.browserMirrorCall('user', self);
    // Do that for the various tools, too. The base classes for these live in
    // apostrophe-docs because it's legitimate to use some of them with doc types
    // that don't have a corresponding module, so we make a substitution in the
    // inheritance tree
    var tools = [ 'manager', 'editor-modal', 'create-modal', 'manager-modal', 'chooser', 'chooser-modal', 'relationship-editor' ];
    _.each(tools, function(tool) {
      self.apos.push.browserMirrorCall('user', self, { 'tool': tool, 'substitute': { 'apostrophe-module': 'apostrophe-docs' } });
    });
  };

  // Before sending any page, create the singleton for working with this type of piece, but only
  // if there is an active user

  self.pageBeforeSend = function(req) {
    self.pushCreateSingleton(req, 'user');
  };

  self.getCreateSingletonOptions = function(req) {
    var browserOptions = {};
    _.defaults(browserOptions, options.browser || []);
    _.defaults(browserOptions, _.pick(options, 'name', 'label', 'pluralLabel'));
    browserOptions.action = browserOptions.action || self.action;
    browserOptions.schema = self.allowedSchema(req);
    browserOptions.filters = self.filters;
    browserOptions.columns = self.columns;
    browserOptions.contextual = self.contextual;
    return browserOptions;
  }
};
