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
