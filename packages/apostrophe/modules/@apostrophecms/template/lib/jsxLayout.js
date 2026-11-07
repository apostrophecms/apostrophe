// Helpers for JSX layouts whose props stand in for Nunjucks blocks, such as
// Apostrophe's own `outerLayoutBase.jsx`. Each prop named after a block can
// be:
//
// * `undefined`: the layout's default markup for the block is used.
// * a function: it is called with the default markup and returns the markup
//   to use, as a Nunjucks block calling `super()` would.
// * anything else: used in place of the default.

const {
  Raw, flatten, escapeAttr
} = require('./jsxRuntime.js');

// Resolve block `value` against `fallback`, a function returning the
// default markup.
function block(value, fallback) {
  if (value === undefined) {
    return fallback();
  }
  if (typeof value === 'function') {
    return value(fallback());
  }
  return value;
}

// Markup for a block that sits inside a tag, e.g. in an attribute value.
// A plain string or number is escaped for that position; markup, such as
// a Nunjucks block's output, is used as it is.
async function inTag(value) {
  if (value == null || value === false || value === true) {
    return '';
  }
  if ((typeof value === 'string') || (typeof value === 'number')) {
    return escapeAttr(value);
  }
  return flatten(value);
}

module.exports = {
  block,
  inTag,
  Raw
};
