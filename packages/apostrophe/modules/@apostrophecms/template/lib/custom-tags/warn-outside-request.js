// Warn once per tag that a tag was used at the top level of a template
// brought in with `{% import %}`. Nunjucks runs that code in an empty
// context and discards its output, so the tag is skipped.

const warned = new WeakMap();

module.exports = function warnOutsideRequest(self, tag) {
  let tags = warned.get(self);
  if (!tags) {
    tags = new Set();
    warned.set(self, tags);
  }
  if (tags.has(tag)) {
    return;
  }
  tags.add(tag);
  self.logWarn(
    'tag-outside-request',
    `The {% ${tag} %} tag was used at the top level of a template brought in with {% import %}. Nunjucks discards that output, so it was skipped. Move it inside a fragment or macro, or use {% include %} instead.`,
    { tag }
  );
};
