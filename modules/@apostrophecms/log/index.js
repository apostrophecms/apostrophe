// Structured logging for Apostrophe.
//
// This module is generic, low level implementation. For logging inside of a module,
// see `logInfo`, `logError`, etc. methods available in every module
// via the base class, @apostrophecms/module.
//
// ### `logger`
//
// Optional. It can be an object or a function.
// If a function it accepts `apos` and returns an object with
// at least `info`, `debug`, `warn` and `error` methods. If a `destroy` method
// is present it will be invoked and awaited (Promise) when Apostrophe is shut down.
// The object, or the returned object, must have `info`, `debug`, `warn` and `error`
// methods.
// If `destroy` is present it will be invoked and awaited (Promise) when Apostrophe
// is shut down.
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
//         // match all severity levels
//         // severity: '*'
//         // match event types
//         // events: [ 'event-type-1', 'event-type-2' ]
//         // match all event types
//         // events: '*'
//       },
//       // Log specific event types from the login module
//       '@apostrophecms/login': {
//         events: [ 'incorrect-username', 'incorrect-password' ]
//         // match all event types
//         // events: '*'
//         // match specific severity levels
//         // severity: [ 'info' ]
//         // match all severity levels
//         // severity: '*'
//       }
//     }
//   }
// }
// ```
// In this example, all errors and warnings from any module, but
// only the specific event types (no matter the severity) from the login
// module, are logged. The logs will be kept if *either* criterion is met.
// `filter['*'] = true` enables logging of all events from all modules.
//
// ## Environment Variables
//
// ### `APOS_FILTER_LOGS`
//
// If set, this environment variable overrides the `filter` option.
// Example:
// ```sh
// # same as the `filter` example above
// eslint-disable-next-line max-len
// export APOS_FILTER_LOGS='*:severity:warn,error;@apostrophecms/login:events:incorrect-username,incorrect-password'
// # log everything, analogous to `{ filter: { '*': true }}`
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
    self.filterCache = {};
    self.initFilters();
  },
  methods(self) {
    // Keep those inside the methods because of performance.
    // Do not move to the root because of tests.
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = self.options.apos?.options?.test;
    const utilInspect = require('node:util').inspect;

    const formatDevObj = isTest
      ? (obj) => JSON.stringify(obj, null, 2)
      : (obj) => utilInspect(obj, {
        depth: null,
        colors: true
      });
    const formatObj = isProduction
      ? JSON.stringify
      : formatDevObj;
    const formatString = !isProduction
      ? (str, args) => (args.length > 1) ? str.trim() + '\n' : str
      : (str) => str;

    return {
      // Stringify object arguments. If `NODE_ENV` is not `production`,
      // pretty print the objects and add a new line at the end of string arguments.
      // This method is meant to be used from the methods of a custom `logger`.
      // See the default logger implementation in `util/lib/logger.js` for an example.
      formatLogByEnv(args) {
        return args.map((arg) => {
          if (typeof arg === 'string') {
            return formatString(arg, args);
          }
          if (_.isPlainObject(arg)) {
            return formatObj(arg);
          }
          return arg;
        });
      },
      // Normalize the filters. Detect configuration and set defaults
      // per the current NODE_ENV if needed.
      // Convert `{ *: true }` to an object with all severity levels.
      // Convert severity wildcards to arrays of (all) severity levels. This
      // speeds up the severity detection (no wildcards match).
      // Convert eventType wildcards to `[ '*' ]` array.
      // Override the configuration with the `APOS_FILTER_LOGS` environment variable
      // if set.
      initFilters() {
        self.filters = self.options.filter || {};
        if (process.env.APOS_FILTER_LOGS) {
          try {
            self.filters = self.parseEnvFilter(process.env.APOS_FILTER_LOGS);
          } catch (e) {
            throw new Error(`Invalid APOS_FILTER_LOGS environment variable: ${e.message}`);
          }
        }
        self.filters['*'] = self.filters['*'] || {};

        // Transform *: true - log absolutely everything.
        if (self.filters['*'] === true) {
          self.filters['*'] = {
            severity: self.getDefaultSeverity(false)
          };
          return;
        }
        // Add environment specific severity levels if no severity is specified.
        if (!self.filters['*'].severity) {
          self.filters['*'] = {
            ...self.filters['*'],
            severity: self.getDefaultSeverity(isProduction)
          };
        }

        // Handle wildcards and validate.
        for (const [ module, config ] of Object.entries(self.filters)) {
          for (const [ type, value ] of Object.entries(config)) {
            if (value === true || value === '*') {
              config[type] = (type === 'severity')
                ? self.getDefaultSeverity(false)
                : [ '*' ];
            }
            if (!Array.isArray(config[type])) {
              throw new Error(
                `Invalid ${type} filter for module ${module}: ${JSON.stringify(config[type])}`
              );
            }
          }
        }
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
      // Log all is just `*` and results in `{ '*': true }`.
      parseEnvFilter(envFilter) {
        const filter = {};
        if (envFilter === '*') {
          filter['*'] = true;
          return filter;
        }
        envFilter.split(';').forEach((entry) => {
          const [ module, ...criteria ] = entry
            .trim()
            .split(':')
            .map((str) => str.trim());
          // Trnasform e.g. `events:ev1,ev2` to`{ events: [ 'ev1', 'ev2' ] }`.
          filter[module] = criteria.reduce((acc, current, index, arr) => {
            if (index % 2) {
              return acc;
            }
            if (!arr[index + 1] || typeof arr[index + 1] !== 'string') {
              throw new Error(`Malformed configuration for module "${module}".`);
            }
            acc[current] = arr[index + 1].split(',').map((str) => str.trim());
            return acc;
          }, {});
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
      // `moduleSelf` is the module `self` object.
      // The allowed `severity` levels are `debug`, `info`, `warn` and `error`.
      // `severity` is required.
      // `req` (optional) is an apos request object.
      // The implementor will suport the following signature:
      // - (eventType)
      // - (eventType, data)
      // - (eventType, message)
      // - (eventType, message, data)
      // - (req, eventType[, message, data]) where message and data are optional
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
      processLoggerArgs(moduleSelf, severity, ...args) {
        let req;
        let eventType;
        let message;
        let obj;
        const data = {};

        // Detect `req` argument with a simple duck type check - apos `req` object
        // has always a translate `t` function.
        if (args[0] && typeof args[0].t === 'function') {
          [ req, eventType, message, obj ] = args;
        } else {
          [ eventType, message, obj ] = args;
        }

        if (typeof severity !== 'string') {
          throw new Error('Severity must be a string.');
        }
        if (typeof eventType !== 'string') {
          throw new Error('Event type must be a string');
        }
        if (_.isPlainObject(message)) {
          obj = message;
          message = undefined;
        }
        obj = obj ? { ...obj } : {};
        const aposModule = moduleSelf.__meta?.name ?? '__unknown__';

        if (typeof message === 'string' && message.trim().length > 0) {
          message = aposModule
            ? `${aposModule}: ${eventType}: ${message}`
            : `${eventType}: ${message}`;
        } else {
          message = aposModule
            ? `${aposModule}: ${eventType}`
            : eventType;
        }
        if (self.options.messageAs) {
          data[self.options.messageAs] = message;
          delete obj[self.options.messageAs];
        }
        // Preserve the property order.
        data.module = aposModule;
        data.type = eventType;
        data.severity = severity;

        self.processRequestData(req, data);
        // Don't override system properties.
        Object.assign(data, obj);
        data.module = aposModule;
        data.type = eventType;
        data.severity = severity;

        return self.options.messageAs ? [ data ] : [ message, data ];
      },

      // Enrich the `data` argument with additional information from the request.
      processRequestData(req, data) {
        if (!req) {
          return data;
        }

        data.url = req.originalUrl;
        data.path = req.path;
        data.method = req.method;
        data.ip = self.getIp(req);
        data.query = req.query;
        data.requestId = self.getRequestId(req);
      },

      // Helper to get the IP address from the request.
      // Can be overriden.
      getIp(req) {
        return req.ip;
      },

      // Helper to get unique request id. It will be generated (once) if not present.
      // Can be refatored to express level in the future.
      getRequestId(req) {
        if (!req.requestId) {
          req.requestId = self.apos.util.generateId();
        }
        return req.requestId;
      },

      // Assess the module filter configuration and determine if the log
      // should be kept or rejected.
      //
      // `moduleSelf` and `args` arguments should be the same as
      // passed to `processLogArgs(...)`.
      //
      // The module and global configs are merged.
      // The logic is as follows:
      // - if severity is matched, keep the log (no matter the event type)
      // - if eventType is matched, keep the log (no matter the severity)
      shouldKeepEntry(moduleSelf, ...args) {
        // Detect severity and eventType from the arguments.
        let severity;
        let req;
        let eventType;
        if (args[1] && typeof args[1].t === 'function') {
          // eslint-disable-next-line no-unused-vars
          [ severity, req, eventType ] = args;
        } else {
          [ severity, eventType ] = args;
        }
        const aposModule = moduleSelf.__meta?.name ?? '__unknown__';
        const cacheId = `${aposModule}:${severity}:${eventType}`;
        if (typeof self.filterCache[cacheId] !== 'undefined') {
          return self.filterCache[cacheId];
        }

        // Consolidate and match severity and event type.
        const severityArr = [
          ...new Set([
            ...self.filters['*'].severity,
            ...(self.filters[aposModule]?.severity || [])
          ])
        ];
        const eventsArr = [
          ...new Set([
            ...(self.filters['*'].events || []),
            ...(self.filters[aposModule]?.events || [])
          ])
        ];
        const severityMatch = severityArr.includes(severity);
        const eventsMatch = eventsArr.length > 0
          ? eventsArr.includes(eventType) || eventsArr.includes('*')
          : severityMatch;

        self.filterCache[cacheId] = severityMatch || eventsMatch;
        return self.filterCache[cacheId];
      }
    };
  }
};
