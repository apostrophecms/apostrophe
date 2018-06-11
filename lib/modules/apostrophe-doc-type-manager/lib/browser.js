var _ = require('@sailshq/lodash');

module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'chooser', { when: 'user' });
    self.pushAsset('script', 'user', { when: 'user' });
    self.pushAsset('script', 'relationship-editor', { when: 'user' });
    self.pushAsset('stylesheet', 'chooser', { when: 'user' });
  };

  self.pushDefineSingleton = function() {
    // Define the browser-side manager singleton with the
    // same inheritance tree as our own
    self.apos.push.browserMirrorCall('user', self);
    // Do that for our various tools, too.
    var tools = [ 'chooser', 'relationship-editor' ];
    _.each(tools, function(tool) {
      self.apos.push.browserMirrorCall('user', self, { 'tool': tool, stop: 'apostrophe-doc-type-manager' });
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
    return browserOptions;
  };

};
