module.exports = {
  construct: function(self, options) {
    if (self.apos.modules['apostrophe-i18n'].options.tooltips) {
      self.pushAsset('script', 'i18n-tooltips');
    }
  }
};
