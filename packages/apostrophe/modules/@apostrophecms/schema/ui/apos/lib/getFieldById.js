// The browser side of `apos.schema.getFieldById`.
//
// A field id names the position of the field in the schema tree, e.g.
// `doc.article.body`, `widget.@apostrophecms/rich-text.content` or, for a
// field of an array or object field, `doc.article.sections.caption`. Since
// every doc type and widget type already ships its schema to the browser,
// the id is all anything needs in order to find the definition, and markup
// that names a field can name it in a few bytes rather than carrying a copy
// of something the page already has.
//
// Returns `null` if the field cannot be found, which is not an error: the
// schema in the browser is the schema this user is allowed to see, so a
// field `allowedSchema` filtered out simply isn't there. Callers display the
// value and leave it at that.

export default function getFieldById(id) {
  if (!id) {
    return null;
  }
  const [ metaType, type, ...path ] = id.split('.');
  if (!type || !path.length) {
    return null;
  }
  const moduleName = (metaType === 'widget') ? `${type}-widget` : type;
  let schema = window.apos.modules[moduleName]?.schema;
  let field = null;
  for (const name of path) {
    if (!Array.isArray(schema)) {
      return null;
    }
    field = schema.find(field => field.name === name);
    if (!field) {
      return null;
    }
    // Array and object fields carry the schema of what they contain, which
    // is where the rest of the path leads
    schema = field.schema;
  }
  return field;
}
