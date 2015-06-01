module.exports = {
  construct: function(self, options) {
    // require('./lib/routes.js')(self, options);
    require('./lib/dispatch.js')(self, options);
    // require('./lib/api.js')(self, options);
  }
};
