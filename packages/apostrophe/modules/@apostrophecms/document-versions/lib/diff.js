// Change detection between two versions of a document: pure functions over
// a schema and two documents. `walk` lists every changed path at its full
// depth, `annotate` marks a copy of the newer document for WYSIWYG display.
// Both take a `ctx` built by the module (`getDiffContext`) so that nothing
// here reaches for `apos` directly.

const _ = require('lodash');
const text = require('./text.js');

// Field types with their own walk, reached through `extend` as well
const STRUCTURAL = new Set([ 'area', 'array', 'object', 'relationship' ]);
// Field types that store nothing
const VALUELESS = new Set([ 'group', 'relationshipReverse' ]);
// Widget keys that are bookkeeping, not content
const WIDGET_KEYS = new Set([ '_id', 'type', 'metaType', 'aposPlaceholder', 'aposMeta' ]);

const HIGHLIGHT_NAMESPACE = '@apostrophecms/schema';
const HIGHLIGHT_KEY = 'highlight';

/**
 * What the engine needs from the rest of Apostrophe. The module builds it
 * in `getDiffContext(req)`.
 *
 * @typedef {object} DiffContext
 * @property {object} [req] Passed to a field type's own `isEqual` and
 *   nothing else. May be omitted when no field type in the schema has one.
 * @property {(name: string) => object|undefined} getFieldType The schema
 *   field type definition by name (`apos.schema.fieldTypes[name]`), read
 *   for `extend`, `isEqual` and `isEmpty`.
 * @property {(type: string) => object|undefined} getWidgetManager The
 *   widget module for a widget `type` (`apos.area.getWidgetManager`), read
 *   for `schema`, `label`, `options.renderVersions` and `getRichText`.
 *   `undefined` for a type without a module.
 * @property {(doc: object, namespace: string, ...pathKeyValue: any[]) => void} setMeta
 *   `apos.doc.setMeta`, used by `annotate` to highlight top-level fields.
 * @property {(html: string) => string} htmlToPlaintext
 *   `apos.util.htmlToPlaintext`, for the text of rich text.
 */

/**
 * One hop of a row's breadcrumb, from the top-level field down to the
 * changed value.
 *
 * @typedef {object} PathSegment
 * @property {string} name The schema field name, or the `_id` of an array
 *   item or widget (`undefined` for an array item stored without one).
 *   Together the names locate the value in the document.
 * @property {string} label The field's schema `label` (its `name` when it
 *   has none); for an array item the text of its array's `titleField`, else
 *   of its `title` field, else `#n`; the widget type's `label` for a widget.
 *   Field and widget type labels may be i18n keys, as they are in the schema.
 * @property {string} [title] Widgets only, when the widget type sets the
 *   `titleField` option and that field has text: the text.
 * @property {number} [ordinal] Array items and widgets only: the 1-based
 *   position in the list the item is taken from, the newer document's
 *   unless the item was deleted.
 * @property {string} [widgetType] Widgets only: the widget `type`.
 */

/**
 * One change between the two documents.
 *
 * @typedef {object} ChangeRow
 * @property {PathSegment[]} path Breadcrumb to the changed value, the
 *   top-level field first.
 * @property {'added'|'modified'|'deleted'} type On an array item, widget or
 *   object: whether it exists on one side only. On a leaf: `added` when the
 *   older value was empty (`null`, `undefined`, `''`, `[]` or empty by the
 *   field type's `isEmpty`), `deleted` when the newer one is, `modified`
 *   otherwise.
 * @property {string} fieldType The schema type of the changed value
 *   (`string`, `integer`, `relationship`, `object`, ...), or `arrayItem`,
 *   `widget` or `richText` when the row is a whole array item, a whole
 *   widget, or the `content` of a rich text widget.
 * @property {any} old The value in the older document as stored, `undefined`
 *   when the item was added. A relationship's is its array of ids, a rich
 *   text widget's its `content` string, an item's or widget's the whole
 *   item or widget object.
 * @property {any} new The same for the newer document, `undefined` when the
 *   item was deleted.
 * @property {object|null} field The schema field of the changed value, for
 *   the text representation; `null` for a rich text or `widget` row. Attached
 *   as a non-enumerable property, so it is invisible to `JSON.stringify`
 *   and to deep equality.
 */

/**
 * Every change from `older` to `newer` as rows at their full depth, in
 * schema order, depth first. Array items and widgets match by `_id`, and
 * one present on one side only is a single row with nothing listed below
 * it, as is an object that appears or goes. Objects recurse, relationships
 * compare their stored ids and relationship fields, other leaves compare
 * with the field type's own `isEqual` when it defines one, otherwise deeply
 * with `null` and `undefined` folded together. A matched widget walks its
 * type's schema, then, for a rich text type (one with `getRichText`), its
 * markup as a `richText` row and nothing else, since the id lists such a
 * widget also stores derive from the markup; for any other type, data it
 * stores outside its schema is one `widget` row. A widget whose type has no
 * module is compared whole. `group` and
 * `relationshipReverse` fields are skipped. Neither document is modified.
 *
 * @param {object[]} schema The schema of both documents
 *   (`apos.doc.getManager(type).schema`, or a widget or array schema when
 *   diffing a fragment).
 * @param {object} older The older document as stored. `null` or
 *   `undefined` reads as an empty document.
 * @param {object} newer The newer document as stored, same schema.
 * @param {DiffContext} ctx
 * @returns {ChangeRow[]} Empty when nothing changed.
 */
function walk(schema, older, newer, ctx) {
  const rows = [];
  walkFields(schema, older || {}, newer || {}, ctx, [], rows);
  return rows;
}

/**
 * A deep copy of `newer` marked with its changes since `older`, for WYSIWYG
 * display, deepest first. The markers, on widgets only:
 *
 * - `_inserted: true` on a widget `older` does not have;
 * - `_deleted: true` on a widget `newer` does not have, which is put back
 *   into the newer area's `items` at its older position (a clone of the
 *   older widget), so it can render in place; it exists only in the
 *   returned document;
 * - `_olderVersion: <the older widget>` on a widget with changes of its own
 *   whose type sets the `renderVersions` module option;
 * - `_modified: true` on such a widget whose type does not.
 *
 * A widget whose only changes sit in widgets nested inside it gets no
 * marker; the nested widgets carry them. A change outside any widget
 * (a top-level scalar, a change inside a top-level object or array) sets
 * the `@apostrophecms/schema:highlight` meta of its top-level field, at
 * `aposMeta.<field>`, which the read-only schema view renders as
 * highlighted. Neither document is modified.
 *
 * @param {object[]} schema The schema of both documents.
 * @param {object} older The older document as stored.
 * @param {object} newer The newer document as stored, same schema.
 * @param {DiffContext} ctx
 * @param {object} [options]
 * @param {ChangeRow[]} [options.rows] The rows of a `walk` of the same
 *   documents already done, to avoid walking them again.
 * @returns {object} The annotated copy of `newer`.
 */
function annotate(schema, older, newer, ctx, { rows } = {}) {
  const doc = _.cloneDeep(newer);
  for (const row of rows || walk(schema, older, newer, ctx)) {
    const widgetAt = _.findLastIndex(row.path, segment => segment.widgetType);
    if (row.fieldType === 'widget' && row.type === 'deleted') {
      const area = resolve(doc, row.path.slice(0, -1));
      if (area?.items) {
        const at = Math.min(row.path.at(-1).ordinal - 1, area.items.length);
        area.items.splice(at, 0, {
          ..._.cloneDeep(row.old),
          _deleted: true
        });
      }
      continue;
    }
    if (row.fieldType === 'widget' && row.type === 'added') {
      const widget = resolve(doc, row.path);
      if (widget) {
        widget._inserted = true;
      }
      continue;
    }
    if (widgetAt === -1) {
      ctx.setMeta(doc, HIGHLIGHT_NAMESPACE, row.path[0].name, HIGHLIGHT_KEY, true);
      continue;
    }
    const widgetPath = row.path.slice(0, widgetAt + 1);
    const widget = resolve(doc, widgetPath);
    if (!widget || widget._modified || widget._olderVersion) {
      continue;
    }
    const manager = ctx.getWidgetManager(widget.type);
    if (manager?.options.renderVersions) {
      widget._olderVersion = _.cloneDeep(resolve(older, widgetPath));
    } else {
      widget._modified = true;
    }
  }
  return doc;
}

module.exports = {
  walk,
  annotate
};

function walkFields(schema, older, newer, ctx, path, rows) {
  for (const field of schema) {
    const kind = getKind(field, ctx);
    if (kind === 'valueless') {
      continue;
    }
    const fieldPath = [
      ...path,
      {
        name: field.name,
        label: field.label || field.name
      }
    ];
    if (kind === 'area') {
      walkArea(field, older[field.name], newer[field.name], ctx, fieldPath, rows);
    } else if (kind === 'array') {
      walkArray(field, older[field.name], newer[field.name], ctx, fieldPath, rows);
    } else if (kind === 'object') {
      walkObject(field, older[field.name], newer[field.name], ctx, fieldPath, rows);
    } else if (kind === 'relationship') {
      walkRelationship(field, older, newer, fieldPath, rows);
    } else {
      walkLeaf(field, older, newer, ctx, fieldPath, rows);
    }
  }
}

// The walk a field takes: one of the structural types, `valueless`, or
// `leaf`. A type extending a structural type walks like it
function getKind(field, ctx) {
  const seen = new Set();
  let name = field.type;
  while (name && !seen.has(name)) {
    if (STRUCTURAL.has(name)) {
      return name;
    }
    if (VALUELESS.has(name)) {
      return 'valueless';
    }
    seen.add(name);
    name = ctx.getFieldType(name)?.extend;
  }
  return 'leaf';
}

// Scalars compare with the field type's own `isEqual` when it has one,
// otherwise deeply, with `null` and `undefined` folded together, as the
// schema module compares documents
function walkLeaf(field, older, newer, ctx, path, rows) {
  const type = ctx.getFieldType(field.type);
  const oldValue = older[field.name];
  const newValue = newer[field.name];
  if (type?.isEqual) {
    if (type.isEqual(ctx.req, field, older, newer)) {
      return;
    }
  } else if (_.isEqual(oldValue, newValue)) {
    return;
  } else if ((oldValue == null) && (newValue == null)) {
    return;
  }
  const oldEmpty = isEmpty(type, field, oldValue);
  const newEmpty = isEmpty(type, field, newValue);
  rows.push(row(
    path,
    changeType(oldEmpty, newEmpty),
    field.type,
    oldValue,
    newValue,
    field
  ));
}

function walkRelationship(field, older, newer, path, rows) {
  const oldIds = older[field.idsStorage] || [];
  const newIds = newer[field.idsStorage] || [];
  const oldFields = (field.fieldsStorage && older[field.fieldsStorage]) || {};
  const newFields = (field.fieldsStorage && newer[field.fieldsStorage]) || {};
  if (_.isEqual(oldIds, newIds) && _.isEqual(oldFields, newFields)) {
    return;
  }
  rows.push(row(
    path,
    changeType(!oldIds.length, !newIds.length),
    field.type,
    oldIds,
    newIds,
    field
  ));
}

// An object that appears or goes is one row; otherwise its fields walk
function walkObject(field, older, newer, ctx, path, rows) {
  if ((older == null) && (newer == null)) {
    return;
  }
  if ((older == null) || (newer == null)) {
    rows.push(row(
      path,
      changeType(older == null, newer == null),
      field.type,
      older,
      newer,
      field
    ));
    return;
  }
  walkFields(field.schema, older, newer, ctx, path, rows);
}

// Items match by `_id`; an item on one side only is one row, a matched
// pair walks the array's schema
function walkArray(field, older, newer, ctx, path, rows) {
  for (const entry of mergeItems(older || [], newer || [])) {
    const {
      older: oldItem,
      newer: newItem,
      ordinal
    } = entry;
    const item = newItem || oldItem;
    const itemPath = [
      ...path,
      {
        name: item._id,
        label: text.getItemText(field, item, ctx) || `#${ordinal}`,
        ordinal
      }
    ];
    if (!oldItem || !newItem) {
      rows.push(row(itemPath, changeType(!oldItem, !newItem), 'arrayItem', oldItem, newItem, field));
    } else {
      walkFields(field.schema, oldItem, newItem, ctx, itemPath, rows);
    }
  }
}

// Widgets match by `_id`, like array items; a matched pair walks the
// widget type's schema, then its content outside the schema
function walkArea(field, older, newer, ctx, path, rows) {
  for (const entry of mergeItems(older?.items || [], newer?.items || [])) {
    const {
      older: oldWidget,
      newer: newWidget,
      ordinal
    } = entry;
    const widget = newWidget || oldWidget;
    const manager = ctx.getWidgetManager(widget.type);
    const title = manager?.options.titleField && text.getWidgetText(widget, ctx);
    const widgetPath = [
      ...path,
      {
        name: widget._id,
        label: manager?.label || widget.type,
        ...(title && { title }),
        ordinal,
        widgetType: widget.type
      }
    ];
    if (!oldWidget || !newWidget) {
      rows.push(row(
        widgetPath,
        changeType(!oldWidget, !newWidget),
        'widget',
        oldWidget,
        newWidget,
        field
      ));
    } else if (!manager) {
      if (!_.isEqual(oldWidget, newWidget)) {
        rows.push(
          row(widgetPath, 'modified', 'widget', oldWidget, newWidget, field)
        );
      }
    } else {
      walkWidget(manager, oldWidget, newWidget, ctx, widgetPath, rows);
    }
  }
}

// Rich text lives outside the widget schema, so it is compared on its own
// as a `richText` row at the widget's path; the rest of a rich text widget
// (the id lists sanitize derives from its markup) follows the content and
// is not compared. Any other data another widget type stores outside its
// schema is one `widget` row
function walkWidget(manager, older, newer, ctx, path, rows) {
  walkFields(manager.schema, older, newer, ctx, path, rows);
  if (manager.getRichText) {
    const oldText = manager.getRichText(older) || '';
    const newText = manager.getRichText(newer) || '';
    if (oldText !== newText) {
      rows.push(row(path, 'modified', 'richText', oldText, newText, null));
    }
    return;
  }
  const ignored = new Set(WIDGET_KEYS);
  for (const field of manager.schema) {
    ignored.add(field.name);
    if (field.idsStorage) {
      ignored.add(field.idsStorage);
    }
    if (field.fieldsStorage) {
      ignored.add(field.fieldsStorage);
    }
  }
  const isContent = key => !ignored.has(key) && !key.startsWith('_');
  const oldRest = _.pickBy(older, (value, key) => isContent(key));
  const newRest = _.pickBy(newer, (value, key) => isContent(key));
  if (!_.isEqual(oldRest, newRest)) {
    rows.push(row(path, 'modified', 'widget', older, newer, null));
  }
}

// The two item lists as one sequence of `{ older, newer, ordinal }`, in the
// newer order, each deleted item placed after the item that preceded it in
// the older list. `ordinal` is the item's 1-based position in the list it
// is taken from. Items without an `_id` match by position
function mergeItems(olderItems, newerItems) {
  const keyOf = (item, index) => item?._id ?? `#${index}`;
  const merged = newerItems.map((item, index) => ({
    key: keyOf(item, index),
    older: undefined,
    newer: item,
    ordinal: index + 1
  }));
  let insertAt = 0;
  olderItems.forEach((item, index) => {
    const key = keyOf(item, index);
    const found = merged.findIndex(entry => entry.key === key);
    if (found === -1) {
      merged.splice(insertAt, 0, {
        key,
        older: item,
        newer: undefined,
        ordinal: index + 1
      });
      insertAt++;
    } else {
      merged[found].older = item;
      insertAt = found + 1;
    }
  });
  return merged;
}

function row(path, type, fieldType, oldValue, newValue, field) {
  const result = {
    path,
    type,
    fieldType,
    old: oldValue,
    new: newValue
  };
  Object.defineProperty(result, 'field', {
    value: field,
    enumerable: false
  });
  return result;
}

function changeType(oldEmpty, newEmpty) {
  if (oldEmpty && !newEmpty) {
    return 'added';
  }
  if (newEmpty && !oldEmpty) {
    return 'deleted';
  }
  return 'modified';
}

// Empty as the field type sees it, so that a value appearing in an empty
// field reads as added rather than modified
function isEmpty(type, field, value) {
  if ((value == null) || (value === '') || (Array.isArray(value) && !value.length)) {
    return true;
  }
  return type?.isEmpty ? Boolean(type.isEmpty(field, value)) : false;
}

// The value at `path` in `doc`: a field segment reads a property, an item
// or widget segment finds the `_id` in the array or area at that point
function resolve(doc, path) {
  let node = doc;
  for (const segment of path) {
    if (node == null) {
      return undefined;
    }
    if (Array.isArray(node)) {
      node = node.find(item => item._id === segment.name);
    } else if (node.metaType === 'area') {
      node = (node.items || []).find(item => item._id === segment.name);
    } else {
      node = node[segment.name];
    }
  }
  return node;
}
