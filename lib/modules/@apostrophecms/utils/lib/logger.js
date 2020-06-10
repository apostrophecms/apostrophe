// Default logger. You may pass an alternate implementation
// as the `logger` top-level option when configuring Apostrophe.

module.exports = function(apos) {
  return {
    // Log a message. The default
    // implementation wraps `console.log` and passes on
    // all arguments, so substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.

    log: function(msg) {
      // eslint-disable-next-line no-console
      console.log.apply(console, arguments);
    },

    // Log an informational message.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.

    info: function(msg) {
      // eslint-disable-next-line no-console
      console.info.apply(console, arguments);
    },

    // Log a debug message. Invokes
    // `console.debug` if available, otherwise
    // `console.log`.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.

    debug: function(msg) {
      // eslint-disable-next-line no-console
      if (console.debug) {
        // eslint-disable-next-line no-console
        console.debug.apply(console, arguments);
      } else {
        // eslint-disable-next-line no-console
        console.log.apply(console, arguments);
      }
    },

    // Log an error message. The default implementation
    // wraps `console.error` and passes on all arguments,
    // so substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.error` documentation.

    error: function(msg) {
      // eslint-disable-next-line no-console
      console.error.apply(console, arguments);
    },
    // Log a warning. The default implementation wraps
    // `console.warn` and passes on all arguments,
    // so substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.warn` documentation.
    //
    // The intention is that `apos.utils.warn` should be
    // called for situations less dire than
    // `apos.utils.error`.

    warn: function(msg) {
      // eslint-disable-next-line no-console
      console.warn.apply(console, arguments);
    }
  };
};
