var express = require('express');

module.exports = {
  construct: function(self, options) {
    // TODO: properly migrate relevant appy code here, including
    // baseApp, prefix, etc. This is just proof of concept.
    var app = express();
    self.apos.app = app;
  }
};
