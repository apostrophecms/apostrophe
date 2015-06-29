module.exports = function(self, options) {
  self.pushAsset('script', 'user', { when: 'user' });
  self.pushAsset('script', 'new', { when: 'user' });
  self.pushAsset('script', 'always', { when: 'always' });


  //We'll want to pass info about page types...
  var browserOptions = {
    action: self.action,
    schema: self.schema,
    typeChoices: self.typeChoices
  };

  self.apos.push.browserCall('always', 'apos.create("apostrophe-pages", ?)', browserOptions);

};
