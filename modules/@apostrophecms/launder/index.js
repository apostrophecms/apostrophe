// This module attaches an instance of the [launder](https://npmjs.org/package/launder)
// npm module as `apos.launder`. The `apos.launder` object is then used throughout
// Apostrophe to sanitize user input.

module.exports = {
  init(self, options) {
    self.apos.launder = require('launder')({
      // A3 _ids may contain :-separated components
      idRegExp: /^[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)*$/,
      ...options
    });
  }
};
