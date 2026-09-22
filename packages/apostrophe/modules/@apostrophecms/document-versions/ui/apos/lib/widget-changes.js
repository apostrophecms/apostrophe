// The markers of the annotated document, collected by widget `_id`:
// `changes` lists `added`, `modified` or `deleted`, then `moved` when the
// widget changed places in its area; `ai` is whether AI was involved in
// any of them; `data` is what the rendering of a widget with an older
// version needs (see the markers store): `content` is taken from any such
// widget, rich text or not, which is harmless since it is the widget's own
// value, marked only for rich text. Nested widgets are rendered by the
// server from sanitized data, which drops the markers, so the area wrapper
// finds its changes here instead
function getWidgetChanges(doc) {
  const changes = {};
  collect(doc);
  return changes;

  function collect(node) {
    if (!node || (typeof node !== 'object')) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (node._id && (node.metaType === 'widget')) {
      const change = (node._inserted && 'added') ||
        (node._deleted && 'deleted') ||
        ((node._modified || node._olderVersion) && 'modified') ||
        null;
      const found = [ change, node._moved && 'moved' ].filter(Boolean);
      if (found.length) {
        changes[node._id] = {
          changes: found,
          ai: Boolean(node._changedWithAi || node._movedWithAi),
          ...(node._olderVersion && {
            data: {
              _olderVersion: node._olderVersion,
              ...(typeof node.content === 'string' && { content: node.content })
            }
          })
        };
      }
    }
    for (const [ key, value ] of Object.entries(node)) {
      // The older widget is not part of this version
      if (key !== '_olderVersion') {
        collect(value);
      }
    }
  }
}

export default {
  getWidgetChanges
};
