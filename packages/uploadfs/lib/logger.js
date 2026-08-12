// uploadfs has no framework context of its own, so diagnostics go through an
// injectable logger: pass any console-shaped object as the `logger` option and
// every message uploadfs emits is delivered to it. Missing methods and no
// option at all fall back to `console`.

const methods = [ 'error', 'warn', 'info', 'debug' ];

module.exports = function createLogger(logger) {
  const source = logger || console;
  const result = {};
  for (const method of methods) {
    result[method] = typeof source[method] === 'function'
      ? (...args) => source[method](...args)
      : (...args) => console[method](...args);
  }
  return result;
};
