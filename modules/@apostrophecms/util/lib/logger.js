// Default logger. You may pass an alternate implementation
// as the `logger` top-level option when configuring Apostrophe.

module.exports = function (apos) {
  const logModule = apos.structuredLog;

  return {
    // Log a message. The default
    // implementation wraps `console.log` and passes on
    // all arguments, so substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.

    log: function(...args) {

      console.log(...logModule.formatLogByEnv(args));
    },

    // Log an informational message.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.

    info: function(...args) {

      console.info(...logModule.formatLogByEnv(args));
    },

    // Log a debug message. Invokes
    // `console.debug` if available, otherwise
    // `console.log`.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.

    debug: function(...args) {

      console.debug(...logModule.formatLogByEnv(args));
    },

    // Log an error message. The default implementation
    // wraps `console.error` and passes on all arguments,
    // so substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.error` documentation.

    error: function(...args) {

      console.error(...logModule.formatLogByEnv(args));
    },
    // Log a warning. The default implementation wraps
    // `console.warn` and passes on all arguments,
    // so substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.warn` documentation.
    //
    // The intention is that `apos.util.warn` should be
    // called for situations less dire than
    // `apos.util.error`.

    warn: function(...args) {

      console.warn(...logModule.formatLogByEnv(args));
    },

    // Automatically tear down the logger if available.

    async destroy() {
      // Nothing to do
    }
  };
};
