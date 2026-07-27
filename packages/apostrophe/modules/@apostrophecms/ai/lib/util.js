// Shared predicates and parsers, imported as plain functions wherever they
// are needed.

// Any non-array object, class instances included — deliberately looser than
// _.isPlainObject, which the engine relies on for adapter results and tool
// arguments
function isObject(value) {
  return Boolean(value) && typeof value === 'object' &&
    !Array.isArray(value);
}

// An abort-shaped throw: the AbortError the http stack raises when
// an AbortSignal fires, or Node's ABORT_ERR code
function isAbort(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

// A 'W:H' aspect string → its [ width, height ] positive numbers, or
// null when it is not a well-formed ratio. Named tokens are not
// accepted here.
function parseAspect(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value);
  if (!match) {
    return null;
  }
  const w = Number(match[1]);
  const h = Number(match[2]);
  return w > 0 && h > 0 ? [ w, h ] : null;
}

// Startup-only: a bad configuration must kill the boot with a plain prefixed
// Error. Runtime code throws self.apos.error(...) instead, so the name says
// where this belongs.
function startupFail(message) {
  throw new Error(`@apostrophecms/ai: ${message}`);
}

module.exports = {
  isObject,
  isAbort,
  parseAspect,
  startupFail
};
