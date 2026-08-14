// Envelope renderers. Every visible line Apostrophe emits is composed here, from
// the fields of an envelope - call sites never format.

const { inspect } = require('node:util');
const { createStyle } = require('./style');
const { isBanner, renderBanner } = require('./banner');

// `legacy` is the output shape of previous releases: `message {json}`. `auto`
// never resolves to it - it is configured explicitly, by a project that has
// scrapers or dashboards built on that shape and needs time to move.
const FORMATS = [ 'structured', 'pretty', 'plain', 'legacy' ];

// Where the line came from. `site` and the emitting module - or the coarser
// `scope`, for output that has no module - become `[label]`s before the
// message. Never repeated in the data of a human readable line.
const ORIGIN_KEYS = [ 'site', 'module', 'scope' ];

const BADGES = {
  warn: {
    text: 'WARN',
    color: 'yellow'
  },
  error: {
    text: 'ERROR',
    color: 'red'
  }
};

const COMPOSED_KEYS = new Set([ 'severity', 'type', 'msg', 'stack', ...ORIGIN_KEYS ]);

// A data object renders inline as `key=value` up to this width; beyond it, or
// with any non-primitive value, it renders indented on its own lines.
const INLINE_LIMIT = 72;

const PLAIN_STRING = /^[\w./:@+-]+$/;

module.exports = {
  FORMATS,
  isFormat,
  createRenderer,
  stringify
};

function isFormat(format) {
  return FORMATS.includes(format);
}

// Returns `render(envelope)` - a single string, never terminated by a newline.
// `test` selects the test rendering profile of the human readable formats:
// no timestamp and JSON indented data, so that captured output is stable.
function createRenderer({
  format, color = false, test = false
}) {
  if (format === 'structured') {
    return stringify;
  }
  if (format === 'legacy') {
    return renderLegacy;
  }
  // `pretty` is the only format that ever emits ANSI - `plain` is its zero
  // color twin, whatever the terminal is capable of.
  const useColor = color && format === 'pretty';
  const style = createStyle(useColor);
  // The banner is a development affordance, so it belongs to the format
  // developers watch, whether or not that terminal takes color.
  const banner = format === 'pretty';
  return (envelope) => (banner && isBanner(envelope))
    ? renderBanner(envelope, style)
    : renderHuman(envelope, {
      style,
      color: useColor,
      test
    });
}

// `HH:mm:ss [WARN] [module] type: message  key=value`, with the data indented
// below when it is too large, and the stack indented below that.
function renderHuman(envelope, {
  style, color, test
}) {
  const parts = [];
  if (!test) {
    parts.push(style('dim', timestamp()));
  }
  const badge = BADGES[envelope.severity];
  if (badge) {
    parts.push(style(badge.color, `[${badge.text}]`));
  }
  for (const label of [ envelope.site, envelope.module || envelope.scope ]) {
    if (typeof label === 'string' && label.length) {
      parts.push(style('cyan', `[${label}]`));
    }
  }
  const message = hang([ envelope.type, envelope.msg ]
    .filter((part) => typeof part === 'string' && part.length)
    .join(': '), 4);
  if (message) {
    parts.push(envelope.severity === 'debug' ? style('dim', message) : message);
  }

  let line = parts.join(' ');
  const stack = typeof envelope.stack === 'string' && envelope.stack.length
    ? envelope.stack
    : null;
  const data = Object.entries(envelope)
    .filter(([ key ]) => !COMPOSED_KEYS.has(key) || (key === 'stack' && !stack));
  if (data.length) {
    line += test
      ? '\n' + JSON.stringify(Object.fromEntries(data), null, 2)
      : renderData(data, style, color);
  }
  if (stack) {
    line += '\n' + style('dim', indent(stack, 4));
  }
  return line;
}

function renderData(data, style, color) {
  const inline = isInlineable(data) &&
    data.map(([ key, value ]) => `${key}=${inlineValue(value)}`).join(' ');
  if (inline && inline.length <= INLINE_LIMIT) {
    return '  ' + style('dim', inline);
  }
  const dump = inspect(Object.fromEntries(data), {
    depth: null,
    colors: color
  });
  return '\n' + indent(dump, 2);
}

function isInlineable(data) {
  return data.every(([ , value ]) => value === null || typeof value !== 'object');
}

function inlineValue(value) {
  if (typeof value === 'string') {
    return PLAIN_STRING.test(value) ? value : JSON.stringify(value);
  }
  return String(value);
}

// The output shape of previous releases: the composed message, followed by the
// event data as compact JSON. Bare string calls carry no event type and keep
// printing as the message alone, as they always have.
function renderLegacy(envelope) {
  const message = [ envelope.module, envelope.type, envelope.msg ]
    .filter((part) => typeof part === 'string' && part.length)
    .join(': ');
  if (envelope.type === undefined) {
    return message;
  }
  const { msg, ...data } = envelope;
  // The field order previous releases emitted.
  return `${message} ${stringify({
    module: data.module,
    type: data.type,
    severity: data.severity,
    ...data
  })}`;
}

// One line of JSON, always. Circular structures and BigInt would throw, and a
// logger that throws is worse than a logger that approximates.
function stringify(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return JSON.stringify(value, safeReplacer());
  }
}

function safeReplacer() {
  const seen = new WeakSet();
  return function (key, value) {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

function indent(text, width) {
  const pad = ' '.repeat(width);
  return text.split('\n').map((line) => pad + line).join('\n');
}

// A message written as a block - a lint notice, a multi-line explanation -
// keeps its first line on the entry and indents the rest, so that the block
// reads as one entry rather than as a run of new ones.
function hang(text, width) {
  if (!text.includes('\n')) {
    return text;
  }
  const pad = ' '.repeat(width);
  return text
    .split('\n')
    .map((line, index) => (index && line.length) ? pad + line : line)
    .join('\n');
}

function timestamp() {
  const now = new Date();
  return [ now.getHours(), now.getMinutes(), now.getSeconds() ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}
