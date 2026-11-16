import { getTabId } from './tab-id.js';
import { isEqual } from 'apostrophe/lib/beneath.js';

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

// Whether a value holds a widget or item with this `_id`, at any depth
export function hasOutsideId(value, _id) {
  if (!value || (typeof value !== 'object')) {
    return false;
  }
  if (value._id === _id) {
    return true;
  }
  return Object.values(value).some(child => hasOutsideId(child, _id));
}

// Whether a value from outside is the same as what an input holds, as
// both reach the server: properties left `undefined` don't count
export function isSameOutsideValue(held, value) {
  return isEqual(toJson(held), toJson(value));

  function toJson(value) {
    return (value === undefined) ? undefined : JSON.parse(JSON.stringify(value));
  }
}

// Where a key shows in an editor's schema (see `AposEditorMixin`): the
// innermost field shown that holds it, `{ scope, name, items }`. `scope` is
// the nested schema showing that field: `''` for `schema` itself, then an
// object's dot path or `@<item id>` for an inline array item, objects below
// it as `@<item id>.<field>`. `items` are the inline array items holding the
// key, outermost first. `null` when no field of `schema` holds it
export function getOutsidePlace(schema, value, key) {
  return find(schema, value, key, '', []);

  function find(schema, value, key, scope, items) {
    const isId = key.startsWith('@');
    const [ head, ...names ] = (isId ? key.slice(1) : key).split('.');
    const rest = names.join('.');
    const field = isId
      ? schema.find(field => hasOutsideId(value?.[field.name], head))
      : schema.find(field => field.name === head);
    if (!field) {
      return null;
    }
    const here = {
      scope,
      name: field.name,
      items
    };
    const given = value?.[field.name];
    if ((field.type === 'object') && given && (typeof given === 'object')) {
      const inner = isId
        ? ((given._id === head) ? rest : key)
        : rest;
      return (inner && find(
        field.schema || [],
        given,
        inner,
        scope ? `${scope}.${field.name}` : field.name,
        items
      )) || here;
    }
    if ((field.type === 'array') && field.inline && isId && Array.isArray(given)) {
      const item = given.find(item => hasOutsideId(item, head));
      if (!item) {
        return here;
      }
      const holding = {
        ...here,
        items: [ ...items, item._id ]
      };
      const inner = (item._id === head) ? rest : key;
      return (inner && find(
        field.schema || [],
        item,
        inner,
        `@${item._id}`,
        holding.items
      )) || holding;
    }
    return here;
  }
}
