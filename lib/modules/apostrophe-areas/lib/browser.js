module.exports = function(self, options) {

  self.pushAsset('script', 'always', { when: 'always' });

  // Add editing-related methods to browser-side manager
  // when appropriate
  self.pushAsset('script', 'user', { when: 'user' });

  // Tells ckeditor where to find the rest of itself despite minification
  self.pushAsset('script', 'beforeCkeditor', { when: 'user' });
  self.pushAsset('script', 'vendor/ckeditor/ckeditor', { when: 'user', preshrunk: true });
  self.pushAsset('script', 'editor', { when: 'user' });
  self.pushAsset('script', 'splitHtml', { when: 'user' });
  // self.pushAsset('stylesheet', '../js/vendor/ckeditor/skins/apostrophe/editor', { when: 'user' });
  self.pushAsset('stylesheet', 'user');

  console.error('TODO: we are internationalizing global error messages the wrong way in the areas module, need to take culture into account');
  var browserOptions = {
    action: self.action,
    messages: {
      tryAgain: self.apos.i18n.__('Server error, please try again.')
    }
  };
  self.apos.push.browserCall('always', 'apos.create("apostrophe-areas", ?)', browserOptions);

};
