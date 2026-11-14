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

// The value at one of those paths in `data`, a document or a part of one.
// `undefined` when the widget or item is not in it
export function getOutsideValue(data, path) {
  if (!path.startsWith('@')) {
    return data?.[path];
  }
  const dot = path.indexOf('.');
  return findById(data, path.slice(1, dot))?.[path.slice(dot + 1)];

  function findById(value, _id) {
    if (!value || (typeof value !== 'object')) {
      return null;
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
    return null;
  }
}
