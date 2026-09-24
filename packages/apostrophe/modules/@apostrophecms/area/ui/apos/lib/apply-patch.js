// Apply a patch, in the form sent to the server by `context-edited`, to the
// items of one area in the browser, the way the server applies it to the
// document. Used to replay undo and redo on the page without rendering the
// page again.
//
// Understands the operators the area editor itself sends (`$push`,
// `$pullAllById` and `$move` aimed at `@areaId.items`) and replacement of a
// widget, or of a property of one, with `@id` and `@id.dot.path` keys.
//
// Only widgets directly in the area are looked at, because an area nested
// inside one of them has an editor of its own that applies the patch there.
// Pass `deep: true` for an area with no editor yet, whose nested areas have
// none either.
//
// Returns `null` if the patch has nothing to do with this area, otherwise
// `{ items, changed, removed }`: a new array, leaving `items` alone, the ids
// of the widgets in it that are new or were replaced, and the widgets the
// patch took out.

import { klona } from 'klona';

export default function applyPatch(areaId, items, patch, { deep = false } = {}) {
  const itemsKey = `@${areaId}.items`;
  if (patch.$push?.[itemsKey]) {
    return push(items, patch.$push[itemsKey]);
  }
  if (patch.$pullAllById?.[itemsKey]) {
    const value = patch.$pullAllById[itemsKey];
    const ids = Array.isArray(value) ? value : [ value ];
    return {
      items: items.filter(item => !ids.includes(item._id)),
      changed: [],
      // What was taken out, as it was at the time. Putting an edit back
      // means putting this back, not what the widget looked like when it
      // was first added
      removed: items.filter(item => ids.includes(item._id))
    };
  }
  if (patch.$move?.[itemsKey]) {
    return move(items, patch.$move[itemsKey]);
  }
  for (const [ key, value ] of Object.entries(patch)) {
    if (!key.startsWith('@')) {
      continue;
    }
    const dot = key.indexOf('.');
    const id = key.substring(1, (dot === -1) ? undefined : dot);
    const path = (dot === -1) ? null : key.substring(dot + 1);
    if (id === areaId) {
      if (!path && value?.items) {
        return {
          items: klona(value.items),
          changed: value.items.map(item => item._id)
        };
      }
      continue;
    }
    const result = replace(items, id, path, value, deep);
    if (result) {
      return result;
    }
  }
  return null;
}

function push(items, {
  $each, $before, $after, $position
}) {
  const each = klona(Array.isArray($each) ? $each : []);
  let position = items.length;
  if ($position !== undefined) {
    position = Math.min(Math.max(parseInt($position) || 0, 0), items.length);
  } else if ($before) {
    const index = items.findIndex(item => item._id === $before);
    position = (index === -1) ? items.length : index;
  } else if ($after) {
    const index = items.findIndex(item => item._id === $after);
    position = (index === -1) ? items.length : index + 1;
  }
  return {
    items: [ ...items.slice(0, position), ...each, ...items.slice(position) ],
    changed: each.map(item => item._id)
  };
}

function move(items, {
  $item, $before, $after
}) {
  const index = items.findIndex(item => item._id === $item);
  if (index === -1) {
    return {
      items,
      changed: []
    };
  }
  const result = [ ...items ];
  const [ item ] = result.splice(index, 1);
  let position = index;
  if ($before) {
    const i = result.findIndex(item => item._id === $before);
    position = (i === -1) ? index : i;
  } else if ($after) {
    const i = result.findIndex(item => item._id === $after);
    position = (i === -1) ? index : i + 1;
  }
  result.splice(position, 0, item);
  return {
    items: result,
    changed: []
  };
}

function replace(items, id, path, value, deep) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let updated;
    if (item._id === id) {
      updated = path ? setPath(klona(item), path, value) : klona(value);
    } else if (deep) {
      const copy = klona(item);
      if (!replaceNested(copy, id, path, value)) {
        continue;
      }
      updated = copy;
    } else {
      continue;
    }
    const result = [ ...items ];
    result[i] = updated;
    return {
      items: result,
      changed: [ updated._id ]
    };
  }
  return null;
}

// Find the object with this `_id` inside `object` and replace it, or set
// `path` within it. Relationships are skipped, as they only hold copies
function replaceNested(object, id, path, value) {
  for (const [ key, val ] of Object.entries(object)) {
    if (key.startsWith('_') || !val || (typeof val !== 'object')) {
      continue;
    }
    if (val._id === id) {
      if (path) {
        setPath(val, path, value);
      } else {
        object[key] = klona(value);
      }
      return true;
    }
    if (replaceNested(val, id, path, value)) {
      return true;
    }
  }
  return false;
}

function setPath(object, path, value) {
  const keys = path.split('.');
  let target = object;
  for (const key of keys.slice(0, -1)) {
    if (!target[key] || (typeof target[key] !== 'object')) {
      target[key] = {};
    }
    target = target[key];
  }
  target[keys[keys.length - 1]] = klona(value);
  return object;
}
