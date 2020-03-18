module.exports = function(self, options) {

  self.pushAsset('script', 'user', { when: 'user' });
  self.pushAsset('script', 'editor', { when: 'user' });

  self.pushAsset('stylesheet', 'user', { when: 'user' });

  var browserOptions = {
    action: self.action,
    messages: {
      // This always yields the default translation, it should be fixed but
      // this code does not run on a per-request basis (old bug)
      tryAgain: self.apos.i18n.__('apostrophe', 'Server error, please try again.')
    }
  };

  self.apos.push.browserCall('user', 'apos.create("apostrophe-versions", ?)', browserOptions);

};
