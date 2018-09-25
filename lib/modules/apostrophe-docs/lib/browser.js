var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.getBrowserData = function(req) {
    if (req.user) {
      return {
        action: self.action,
        trashInSchema: self.options.trashInSchema
      };
    }
  };

};
