// Methods here should be of short, of universal utility, and not
// clearly in the domain of any other module. If you don't wish
// it was standard in JavaScript, it probably doesn't belong here.
// Many methods are simple wrappers for [lodash](https://npmjs.org/package/lodash) methods.

module.exports = {

  alias: 'utils',

  construct: function(self, options) {

    require('./lib/api.js')(self, options);

    // Add these after we're sure the templates module
    // is ready. Only necessary because this module is
    // initialized first
    self.modulesReady = function() {
      self.addHelpers(require('./lib/helpers.js')(self, options));
    };

  }
};
