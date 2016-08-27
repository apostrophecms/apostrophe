// This module attaches an instance of the [launder](https://npmjs.org/package/launder)
// npm module as `apos.launder`. The `apos.launder` object is then used throughout
// Apostrophe to sanitize user input.

module.exports = {
  construct: function(self, options) {
    self.apos.launder = require('launder')(options);
  }
};
