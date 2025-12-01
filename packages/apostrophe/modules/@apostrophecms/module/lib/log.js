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
// 'current-module-name: event-type: some message',
// {
//   type: 'event-type',
//   severity: 'error',
//   module: 'current-module-name',
//   key: 'value',
// }
// If the option `messageAs` of `@apostrophecms/log` is set to 'msg',
// the result of the above log entry will be:
// {
//   type: 'event-type',
//   severity: 'error',
//   module: 'current-module-name',
//   key: 'value',
//   msg: 'current-module-name: event-type: some message',
// }
//
// If `filter` option is set, the log entry will be logged only if the
// `severity` or `eventType` match any filter. For more information about
// filters see `@apostrophecms/log` module.
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
    }
  };
};
