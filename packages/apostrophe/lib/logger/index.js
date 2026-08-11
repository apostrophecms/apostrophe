// The standalone Apostrophe logger: a plain factory with no moog, no async init
// and no dependencies, usable before - or without - an `apos` object. Reachable
// as `require('apostrophe/logger')`.
//
// ```js
// const createLogger = require('apostrophe/logger');
//
// const logger = createLogger({
//   format: 'auto',                  // structured | pretty | plain | auto
//   logger: pino(),                  // optional; bypasses our renderer entirely
//   context: { scope: 'multisite' }, // base fields, merged into every envelope
//   test: false,                     // stable output for test suites
//   streams: { out: process.stdout, err: process.stderr }
// });
//
// logger.info('proxy-listening', { port });                          // (type, data)
// logger.error('startup-failed', err.message, { stack: err.stack }); // (type, msg, data)
// const siteLogger = logger.child({ site: 'site-a' });               // merged context
// ```
//
// Every call produces one envelope - `severity`, then `module`, `type` and `msg`
// when present, then the context and event data - and the renderer decides what
// a line looks like. There is no `time` field: whatever consumes structured
// output stamps its own, so the timestamp is a rendering concern of the human
// readable formats.
//
// `child(context)` is our own facade, not a backend capability: the same log
// methods closed over merged context, forwarding to the same destination.
// Whoever hands a logger onward decides whether the receiver may destroy it, by
// including or omitting `destroy` - children omit it unless asked for.

const {
  FORMATS, isFormat, createRenderer
} = require('./render');
const { supportsColor } = require('./style');

const SEVERITIES = [ 'debug', 'info', 'warn', 'error' ];
const TO_STDERR = new Set([ 'warn', 'error' ]);

// Marks our own facades. A logger handed down from an outer process - the
// orchestrator of many apos instances gives each one a `child()` of its own -
// is that process's logger, not a custom backend to render into.
const IS_LOGGER = Symbol.for('apostrophe.logger');

module.exports = function createLogger(options = {}) {
  const {
    format = 'auto',
    logger = null,
    context = {},
    streams = {},
    test = false
  } = options;

  const out = streams.out || process.stdout;
  const err = streams.err || process.stderr;

  if (logger) {
    validateLogger(logger);
  }

  const color = logger ? false : supportsColor(out);
  // A custom logger owns its output: nothing is rendered and `format` has no
  // meaning, which is what `null` reports to anything asking.
  const resolved = logger
    ? null
    : resolveFormat(format, {
      test,
      color
    });
  const render = resolved && createRenderer({
    format: resolved,
    color,
    test
  });

  function deliver(envelope) {
    if (logger) {
      logger[envelope.severity](envelope);
      return;
    }
    const stream = TO_STDERR.has(envelope.severity) ? err : out;
    stream.write(render(envelope) + '\n');
  }

  function createFacade(facadeContext, withDestroy) {
    const facade = {
      [IS_LOGGER]: true,
      format: resolved,
      // `destroy: true` hands the receiver the right to tear the destination
      // down; by default a child cannot, because it does not own it.
      child(childContext, { destroy = false } = {}) {
        return createFacade({
          ...facadeContext,
          ...childContext
        }, destroy);
      }
    };
    for (const severity of SEVERITIES) {
      facade[severity] = (type, message, data) => {
        deliver(buildEnvelope(severity, facadeContext, parseArgs(type, message, data)));
      };
    }
    if (withDestroy) {
      facade.destroy = async () => {
        if (logger && typeof logger.destroy === 'function') {
          await logger.destroy();
        }
      };
    }
    return facade;
  }

  return createFacade(context, true);
};

module.exports.FORMATS = FORMATS;

// True for anything this factory produced, in this or any other copy of the
// package.
module.exports.isLogger = function (value) {
  return Boolean(value && value[IS_LOGGER]);
};

// `APOS_LOG_FORMAT` > the configured format > auto detection. The environment
// variable is the single switch that forces every logger instance in the
// process into the same mode at once.
function resolveFormat(configured, { test, color }) {
  const fromEnv = process.env.APOS_LOG_FORMAT;
  if (fromEnv) {
    const format = validateFormat(fromEnv, 'APOS_LOG_FORMAT environment variable');
    if (format !== 'auto') {
      return format;
    }
  } else if (configured !== 'auto') {
    return validateFormat(configured, 'log format option');
  }
  if (test) {
    return 'plain';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'legacy';
  }
  return color ? 'pretty' : 'plain';
}

function validateFormat(format, source) {
  if (format === 'auto' || isFormat(format)) {
    return format;
  }
  throw new Error(
    `Invalid log format "${format}" in the ${source}. ` +
    `Valid formats: ${[ 'auto', ...FORMATS ].join(', ')}.`
  );
}

function validateLogger(logger) {
  const missing = SEVERITIES.filter((severity) => typeof logger[severity] !== 'function');
  if (missing.length) {
    throw new Error(
      `The "logger" option must be an object with ${SEVERITIES.join(', ')} methods. ` +
      `Missing: ${missing.join(', ')}.`
    );
  }
}

// (type), (type, msg), (type, data) and (type, msg, data) are all supported.
// `type` may be null for output that has no event type of its own, such as a
// legacy bare string call.
function parseArgs(type, message, data) {
  if (type != null && typeof type !== 'string') {
    throw new TypeError(`Log event type must be a string, got ${typeof type}.`);
  }
  if (isObject(message)) {
    return {
      type,
      data: message
    };
  }
  if (message !== undefined && typeof message !== 'string') {
    throw new TypeError(`Log message must be a string, got ${typeof message}.`);
  }
  return {
    type,
    msg: message,
    data
  };
}

// `severity` always wins, then the call's own type and message, then the
// context, then the event data - which may override context fields.
function buildEnvelope(severity, context, {
  type, msg, data
}) {
  const merged = isObject(data)
    ? {
      ...context,
      ...data
    }
    : context;
  const envelope = { severity };
  if (merged.module !== undefined) {
    envelope.module = merged.module;
  }
  const eventType = type ?? merged.type;
  if (eventType !== undefined) {
    envelope.type = eventType;
  }
  const message = msg ?? merged.msg;
  if (message !== undefined) {
    envelope.msg = message;
  }
  for (const [ key, value ] of Object.entries(merged)) {
    if (key !== 'severity' && key !== 'module' && key !== 'type' && key !== 'msg') {
      envelope[key] = value;
    }
  }
  return envelope;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
