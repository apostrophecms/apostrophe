const utils = require('../utils.js');

module.exports = {
  enable: function(self, path, callback) {
    const dPath = utils.getDisabledPath(path, self.options.disabledFileKey);
    return self.rename(dPath, path, callback);
  },
  disable: function(self, path, callback) {
    const dPath = utils.getDisabledPath(path, self.options.disabledFileKey);
    return self.rename(path, dPath, callback);
  }
};