import { getTabId } from './tab-id.js';

// What a save carries for fields written from outside its editor, such as by
// the assistant (see `AposEditorMixin`): `{ tabId, parts }`, one part per
// marker the values came with, `{ marker, fields }`, `fields` their paths in
// the document saved (`title`, `@<widget or item id>.<field>`). `fields` maps
// paths to `{ edited, marker }`. `null` when nothing edited has a marker
export function getOutsideSave(fields) {
  const parts = new Map();
  for (const [ path, { edited, marker } ] of Object.entries(fields)) {
    if (!edited || !marker) {
      continue;
    }
    const key = JSON.stringify(marker);
    if (!parts.has(key)) {
      parts.set(key, {
        marker,
        fields: []
      });
    }
    parts.get(key).fields.push(path);
  }
  return parts.size
    ? {
      tabId: getTabId(),
      parts: [ ...parts.values() ]
    }
    : null;
}

// The value at one of those paths in `data`, a document or a part of one:
// a field, a dot path through objects, from a widget or item by `@<_id>`,
// or that widget or item whole. `undefined` when the widget or item is not
// in it
export function getOutsideValue(data, path) {
  const [ first, ...rest ] = path.split('.');
  const start = first.startsWith('@')
    ? findById(data, first.slice(1))
    : data?.[first];
  return rest.reduce((value, name) => value?.[name], start);

  function findById(value, _id) {
    if (!value || (typeof value !== 'object')) {
      return undefined;
    }
    if (value._id === _id) {
      return value;
    }
    for (const child of Object.values(value)) {
      const found = findById(child, _id);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
}
