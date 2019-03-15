var _ = require('lodash');

module.exports = function(self, options) {

  self.getBrowserData = function(req) {
    if (req.user) {
      return {
        action: self.action,
        fileGroups: self.fileGroups,
        name: self.name,
        uploadsUrl: self.uploadfs.getUrl(),
        croppable: self.croppable,
        sized: self.sized
      };
    }
  };

};
