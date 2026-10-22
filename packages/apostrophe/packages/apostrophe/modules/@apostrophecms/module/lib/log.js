// Per module log handlers.
// Usage (same arguments for all log handlers):
// ```js
// self.logError('event-type');
// self.logError('event-type', { key: 'value' });
// self.logError('event-type', 'some message');
// self.logError('event-type', 'some message', { key: 'value' });
// Prepend `req` followed by any of the above argument variations.
// self.logError(req, ...);
// ```
//
// Event type is required and can be any string.
// If `req` is provided, the `data` object argument will be enriched with
// additional information from the request.
// Example:
// self.logError('event-type', 'some message', { key: 'value' });
// will log:
// 'some message',
// {
//   type: 'event-type',
//   severity: 'error',
//   module: 'current-module-name',
//   key: 'value',
// }
// The message stays exactly as written - the module name and the event type
// are fields, and whatever renders the entry composes the visible line.
// If the option `messageAs` of `@apostrophecms/log` is set to 'msg',
// the message travels in the data object instead:
// {
//   type: 'event-type',
//   severity: 'error',
//   module: 'current-module-name',
//   key: 'value',
//   msg: 'some message',
// }
//
// If `filter` option is set, the log entry will be logged only if the
// `severity` or `eventType` match any filter. For more information about
// filters see `@apostrophecms/log` module.
const { format } = require('node:util');

module.exports = function (self) {
  const exception = new Error(
    `Structured logging is not available for module "${self.__meta.name}".`
  );
  return {
    logDebug(...args) {
      if (!self.__structuredLoggingEnabled) {
        throw exception;
      }
      self.apos.structuredLog.logEntry(self, 'debug', ...args);
    },
    logInfo(...args) {
      if (!self.__structuredLoggingEnabled) {
        throw exception;
      }
      self.apos.structuredLog.logEntry(self, 'info', ...args);
    },
    logWarn(...args) {
      if (!self.__structuredLoggingEnabled) {
        throw exception;
      }
      self.apos.structuredLog.logEntry(self, 'warn', ...args);
    },
    logError(...args) {
      if (!self.__structuredLoggingEnabled) {
        throw exception;
      }
      self.apos.structuredLog.logEntry(self, 'error', ...args);
    },
    // A console-shaped logger for a library that has no apos context of its
    // own and accepts one as an option. Every call becomes an event of this
    // module, with the given event type. An `Error` passed on its own travels
    // as a message plus a stack; anything else is composed the way `console.*`
    // would compose it.
    //
    // The library is handed the console's own surface, `log` included, because
    // that is what it expects to have been given: the event type is ours to
    // decide, so nothing here reads an argument as one.
    getConsoleLogger(eventType) {
      const emit = method => (...args) => {
        const [ first ] = args;
        if (args.length === 1 && first instanceof Error) {
          self[method](eventType, first.message, { stack: first.stack });
          return;
        }
        self[method](eventType, format(...args));
      };
      return {
        debug: emit('logDebug'),
        info: emit('logInfo'),
        // `console.log` has no severity of its own; it means `info`, as it
        // always has on `apos.util`.
        log: emit('logInfo'),
        warn: emit('logWarn'),
        error: emit('logError')
      };
    }
  };
};
