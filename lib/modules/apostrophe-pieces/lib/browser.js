var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  var superPushAssets = self.pushAssets;
  self.pushAssets = function() {
    superPushAssets();
    self.pushAsset('script', 'manager-modal', { when: 'user' });
    self.pushAsset('script', 'editor-modal', { when: 'user' });
    self.pushAsset('script', 'batch-permissions-modal', { when: 'user' });
    self.pushAsset('stylesheet', 'manager', { when: 'user' });
  };

  var superPushDefineSingleton = self.pushDefineSingleton;
  self.pushDefineSingleton = function() {
    superPushDefineSingleton();
    // Additional tools
    var tools = [ 'editor-modal', 'manager-modal' ];
    _.each(tools, function(tool) {
      self.apos.push.browserMirrorCall('user', self, { 'tool': tool, stop: 'apostrophe-pieces' });
    });
  };

  var superGetCreateSingletonOptions = self.getCreateSingletonOptions;
  self.getCreateSingletonOptions = function(req) {
    var browserOptions = superGetCreateSingletonOptions(req);
    // Options specific to pieces and their manage modal
    browserOptions.filters = self.filters;
    browserOptions.columns = self.columns;
    browserOptions.contextual = self.contextual;
    browserOptions.batchOperations = self.options.batchOperations;
    browserOptions.insertViaUpload = self.options.insertViaUpload;
    browserOptions.canEditTrash = self.options.canEditTrash;
    browserOptions.batchPermissionsSchema = self.getBatchPermissionsSchema(req);
    return browserOptions;
  };
};
