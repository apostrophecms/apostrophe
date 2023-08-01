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
// The object, or the returned object, must have `info`, `debug`, `warn` and `error` methods.
// If `destroy` is present it will be invoked and awaited (Promise) when Apostrophe is shut down.
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
// given, and only the object argument is passed to the `logger`, which is useful
// if using Pino.
// If there is no object-based argument an object is created.
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
    self.filters = {};
    self.initFilters();
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

      // Normalize the filters. Detect configuration and set defaults
      // per the current NODE_ENV if needed.
      // Convert `{ *: true }` to an object with all severity levels.
      // Convert severity/event type wildcards to arrays.
      // Override the configuration with the `APOS_FILTER_LOGS` environment variable.
      initFilters() {
        self.filters = self.options.filter || {};
        if (process.env.APOS_FILTER_LOGS) {
          self.filters = self.processEnvFilter(process.env.APOS_FILTER_LOGS);
        }
        self.filters['*'] = self.filters['*'] || {};

        // Transform *: true.
        if (self.filters['*'] === true) {
          self.filters['*'] = {
            severity: self.getDefaultSeverity(false)
          };
        } else if (!self.filters['*'].severity || self.filters['*'].severity.length === 0) {
          // Add environment specific severity levels if no severity is specified.
          self.filters['*'] = {
            ...self.filters['*'],
            severity: self.getDefaultSeverity(process.env.NODE_ENV === 'production')
          };
        }

        // Handle wildcards and validate.
        Object.keys(self.filters).forEach((module) => {
          Object.keys(self.filters[module]).forEach((type) => {
            if (self.filters[module][type] === true || self.filters[module][type] === '*') {
              self.filters[module][type] = type === 'severity'
                ? self.getDefaultSeverity(false)
                : [ '*' ];
            }
            if (!Array.isArray(self.filters[module][type]) || self.filters[module][type].length === 0) {
              throw new Error(
                `Invalid ${type} filter for module ${module}: ${JSON.stringify(self.filters[module][type])}`
              );
            }
          });
        });
      },
      // Convert a string filter configuration to an object.
      // Example:
      // `*:severity:warn,error;@apostrophecms/login:events:success,failure`
      // results in:
      // {
      //   '*': {
      //     severity: [ 'warn', 'error' ]
      //   },
      //   '@apostrophecms/login': {
      //     events: [ 'success', 'failure' ]
      //   }
      // }
      // Log all is just `*`.
      processEnvFilter(envFilter) {
        const filter = {};
        if (envFilter === '*') {
          filter['*'] = true;
          return filter;
        }
        envFilter.split(';').forEach((entry) => {
          const [ module, ...criteria ] = entry.split(':');
          const [ type, ...values ] = criteria;
          const value = values.join(':');
          if ([ 'severity', 'events' ].includes(type)) {
            filter[module] = {
              [type]: value.split(',')
            };
          } else {
            throw new Error(`Unknown filter type: ${type}`);
          }
        });
        return filter;
      },
      getDefaultSeverity(forProd = false) {
        return forProd
          ? [ 'warn', 'error' ]
          : [ 'debug', 'info', 'warn', 'error' ];
      },

      // Internal method, do not use it directly. See `@apostrophecms/module` for
      // module level logging methods - logInfo, logError, etc.
      logEntry(moduleSelf, severity, req, eventType, message, data) {
        if (!self.shouldKeepEntry(moduleSelf, severity, req, eventType)) {
          return;
        }
        const args = self.processLoggerArgs(
          moduleSelf,
          severity,
          req,
          eventType,
          message,
          data
        );
        self.apos.util[severity](...args);
      },
      // An internal method, do not use it directly.
      // Do a minimal computation and validation of the arguments - logs should
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
      processLoggerArgs(moduleSelf, ...args) {
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

        if (typeof eventType !== 'string') {
          throw new Error('Event type must be a string');
        }
        if (_.isPlainObject(message)) {
          data = message;
          message = undefined;
        }
        data = data ? { ...data } : {};
        data.type = eventType;
        data.severity = severity;
        data.module = moduleSelf.__meta?.name ?? '__unknown__';

        if (typeof message === 'string' && message.trim().length > 0) {
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
      // `moduleSelf` and `args` arguments should be the same as
      // passed to `processLogArgs(...)`.
      shouldKeepEntry(moduleSelf, ...args) {
        // Detect severity and eventType
        let severity;
        let req;
        let eventType;
        if (args[1] && typeof args[1].t === 'function') {
          // eslint-disable-next-line no-unused-vars
          [ severity, req, eventType ] = args;
        } else {
          [ severity, eventType ] = args;
        }
        const module = moduleSelf.__meta?.name ?? '__unknown__';

        // 1. Module filter
        if (self.filters[module] &&
          self.filters[module].severity &&
          !self.filters[module].severity.includes(severity)
        ) {
          return false;
        }
        if (self.filters[module] &&
          self.filters[module].events &&
          !self.filters[module].events.includes(eventType) &&
          !self.filters[module].events.includes('*')
        ) {
          return false;
        }

        // 2. Global filter
        if (!self.filters['*'].severity.includes(severity)) {
          return false;
        }
        if (self.filters['*'].events &&
          !self.filters['*'].events.includes(eventType) &&
          !self.filters['*'].events.includes('*')
        ) {
          return false;
        }

        return true;
      },

      formatLogByEnv(args) {
        const formatObj = process.env.NODE_ENV === 'production'
          ? JSON.stringify
          : (obj) => JSON.stringify(obj, null, 2);
        const formatString = process.env.NODE_ENV !== 'production' && args.length > 1
          ? (str) => str.trim() + '\n'
          : (str) => str;

        return args.map((arg) => {
          if (typeof arg === 'string') {
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
