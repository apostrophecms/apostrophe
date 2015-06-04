module.exports = function(self, options) {
  self.pushAssets = function() {
    self.pushAsset('script', 'user', { when: 'user' });
  };
  self.pushCreateSingleton = function() {
    // Define the browser-side singleton with the
    // same inheritance tree as our own
    self.apos.push.browserMirrorCall('user', self);
    self.apos.push.browserCall('user', 'apos.create(?, ?)', self.__meta.name, self.options.browser);
  };
};
