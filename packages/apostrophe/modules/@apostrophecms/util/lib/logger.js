// The default logger: an adapter over the process logger, which core creates
// from the top-level `log` option before anything can emit. You may pass an
// alternate implementation as `log.logger`, or as the legacy `logger` option
// of this module.
//
// Everything that reaches it becomes an envelope, legacy string calls
// included, so `apos.util.log('Listening...')` is one JSON object in
// structured mode and a normal event line in pretty mode.

const { format } = require('node:util');
const _ = require('lodash');

module.exports = function (apos) {
  const logger = apos.logger;

  function emit(severity) {
    return (...args) => {
      const { msg, data } = toEnvelope(args);
      logger[severity](null, msg, data);
    };
  }

  return {
    // `apos.util.log` has never had a severity of its own; it means `info`.
    log: emit('info'),
    info: emit('info'),
    debug: emit('debug'),
    warn: emit('warn'),
    error: emit('error'),

    // The process logger belongs to core, and outlives any one module.
    async destroy() {
      // Nothing to do
    }
  };
};

// `(data)` and `(message, data)` come from the structured pipeline, which is
// why an object in final position is always the event data - splitting the
// sentence in two should not turn the data into text. Everything before it is
// composed into the message the way `console.*` would compose it, substitution
// strings included.
function toEnvelope(args) {
  const [ first ] = args;
  const last = args[args.length - 1];
  if (args.length === 1) {
    if (_.isPlainObject(first)) {
      return { data: first };
    }
    if (first instanceof Error) {
      return {
        msg: first.message,
        data: { stack: first.stack }
      };
    }
  }
  if (args.length >= 2 && _.isPlainObject(last)) {
    const rest = args.slice(0, -1);
    // The pipeline's own shape passes the message through untouched; a legacy
    // call that wrote several arguments has them composed.
    const single = rest.length === 1 &&
      (typeof rest[0] === 'string' || rest[0] === undefined);
    return {
      msg: single ? rest[0] : format(...rest),
      data: last
    };
  }
  return { msg: format(...args) };
}
