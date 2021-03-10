module.exports = function(self, options) {

  self.pushAsset('script', 'user', { when: 'user' });
  self.pushAsset('script', 'editor', { when: 'user' });

  self.pushAsset('stylesheet', 'user', { when: 'user' });

  var browserOptions = {
    action: self.action,
    messages: {
      // TODO this can only result in the default locale and lacks namespacing,
      // fix it at some point, which will require making this module's initialization req-dependent
      tryAgain: self.apos.i18n.__('Server error, please try again.')
    }
  };

  self.apos.push.browserCall('user', 'apos.create("apostrophe-versions", ?)', browserOptions);

};
