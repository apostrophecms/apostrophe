module.exports = {
  construct: function(self, options) {
    self.apos.launder = require('launder')(options);
  }
};
