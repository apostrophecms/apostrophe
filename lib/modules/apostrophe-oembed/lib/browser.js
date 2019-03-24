let _ = require('lodash');

module.exports = function(self, options) {

  self.getBrowserData = function(req) {
    // api is public
    return {
      action: self.action
    };
  };

};
