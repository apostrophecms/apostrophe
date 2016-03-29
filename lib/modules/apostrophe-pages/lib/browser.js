module.exports = function(self, options) {
  self.pushAsset('script', 'user', { when: 'user' });
  self.pushAsset('script', 'chooser', { when: 'user' });
  self.pushAsset('script', 'editor', { when: 'user' });
  self.pushAsset('script', 'reorganize', { when: 'user' });
  self.pushAsset('script', 'vendor/tree.jquery', { when: 'user' });
  self.pushAsset('script', 'always', { when: 'always' });
  self.pushAsset('stylesheet', 'jqtree', { when: 'user' });

  var browserOptions = {
    action: self.action,
    schema: self.schema,
    types: self.types
  };

  self.apos.push.browserCall('user', 'apos.create("apostrophe-pages", ?)', browserOptions);

};
