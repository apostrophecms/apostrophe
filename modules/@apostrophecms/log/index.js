// Structured logging for Apostrophe.
//
// This module is generic, low level implementation. For logging inside of a module,
// see `logInfo`, `logError`, etc. methods in `@apostrophecms/module`.
//
// ### `logger`
//
// Optional. It can be an object or a function.
// If a function it accepts `apos` and returns an object with
// at least `info`, `debug`, `warn` and `error` methods. If a `destroy` method
// is present it will be invoked and awaited (Promise) when Apostrophe is shut down.
// If an object it must have at least `info`, `debug`, `warn` and `error` methods.
// If this option is not supplied, logs are simply written to the Node.js `console`.
// Calls to `apos.utils.info`, `apos.utils.error`, etc. or module level `self.logInfo`,
// `self.logError`, etc are routed through this object by Apostrophe.
// This provides compatibility out of the box with many popular
// logging modules, including`pino`, `winston`, etc.
//
// ## Options
//
// ### `messageAs`
//
// When the messageAs option is set, the message argument to apos.util.info, etc.
// is bundled into the second, object - based argument as a property of the name
// given, and only the object argument is passed to Pino. If there is
// no object-based argument an object is created.
// Example:
// ```js
// {
//   options: {
//     messageAs: 'msg'
//   }
// }
// ```
// The resulting util log call will be:
// ```js
// self.apos.util.error({
//   msg: '@apostrophecms/login: incorrect-username: User admin failed to log in',
//   type: 'incorrect-username'
//   module: '@apostrophecms/login'
// });
// ```
//
// ### `filter`
//
// By module name, or `*` we can specify any mix of severity levels and
// specific event types, and entries are kept if *either* criterion is met.
// Example:
// ```js
// {
//   options: {
//     filter: {
//       // Log all errors and warnings from any module
//       '*': {
//         severity: [ 'warn', 'error' ]
//       },
//       // Log specific event types from the login module
//       '@apostrophecms/login': {
//         events: [ 'incorrect-username', 'incorrect-password' ]
//       }
//     }
//   }
// }
// ```
// In this example, all errors and warnings from any module, but
// only the specific event types (no matter the severity) from the login
// module, are logged.
//
// ## Environment Variables
//
// ### `APOS_FILTER_LOGS`
//
// If set, this environment variable overrides the `filter` option.
// Example:
// ```sh
// # same as the `filter` example above
// export APOS_FILTER_LOGS='*:severity:warn,error;@apostrophecms/login:events:incorrect-username,incorrect-password'
// # log everything
// export APOS_FILTER_LOGS='*'
// ```
//

const _ = require('lodash');

module.exports = {
  options: {
    alias: 'structuredLog'
  },
  init(self) {
  },
  methods(self) {
    return {
      // Logger for a module factory.
      // The created logger object contains `debug`, `info`, `warn` and `error` methods,
      // each suuporting the following signature:
      // - (eventType)
      // - (eventType, data)
      // - (eventType, message)
      // - (eventType, message, data)
      // - (req, eventType[, message, data]) message and data are optional
      getLoggerForModule(moduleSelf) {
        return {
          debug: (...args) => {
            self.logEntry(moduleSelf, 'debug', ...args);
          },
          info: (...args) => {
            self.logEntry(moduleSelf, 'info', ...args);
          },
          warn: (...args) => {
            self.logEntry(moduleSelf, 'warn', ...args);
          },
          error: (...args) => {
            self.logEntry(moduleSelf, 'error', ...args);
          }
        };
      },
      // Internal module, do not use it directly. See `@apostrophecms/module` for
      // module level logging methods - logInfo, logError, etc.
      logEntry(moduleSelf, severity, req, eventType, message, data) {
        const args = self.processLoggerArgs(
          moduleSelf,
          severity,
          req,
          eventType,
          message,
          data
        );
        if (self.shouldKeepEntry(data)) {
          self.apos.util[severity](...args);
        }
      },
      // Do a minimal computation and validation of the arguemnts - logs should
      // be fast. The function exepects 4 or 5 arguments (without counting the first optional `moduleSelf` argument),
      // but all of the below will work:
      // processLogArgs(moduleSelf, severity = 'info', eventType = 'event-type');
      // processLogArgs(moduleSelf, severity = 'info', eventType = 'event-type', data = { module: 'my-module' });
      // processLogArgs(moduleSelf, severity = 'info', eventType = 'event-type', message = 'message', data = { module: 'my-module' });
      // processLogArgs(moduleSelf, severity = 'info', req, eventType = 'event-type', [...messageAndOrData]);
      //
      // If `moduleSelf` is provided, it is used to extract the module name from
      // the `__meta` property.
      // `severity` and `eventType` are required.
      // `req`, `message` and `data` are optional.
      // `req` is an apos request object. If provided, the `data` argument will be
      // enriched with additional information from the request.
      // `data.module` is recognized as a special property and is used to refortmat
      // the message.
      // `data.severity` is always set to the value of the `severity` argument.
      // `data.type` is always set to the value of the `eventType` argument.
      // message is optional, if not provided it is generated from the eventType and data.module.
      // Optional message values:
      // - `module: eventType: message`
      // - `eventType: message`: (missing module)
      // - `module: eventType`: (missing message)
      // - `eventType`: (missing module and message)
      //
      // Returns [ data ] or [ message, data ] depending on option.messageAs.
      // `data` is always an object containing at least a `type` and `severity` properties.
      processLoggerArgs(...allArgs) {
        const args = allArgs.slice(1);
        const moduleSelf = allArgs[0];
        let severity;
        let req;
        let eventType;
        let message;
        let data;

        // Detect `req` argument with a simple duck type check - apos `req` object
        // has always a translate `t` function.
        if (args[1] && typeof args[1].t === 'function') {
          [ severity, req, eventType, message, data ] = args;
        } else {
          [ severity, eventType, message, data ] = args;
        }

        if (!_.isString(eventType)) {
          throw new Error('Event type must be a string');
        }
        if (_.isPlainObject(message)) {
          data = message;
          message = undefined;
        }
        data = data ? { ...data } : {};
        data.type = eventType;
        data.severity = severity;
        if (moduleSelf) {
          data.module = moduleSelf.__meta?.name;
        }

        if (_.isString(message) && message.trim().length > 0) {
          message = data.module
            ? `${data.module}: ${eventType}: ${message}`
            : `${eventType}: ${message}`;
        } else {
          message = data.module
            ? `${data.module}: ${eventType}`
            : eventType;
        }

        data = self.processRequestData(req, data);

        if (self.options.messageAs) {
          data[self.options.messageAs] = message;
          return [ data ];
        }

        return [ message, data ];
      },

      // Enrich the `data` argument with additional information from the request.
      processRequestData(req, data) {
        if (!req) {
          return data;
        }
        return {
          // https://expressjs.com/en/api.html#req.originalUrl
          url: req.originalUrl,
          path: req.path,
          ip: req.ip,
          query: req.query,
          requestId: req.requestId || self.apos.util.generateId(),
          ...data
        };
      },

      // Assess the module filter configuration and determine if the log
      // should be kept or rejected.
      //
      // `data` argument should be an object returned from `processLogArgs(...)`.
      shouldKeepEntry(data) {
        // FIXME implement
        return true;
      },

      formatLogByEnv(args) {
        const formatObj = process.env.NODE_ENV === 'production'
          ? JSON.stringify
          : (obj) => JSON.stringify(obj, null, 2);
        const formatString = process.env.NODE_ENV !== 'production' && args.length > 1
          ? (str) => str.replace(/\n/g, '\n  ')
          : (str) => str;

        return args.map((arg) => {
          if (_.isString(arg)) {
            return formatString(arg);
          }
          if (_.isPlainObject(arg)) {
            return formatObj(arg);
          }
          return arg;
        });
      }
    };
  }
};
