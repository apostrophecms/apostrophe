// Serialize `data` to a JSON string that is safe to embed inside an HTML
// `<script>` element. `JSON.stringify` on its own does NOT escape the
// sequences `</script>`, `<!--` or `<![CDATA[`, so untrusted data (e.g.
// editor-provided SEO fields) in a JSON body could otherwise break out of
// the surrounding script tag and inject arbitrary HTML/JS (stored XSS).
// Escaping `<` as its `\u003c` form keeps the JSON valid while neutralizing
// all of those sequences. Line and paragraph separators are also escaped
// since they are valid in JSON but illegal in some JavaScript parsers.
//
// This is the single source of truth for that escaping. The template
// `renderNodes` helper uses it to render `{ json: ... }` node bodies, so in
// most cases you should just build a node like:
//
//   {
//     name: 'script',
//     attrs: { type: 'application/ld+json' },
//     body: [ { json: data } ]
//   }
//
// and let `renderNodes` do the right thing.

module.exports = function safeJsonForScript(data) {
  return JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
};
