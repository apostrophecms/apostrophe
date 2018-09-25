var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.getBrowserData = function(req) {
    // api is public
    return {
      action: self.action
    };
  };

};
