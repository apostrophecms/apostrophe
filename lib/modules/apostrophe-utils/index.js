// Methods here should be of short, of universal utility, and not
// clearly in the domain of any other module. If you don't wish
// it was standard in JavaScript, it probably doesn't belong here.
// Many methods are simple wrappers for [lodash](https://npmjs.org/package/lodash) methods.

// ## Options
//
// ### `logger`
//
// A function which accepts `apos` and returns an object with
// at least `info`, `debug`, `warn` and `error` methods. These methods should
// support placeholders (see `util.format`). If this option is
// not supplied, logs are simply written to the Node.js `console`.
// A `log` method may also be supplied; if it is not, `info`
// is called in its place. Calls to `apos.utils.log`,
// `apos.utils.error`, etc. are routed through this object
// by Apostrophe. This provides compatibility out of
// the box with many popular logging modules, including `winston`.

module.exports = {

  alias: 'utils',

  singletonWarningIfNot: 'apostrophe-utils',

  afterConstruct: function(self) {
    self.enableLogger();
  },

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
