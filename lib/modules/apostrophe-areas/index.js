var _ = require('lodash');
var async = require('async');

module.exports = {

  construct: function(self, options) {
    require('./lib/api.js')(self, options);
    require('./lib/protectedApi.js')(self, options);
    require('./lib/helpers.js')(self, options);
    require('./lib/routes.js')(self, options);

    self.pushAsset('script', 'always', { when: 'always' });

    // Add editing-related methods to browser-side manager
    // when appropriate
    self.pushAsset('script', 'user', { when: 'user' });

    console.error('TODO: we are internationalizing global error messages the wrong way in the areas module, need to take culture into account');
    var browserOptions = {
      action: self.action,
      messages: {
        tryAgain: self.apos.i18n.__('Server error, please try again.')
      }
    };
    self.apos.push.browserCall('always', 'apos.create("apostrophe-areas", ?)', browserOptions);
    self.apos.areas = self;
  }
};
