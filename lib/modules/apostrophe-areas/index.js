var _ = require('lodash');
var async = require('async');

module.exports = {

  construct: function(self, options) {
    require('./lib/api.js')(self, options);
    require('./lib/protectedApi.js')(self, options);
    require('./lib/helpers.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/browser.js')(self, options);

    self.pushAsset('script', 'always', { when: 'always' });

    // Add editing-related methods to browser-side manager
    // when appropriate
    self.pushAsset('script', 'user', { when: 'user' });

    self.apos.areas = self;
  }
};
