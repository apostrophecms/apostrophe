// This module is always the last module loaded by default by Apostrophe,
// before any modules added by the user. It invokes the
// `servicesReady` method of all modules that have one. This may
// optionally take a callback.

var async = require('async');

module.exports = {
  construct: function(self, options, callback) {
    self.apos.callAll('servicesReady', callback);
  }
};
