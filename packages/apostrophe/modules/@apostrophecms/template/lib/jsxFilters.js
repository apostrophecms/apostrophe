// JSX equivalents of Nunjucks filters, for Apostrophe's own JSX templates.
// Each returns what the filter outputs, before the JSX runtime escapes it
// for its position, so attribute values come out the same.

// The `jsonAttribute` filter: an object (or null) as JSON, anything else as
// a string. Like `apos.util.escapeHtml`, which the filter calls,
// `undefined` becomes an empty string.
function jsonAttribute(value) {
  const s = (typeof value === 'object') ? JSON.stringify(value) : String(value);
  return (s === 'undefined') ? '' : s;
}

module.exports = { jsonAttribute };
