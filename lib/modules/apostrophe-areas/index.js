var _ = require('lodash');
var async = require('async');

module.exports = {

  construct: function(self, options) {
    require('./lib/api.js')(self, options);
    require('./lib/protectedApi.js')(self, options);
    require('./lib/helpers.js')(self, options);
    require('./lib/routes.js')(self, options);

    self.pushAsset('script', 'editor', { when: 'user' });
    var browserOptions = {
      action: options.action,
      messages: {
        tryAgain: self.apos.i18n.__('Server error, please try again.')
      }
    };
    self.apos.push.browserCall('user', 'apos.create("apostrophe-areas", ?)', browserOptions);
    self.apos.areas = self;
  }
};
