var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  // We don't need a proper singleton, nor is it convenient because this module initializes
  // before the assets module, so just push a simple object to let the browser know
  // whether to implement extended permissions or not

  self.pushSingleton = function() {
    self.apos.push.browserCall('user', 'window.apos.modules["apostrophe-permissions"] = window.apos.permissions = ?', {
      options: _.pick(options, 'extended')
    });
  };

};
