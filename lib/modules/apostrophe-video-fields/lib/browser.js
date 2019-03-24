let _ = require('lodash');

module.exports = function(self, options) {

  self.getBrowserData = function(req) {
    if (req.user) {
      return {
        name: self.name,
        action: self.action,
        oembedType: self.options.oembedType
      };
    }
  };

};
