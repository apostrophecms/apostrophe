var _ = require('lodash');
var async = require('async');

module.exports = {

  construct: function(self, options) {
    require('./lib/api.js')(self, options);
    require('./lib/protectedApi.js')(self, options);
    require('./lib/helpers.js')(self, options);
    require('./lib/routes.js')(self, options);

    self.pushAsset('script', 'editor', { when: 'user' });
    console.log(self.action);
    var browserOptions = {
      action: self.action,
      messages: {
        tryAgain: self.apos.i18n.__('Server error, please try again.')
      }
    };
    self.apos.push.browserCall('user', 'apos.create("apostrophe-areas", ?)', browserOptions);
    self.apos.areas = self;
  }
};
