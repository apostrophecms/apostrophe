// The only place ANSI codes are produced. `util.styleText` is used purely as the
// primitive: we decide whether color is appropriate, it decides what the escape
// codes look like. Swapping the primitive touches this file only.

const { styleText } = require('node:util');

module.exports = {
  supportsColor,
  createStyle
};

// The capability chain quality tooling has settled on: `NO_COLOR` off,
// `FORCE_COLOR` / `--color` on, CI on (its log viewers render ANSI), otherwise a
// TTY that is not `TERM=dumb`. `stream` is the destination we would write to.
function supportsColor(stream) {
  const env = process.env;
  if (env.NO_COLOR) {
    return false;
  }
  if (env.FORCE_COLOR !== undefined) {
    return env.FORCE_COLOR !== '0';
  }
  if (process.argv.includes('--color')) {
    return true;
  }
  if (env.CI) {
    return true;
  }
  return Boolean(stream && stream.isTTY) && env.TERM !== 'dumb';
}

// Returns `style(format, text)`, where `format` is a `util.styleText` format
// name or an array of them. Without color it is the identity function.
function createStyle(enabled) {
  if (!enabled) {
    return (format, text) => text;
  }
  return (format, text) => (Array.isArray(format) ? format : [ format ])
    .reduce((result, one) => styleText(one, result, { validateStream: false }), text);
}
