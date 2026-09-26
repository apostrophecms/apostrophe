// Turn an edited copy of a document or widget back into patches, the way
// the PATCH API and the collaboration session understand them, so that only
// what the user actually changed is saved.
//
// Saving a whole copy, as a modal otherwise does, would put back everything
// the modal was opened with, overwriting whatever anyone else did in the
// meantime. A patch says what changed instead: fields are set one by one,
// and areas and arrays are changed item by item, by id (`$pullAllById`,
// `$push` next to a neighbor, `$move`), so that edits made elsewhere in the
// same area or array survive.
//
// `diffToPatch(schema, before, after, { prefix, getWidgetSchema })`:
//
// * `schema`: the fields of `before` and `after`. Only these are compared.
// * `prefix`: what patch keys start with. Empty for the fields of a document,
// `@widgetId.` for those of a widget.
// * `getWidgetSchema(type)`: the schema of a widget type, for looking inside
// the widgets of an area. Defaults to the browser's widget modules.
// * `areas`: `'items'` (the default) to patch areas item by item, or
// `'replace'` to set a changed area as a whole, for when whoever applies the
// patches cannot apply item by item changes to an area nested inside
// another.
//
// Returns an array of patches, to be applied in order.
//
// `diffWidget(before, after, { getWidgetSchema })` does the same for one
// widget.

import { isEqual } from 'apostrophe/lib/beneath.js';

export default function diffToPatch(schema, before, after, {
  prefix = '',
  getWidgetSchema = defaultWidgetSchema,
  areas = 'items'
} = {}) {
  const differ = createDiffer(getWidgetSchema, areas);
  differ.diffFields(schema, before || {}, after || {}, prefix);
  return differ.patches;
}

export function diffWidget(before, after, {
  getWidgetSchema = defaultWidgetSchema,
  areas = 'items'
} = {}) {
  const differ = createDiffer(getWidgetSchema, areas);
  differ.diffWidget(before, after);
  return differ.patches;
}

function createDiffer(getWidgetSchema, areas) {
  const patches = [];
  return {
    patches,
    diffFields,
    diffWidget
  };

  function diffFields(schema, before, after, prefix) {
    for (const field of schema || []) {
      const name = field.name;
      const key = `${prefix}${name}`;
      const a = before[name];
      const b = after[name];
      if (same(a, b)) {
        continue;
      }
      if ((field.type === 'area') && (areas === 'items') && a?._id && (a._id === b?._id)) {
        diffList(`@${a._id}.items`, a.items || [], b.items || [], diffWidget);
      } else if ((field.type === 'array') && Array.isArray(a) && Array.isArray(b) && hasIds(a) && hasIds(b)) {
        diffList(key, a, b, (itemBefore, itemAfter) => {
          diffFields(field.schema, itemBefore, itemAfter, `@${itemAfter._id}.`);
        });
      } else if (
        (field.type === 'object') &&
        a && b && (typeof a === 'object') && (typeof b === 'object')
      ) {
        diffFields(field.schema, a, b, `${key}.`);
      } else {
        patches.push({ [key]: (b === undefined) ? null : b });
      }
    }
  }

  function diffWidget(before, after) {
    if (before.type !== after.type) {
      patches.push({ [`@${after._id}`]: after });
      return;
    }
    const schema = getWidgetSchema(after.type);
    if (!schema) {
      patches.push({ [`@${after._id}`]: after });
      return;
    }
    diffFields(schema, before, after, `@${after._id}.`);
    // Properties of a widget that are not fields of its schema, such as
    // `aposPlaceholder`, are set one by one too
    for (const name of new Set([ ...Object.keys(before), ...Object.keys(after) ])) {
      if (
        name.startsWith('_') ||
        // Set only on the copy a modal shows as a live preview
        [ 'type', 'metaType', 'aposLivePreview' ].includes(name) ||
        schema.some(field => field.name === name)
      ) {
        continue;
      }
      if (!same(before[name], after[name])) {
        patches.push({ [`@${after._id}.${name}`]: after[name] ?? null });
      }
    }
  }

  // Patches that turn the list `before` into `after`, both lists of objects
  // with `_id`s, then `diffItem(before, after)` for each item in both
  function diffList(key, before, after, diffItem) {
    const afterIds = new Set(after.map(item => item._id));
    const beforeIds = new Set(before.map(item => item._id));
    const removed = before.filter(item => !afterIds.has(item._id)).map(item => item._id);
    if (removed.length) {
      patches.push({ $pullAllById: { [key]: removed } });
    }
    // What is left of `before`, in its order. The items that are already in
    // the right order relative to each other stay put; the rest move
    const kept = before.filter(item => afterIds.has(item._id)).map(item => item._id);
    const target = after.filter(item => beforeIds.has(item._id)).map(item => item._id);
    const order = longestIncreasing(target.map(id => kept.indexOf(id)));
    const staying = new Set(order.map(i => kept[i]));
    // In the order they end up in, so that each one's neighbor is already in
    // place when it is positioned
    for (let i = 0; i < after.length; i++) {
      const item = after[i];
      const position = (i > 0)
        ? { $after: after[i - 1]._id }
        : (after.length > 1)
          ? { $before: after[1]._id }
          : {};
      if (!beforeIds.has(item._id)) {
        const push = {
          $each: [ item ],
          ...((i > 0) ? { $after: after[i - 1]._id } : { $position: 0 })
        };
        patches.push({ $push: { [key]: push } });
      } else if (!staying.has(item._id) && Object.keys(position).length) {
        patches.push({
          $move: {
            [key]: {
              $item: item._id,
              ...position
            }
          }
        });
      }
    }
    for (const item of after) {
      const prior = before.find(({ _id }) => _id === item._id);
      if (prior && !same(prior, item)) {
        diffItem(prior, item);
      }
    }
  }
}

function hasIds(list) {
  return list.every(item => item && (typeof item._id === 'string'));
}

// Values compared as they would be saved: `undefined` and `null` both mean
// nothing
function same(a, b) {
  if ((a == null) && (b == null)) {
    return true;
  }
  return isEqual(a, b);
}

// Indexes into `values` of a longest strictly increasing subsequence,
// ignoring negative values
function longestIncreasing(values) {
  const tails = [];
  const previous = new Array(values.length).fill(-1);
  for (let i = 0; i < values.length; i++) {
    if (values[i] < 0) {
      continue;
    }
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (values[tails[mid]] < values[i]) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    if (low > 0) {
      previous[i] = tails[low - 1];
    }
    tails[low] = i;
  }
  const result = [];
  let i = tails.length ? tails[tails.length - 1] : -1;
  while (i !== -1) {
    result.unshift(values[i]);
    i = previous[i];
  }
  return result;
}

function defaultWidgetSchema(type) {
  const name = globalThis.apos?.area?.widgetManagers?.[type];
  return name ? globalThis.apos.modules[name]?.schema : null;
}
