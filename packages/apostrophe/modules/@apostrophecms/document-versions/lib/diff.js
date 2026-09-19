// Change detection between two versions of a document: pure functions over
// a schema and two documents. `walk` lists every changed path at its full
// depth, `annotate` marks a copy of the newer document for WYSIWYG display,
// `consolidate` lists the changes of a run of consecutive versions as one.
// All take a `ctx` built by the module (`getDiffContext`) so that nothing
// here reaches for `apos` directly.

const _ = require('lodash');
const { diffArrays } = require('diff');
const text = require('./text.js');
const diffRichText = require('./rich-text-diff.js');

// Field types with their own walk, reached through `extend` as well
const STRUCTURAL = new Set([ 'area', 'array', 'object', 'relationship' ]);
// Leaf field types `annotate` marks, reached through `extend` as well
const MARKED = new Set([ 'richText' ]);
// Field types that store nothing
const VALUELESS = new Set([ 'group', 'relationshipReverse' ]);
// Widget keys that are bookkeeping, not content
const WIDGET_KEYS = new Set([ '_id', 'type', 'metaType', 'aposPlaceholder', 'aposMeta' ]);

const HIGHLIGHT_NAMESPACE = '@apostrophecms/schema';
const HIGHLIGHT_KEY = 'highlight';
const AI_NAMESPACE = '@apostrophecms/document-versions';
const AI_KEY = 'ai';
// The hop below a widget where its rich text markup, or the data it stores
// outside its schema, sits when paths are compared
const CONTENT = Symbol('content');
// The hop below an array or area where the order of its items sits
const ORDER = Symbol('order');

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
 * @property {(key: string, options?: object) => string} [t] A label or a
 *   phrase in the language of the admin UI, `options` being its
 *   interpolation values. Labels stay as they are when omitted, and rich
 *   text rows get no `formatChanges`.
 * @property {() => object[]} [getRichTextStyles] The `styles` rich text is
 *   configured with by default, `{ tag, class, label }` each, for the names
 *   of blocks and inline styles.
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
 * One side of a formatting change, as shown.
 *
 * @typedef {object} FormatValue
 * @property {string} text The value in the language of the admin UI; the
 *   title of an image.
 * @property {string} [href] Images only: the URL of the image, when it can
 *   be opened.
 */

/**
 * One formatting change of rich text, for display.
 *
 * @typedef {object} FormatLine
 * @property {string} change The `kind` of the record it shows.
 * @property {'added'|'modified'|'deleted'} type
 * @property {string} label What changed: "Link", "Alignment", "Image".
 * @property {string} [text] The words affected, on one line, cut short; the
 *   title of the image when it is an image's alt text, style or link.
 * @property {string} [href] With such a title: the URL of the image, when
 *   it can be opened.
 * @property {FormatValue} [old] The older value. With `new`, one of them
 *   missing when `type` is `added` or `deleted`; both missing when the
 *   change has no values to compare (a table's layout, merged paragraphs).
 * @property {FormatValue} [new]
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
 * @property {string} fieldType The schema type of the changed value as
 *   the schema declares it, a project's own type included (`string`,
 *   `integer`, `relationship`, `object`, ...), or `arrayItem`, `widget` or
 *   `richText` when the row is a whole array item, a whole widget, or the
 *   `content` of a rich text widget. The row of the order of an array's or
 *   area's items has the type of that array or area.
 * @property {'leaf'|'richText'|'object'|'relationship'|'array'|'area'|
 *   'arrayItem'|'widget'} kind
 *   What the row is, whatever its type is called: the core type `fieldType`
 *   is or extends when that is `richText`, `object` or `relationship`, and
 *   `leaf` for any other field; `array` or `area` for the order of the
 *   items of one, at the path of the array or area itself; `arrayItem`,
 *   `widget` and `richText` as `fieldType` has them. The one to test.
 * @property {any} old The value in the older document as stored, `undefined`
 *   when the item was added. A relationship's is its array of ids, a rich
 *   text widget's its `content` string, an item's or widget's the whole
 *   item or widget object, an order row's the `_id`s of the items both
 *   documents have, in the older order.
 * @property {any} new The same for the newer document, `undefined` when the
 *   item was deleted.
 * @property {object|null} field The schema field of the changed value, for
 *   the text representation; `null` for a rich text or `widget` row. Attached
 *   as a non-enumerable property, so it is invisible to `JSON.stringify`
 *   and to deep equality.
 * @property {Object<string, { ordinal: number, label?: string, title?: string }>} [items]
 *   Order rows only, for the text representation: by `_id`, each item's
 *   position in the newer document, its widget type's `label` and its
 *   title. Non-enumerable, like `field`.
 * @property {string[]} [movedItems] Order rows of `consolidate` flagged
 *   `ai` in a run that mixes versions saved with and without AI, when the
 *   moves of its versions explain the new order: the `_id`s of the items
 *   they moved. Non-enumerable, like `aiItems`, which comes with it: those
 *   a version saved with AI moved.
 * @property {Set<string>} [aiItems]
 * @property {import('./rich-text-format.js').FormatChange[]} [format]
 *   Modified rich text rows, once `addFormat` of `lib/text.js` ran and found
 *   some: the formatting that changed. Non-enumerable, like `field`.
 * @property {FormatLine[]} [formatChanges] The same for display, in the
 *   language of the admin UI, set by `addText`.
 * @property {boolean} [ai] Rows of `consolidate` only: whether a version
 *   saved with AI changed this path, or one above or below it; for an
 *   order row, whether one changed that order.
 */

/**
 * Every change from `older` to `newer` as rows at their full depth, in
 * schema order, depth first. Array items and widgets match by `_id`, and
 * one present on one side only is a single row with nothing listed below
 * it, as is an object that appears or goes. An array or area whose items
 * changed places is one `modified` row of its own, ahead of the rows of its
 * items: only the relative order of the items both documents have counts,
 * so an item added or deleted in the middle moves nothing. Objects recurse,
 * relationships compare their stored ids and relationship fields, other leaves compare
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
 *   whose type sets the `renderVersions` module option. When that type is
 *   a rich text one and its markup changed, the copy's `content` is that
 *   markup with the text that changed marked in it (see
 *   `lib/rich-text-diff.js`), so that any template shows it; `content`
 *   stays as it is when no text changed or the change cannot be shown,
 *   and the widget reads as modified;
 * - `_modified: true` on such a widget whose type does not;
 * - `_moved: true` on a widget that changed places among the widgets of
 *   its area both documents have, beside any marker above. Of the widgets
 *   of an area whose order changed, only the fewest that account for the
 *   new order are marked: one widget dragged to the top is one `_moved`,
 *   not one for every widget it passed.
 *
 * Rows flagged `ai` (those of `consolidate`) say so on what they mark:
 * `_changedWithAi: true` beside `_inserted`, `_deleted`, `_modified` or
 * `_olderVersion`, when any row behind that marker is flagged;
 * `_movedWithAi: true` beside `_moved`, when the order row is and, in a
 * run of versions whose own moves explain the new order, a version saved
 * with AI moved that widget; the
 * `@apostrophecms/document-versions:ai` meta beside a field's highlight.
 *
 * A widget whose only changes sit in widgets nested inside it gets no
 * marker; the nested widgets carry them. A change outside any widget
 * (a top-level scalar, a change inside a top-level object or array, the
 * order of an array's items) sets the `@apostrophecms/schema:highlight`
 * meta of its top-level field, at `aposMeta.<field>`, which the read-only
 * schema view renders as highlighted. Neither document is modified.
 *
 * @param {object[]} schema The schema of both documents.
 * @param {object} older The older document as stored.
 * @param {object} newer The newer document as stored, same schema.
 * @param {DiffContext} ctx
 * @param {object} [options]
 * @param {ChangeRow[]} [options.rows] The rows of a `walk` of the same
 *   documents already done, to avoid walking them again, or those of a
 *   `consolidate` ending in them, for the AI markers.
 * @returns {object} The annotated copy of `newer`.
 */
function annotate(schema, older, newer, ctx, { rows } = {}) {
  const doc = _.cloneDeep(newer);
  for (const row of rows || walk(schema, older, newer, ctx)) {
    if (row.kind === 'area') {
      for (const id of row.movedItems || getMovedIds(row)) {
        const widget = resolve(doc, [ ...row.path, { name: id } ]);
        if (widget) {
          widget._moved = true;
          if (row.aiItems ? row.aiItems.has(id) : row.ai) {
            widget._movedWithAi = true;
          }
        }
      }
      continue;
    }
    const widgetAt = _.findLastIndex(row.path, segment => segment.widgetType);
    if (row.kind === 'widget' && row.type === 'deleted') {
      const area = resolve(doc, row.path.slice(0, -1));
      if (area?.items) {
        const at = Math.min(row.path.at(-1).ordinal - 1, area.items.length);
        area.items.splice(at, 0, {
          ..._.cloneDeep(row.old),
          _deleted: true,
          ...(row.ai && { _changedWithAi: true })
        });
      }
      continue;
    }
    if (row.kind === 'widget' && row.type === 'added') {
      const widget = resolve(doc, row.path);
      if (widget) {
        widget._inserted = true;
        if (row.ai) {
          widget._changedWithAi = true;
        }
      }
      continue;
    }
    if (widgetAt === -1) {
      if (row.kind === 'richText') {
        markRichTextField(doc, row, ctx);
      }
      ctx.setMeta(doc, HIGHLIGHT_NAMESPACE, row.path[0].name, HIGHLIGHT_KEY, true);
      if (row.ai) {
        ctx.setMeta(doc, AI_NAMESPACE, row.path[0].name, AI_KEY, true);
      }
      continue;
    }
    const widgetPath = row.path.slice(0, widgetAt + 1);
    const widget = resolve(doc, widgetPath);
    if (!widget) {
      continue;
    }
    if (row.ai) {
      widget._changedWithAi = true;
    }
    const manager = ctx.getWidgetManager(widget.type);
    if ((row.kind === 'richText') && manager?.options.renderVersions) {
      markRichText(widget, row, ctx);
    }
    if (widget._modified || widget._olderVersion) {
      continue;
    }
    if (manager?.options.renderVersions) {
      widget._olderVersion = _.cloneDeep(resolve(older, widgetPath));
    } else {
      widget._modified = true;
    }
  }
  return doc;
}

/**
 * The changes of consecutive versions of one document as a single list:
 * one `walk` from the first member's older document to the last member's
 * newer one. So each changed path appears once, with the value it started
 * from and the value it ended with; a path deleted at the end reads as
 * deleted whatever happened to it before; a path added and deleted within
 * the run does not appear, and neither does one that ended where it
 * started. Every row gains `ai`: `true` when a member saved with AI changed
 * that path, one above it (which created the value) or one below it (which
 * is part of the final value). The order of an array or area stands apart
 * from its items: its row is flagged when a member saved with AI changed
 * that order, and flags no other row. One pair is a single version and
 * every row takes its flag.
 *
 * @param {object[]} schema The schema of the documents.
 * @param {Array<{ older: object, newer: object, ai?: boolean }>} pairs
 *   The members, oldest first, at least one: each member's document as
 *   `newer`, the document it changed as `older` (the previous member's
 *   `newer`, or for the first member the version before the run) and
 *   whether the member was saved with AI.
 * @param {DiffContext} ctx
 * @returns {ChangeRow[]} Empty when the run ends where it started.
 */
function consolidate(schema, pairs, ctx) {
  const rows = walk(schema, pairs[0].older, pairs.at(-1).newer, ctx);
  const aiPairs = pairs.filter(pair => pair.ai);
  if (!aiPairs.length || (aiPairs.length === pairs.length)) {
    for (const row of rows) {
      row.ai = Boolean(aiPairs.length);
    }
    return rows;
  }
  const walkOf = pair => walk(schema, pair.older, pair.newer, ctx);
  const aiRows = aiPairs.flatMap(walkOf);
  const touched = aiRows.map(keyOf);
  for (const row of rows) {
    const key = keyOf(row);
    row.ai = touched.some(other => isRelated(key, other));
  }
  const orders = rows.filter(row => row.ai && isOrder(row));
  if (orders.length) {
    const otherRows = pairs.filter(pair => !pair.ai).flatMap(walkOf);
    for (const row of orders) {
      explainOrder(row, aiRows, otherRows);
    }
  }
  return rows;
}

module.exports = {
  walk,
  annotate,
  consolidate
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
      walkLeaf(field, kind, older, newer, ctx, fieldPath, rows);
    }
  }
}

// The walk a field takes: one of the structural types, `valueless`, or
// `leaf`, except that a `richText` field is `richText`. A type extending
// one of those is taken for it
function getKind(field, ctx) {
  const seen = new Set();
  let name = field.type;
  while (name && !seen.has(name)) {
    if (STRUCTURAL.has(name) || MARKED.has(name)) {
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
function walkLeaf(field, kind, older, newer, ctx, path, rows) {
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
    kind,
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
    'relationship',
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
      'object',
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
  const entries = mergeItems(older || [], newer || []);
  walkOrder('array', field, entries, path, rows, (item, ordinal) => ({
    ordinal,
    title: text.getItemText(field, item, ctx)
  }));
  for (const entry of entries) {
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
      rows.push(row(
        itemPath,
        changeType(!oldItem, !newItem),
        'arrayItem',
        'arrayItem',
        oldItem,
        newItem,
        field
      ));
    } else {
      walkFields(field.schema, oldItem, newItem, ctx, itemPath, rows);
    }
  }
}

// Widgets match by `_id`, like array items; a matched pair walks the
// widget type's schema, then its content outside the schema
function walkArea(field, older, newer, ctx, path, rows) {
  const entries = mergeItems(older?.items || [], newer?.items || []);
  walkOrder('area', field, entries, path, rows, (widget, ordinal) => {
    const manager = ctx.getWidgetManager(widget.type);
    return {
      ordinal,
      label: manager?.label || widget.type,
      title: manager?.options.titleField && text.getWidgetText(widget, ctx)
    };
  });
  for (const entry of entries) {
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
        'widget',
        oldWidget,
        newWidget,
        field
      ));
    } else if (!manager) {
      if (!_.isEqual(oldWidget, newWidget)) {
        rows.push(
          row(widgetPath, 'modified', 'widget', 'widget', oldWidget, newWidget, field)
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
      rows.push(row(path, 'modified', 'richText', 'richText', oldText, newText, null));
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
    rows.push(row(path, 'modified', 'widget', 'widget', older, newer, null));
  }
}

// The markup of a rich text widget of the annotated document, with the
// text its row says changed marked in it
function markRichText(widget, row, ctx) {
  if (widget.content !== row.new) {
    return;
  }
  const content = getMarkedRichText(row, ctx);
  if (content != null) {
    widget.content = content;
  }
}

// The same for a `richText` field outside any widget
function markRichTextField(doc, row, ctx) {
  const parent = resolve(doc, row.path.slice(0, -1));
  const name = row.path.at(-1).name;
  if (!parent || ((parent[name] ?? null) !== (row.new ?? null))) {
    return;
  }
  const content = getMarkedRichText(row, ctx);
  if (content != null) {
    parent[name] = content;
  }
}

function getMarkedRichText(row, ctx) {
  return diffRichText(row.old || '', row.new || '', {
    labels: {
      removed: ctx.t?.('apostrophe:versionRemovedText'),
      added: ctx.t?.('apostrophe:versionAddedText')
    }
  });
}

// The order of an array's or area's items, one `modified` row at the
// container itself when the items both sides have stand in a different
// relative order. Items without an `_id` match by position and never move.
// `describe(item, ordinal)` is what the text of the row says of an item
function walkOrder(kind, field, entries, path, rows, describe) {
  const matched = entries.filter(entry => entry.older?._id && entry.newer);
  const newIds = matched.map(entry => entry.newer._id);
  const oldIds = _.sortBy(matched, 'olderOrdinal').map(entry => entry.older._id);
  if (_.isEqual(oldIds, newIds)) {
    return;
  }
  const result = row(path, 'modified', field.type, kind, oldIds, newIds, field);
  Object.defineProperty(result, 'items', {
    value: Object.fromEntries(matched.map(entry => [
      entry.newer._id,
      describe(entry.newer, entry.ordinal)
    ])),
    enumerable: false
  });
  rows.push(result);
}

// The two item lists as one sequence of `{ older, newer, ordinal }`, in the
// newer order, each deleted item placed after the item that preceded it in
// the older list. `ordinal` is the item's 1-based position in the list it
// is taken from, `olderOrdinal` the one in the older list when it is there.
// Items without an `_id` match by position
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
        ordinal: index + 1,
        olderOrdinal: index + 1
      });
      insertAt++;
    } else {
      merged[found].older = item;
      merged[found].olderOrdinal = index + 1;
      insertAt = found + 1;
    }
  });
  return merged;
}

function row(path, type, fieldType, kind, oldValue, newValue, field) {
  const result = {
    path,
    type,
    fieldType,
    kind,
    old: oldValue,
    new: newValue
  };
  Object.defineProperty(result, 'field', {
    value: field,
    enumerable: false
  });
  return result;
}

// The items of an order row that changed places: the fewest whose move
// accounts for the newer order
function getMovedIds(row) {
  return diffArrays(row.old, row.new)
    .filter(part => part.added)
    .flatMap(part => part.value);
}

// Which items moved has more than one true answer (a reversal of three is
// any two of them), so between a run's ends the fewest-moves answer may
// name items no version touched. The versions' own moves are the better
// answer when they hold: taken out of both lists, the rest stands in one
// order. Sets `movedItems` and `aiItems` on `row` then; otherwise `row`
// stays as it is and every moved item takes the row's AI flag
function explainOrder(row, aiRows, otherRows) {
  const key = keyOf(row);
  const movedIn = rows => rows
    .filter(other => isOrder(other) && _.isEqual(keyOf(other), key))
    .flatMap(getMovedIds)
    .filter(id => row.new.includes(id));
  const byAi = new Set(movedIn(aiRows));
  const holds = moved => _.isEqual(
    row.old.filter(id => !moved.has(id)),
    row.new.filter(id => !moved.has(id))
  );
  const moved = new Set([ ...movedIn(otherRows), ...byAi ]);
  if (!holds(moved)) {
    return;
  }
  // An item moved and moved back explains nothing
  for (const id of [ ...moved ]) {
    moved.delete(id);
    if (!holds(moved)) {
      moved.add(id);
    }
  }
  Object.defineProperties(row, {
    movedItems: {
      value: row.new.filter(id => moved.has(id)),
      enumerable: false
    },
    aiItems: {
      value: new Set([ ...moved ].filter(id => byAi.has(id))),
      enumerable: false
    }
  });
}

// Whether a row is the order of an array's or area's items
function isOrder(row) {
  return (row.kind === 'array') || (row.kind === 'area');
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

// The names along a row's path, the key two rows compare by. A rich text
// widget's markup and the data a widget stores outside its schema sit one
// hop below the widget, apart from its schema fields, and so does the
// order of an array or area, apart from its items
function keyOf(row) {
  const key = row.path.map(segment => segment.name);
  if (isOrder(row)) {
    key.push(ORDER);
  } else if (
    (row.kind === 'richText') ||
    ((row.kind === 'widget') && (row.type === 'modified'))
  ) {
    key.push(CONTENT);
  }
  return key;
}

// Whether one key is the other or an ancestor of it. An order relates to
// the same order only, whatever happened above it
function isRelated(one, two) {
  if ((one.at(-1) === ORDER) || (two.at(-1) === ORDER)) {
    return _.isEqual(one, two);
  }
  const length = Math.min(one.length, two.length);
  for (let i = 0; i < length; i++) {
    if (one[i] !== two[i]) {
      return false;
    }
  }
  return true;
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
