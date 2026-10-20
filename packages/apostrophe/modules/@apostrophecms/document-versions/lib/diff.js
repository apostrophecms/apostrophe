// Change detection between two versions of a document: pure functions over
// a schema and two documents. `walk` lists every changed path at its full
// depth, `annotate` marks a copy of the newer document for WYSIWYG display,
// `consolidate` lists the changes of consecutive versions as one.
// All take a `ctx` built by the module (`getDiffContext`) so that nothing
// here reaches for `apos` directly.

const _ = require('lodash');
const { diffArrays } = require('diff');
const text = require('./text.js');
const { diffRichText } = require('./rich-text-diff.js');
const findBaseType = require('./field-kind.js');

// Field types with their own walk, reached through `extend` as well
const STRUCTURAL = new Set([ 'area', 'array', 'object', 'relationship' ]);
// Leaf field types `annotate` marks, reached through `extend` as well
const MARKED = new Set([ 'richText' ]);
// Field types that store nothing
const VALUELESS = new Set([ 'group', 'relationshipReverse' ]);
const KNOWN = new Set([ ...STRUCTURAL, ...MARKED, ...VALUELESS ]);
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
 *   for `schema`, `label`, `options.versionsRender`,
 *   `options.versionsStandalone` (and its older name
 *   `options.versionsRenderDeleted`) and `getRichText`.
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
 * @property {(options: object) => Object<string, object>} [getAreaWidgets]
 *   The widget types an area field's `options` allow, with the options of
 *   each, groups included (`apos.area.getWidgets`). Read by `addFieldData`
 *   and `addRestore`.
 * @property {(err: Error, path: PathSegment[]) => void} [onError] Told of
 *   every failure the engine recovered from, with the path of the field or
 *   row it happened at. The module logs them.
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
 * @property {string} [url] Internal links only: the URL of the document
 *   linked to, whose title is `text`, when it can be opened.
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
 * @property {string} fieldType The type of the changed value as the schema
 *   names it, a project's own type included (`string`, `relationship`,
 *   `tagline`, ...). `arrayItem` or `widget` for a whole item or widget,
 *   `richText` for the `content` of a rich text widget. An order row has
 *   the type of its array or area.
 * @property {'leaf'|'richText'|'object'|'relationship'|'array'|'area'|
 *   'arrayItem'|'widget'} kind
 *   What the row is, whatever its type is called, and the one to test.
 *   `richText`, `object` or `relationship` for a field whose type is or
 *   extends one of them, `leaf` for any other field; `array` or `area` for
 *   an order row; `arrayItem` and `widget` as `fieldType` has them.
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
 * @property {Object<string, {
 *   ordinal: number,
 *   olderOrdinal: number,
 *   label?: string,
 *   title?: string
 * }>} [items]
 *   Order rows only, for the text representation: by `_id`, each item's
 *   position in the newer document and in the older one, its widget type's
 *   `label` and its title. Non-enumerable, like `field`.
 * @property {string[]} [movedItems] Order rows of `consolidate` only, when
 *   the moves of its versions explain the new order (see `explainOrder`):
 *   the `_id`s of the items they moved. Non-enumerable, like `field`.
 * @property {Map<string, 'changed'|'assisted'>} [aiItems] Comes with
 *   `movedItems`: AI's part in moving each of them that AI moved, as `ai`
 *   reads for a row, by `_id`.
 * @property {import('./rich-text-format.js').FormatChange[]} [format]
 *   Modified rich text rows, once `addFormat` of `lib/text.js` ran and found
 *   some: the formatting that changed. Non-enumerable, like `field`.
 * @property {FormatLine[]} [formatChanges] The same for display, in the
 *   language of the admin UI, set by `addText`.
 * @property {ChangeRow[]} [fieldRows] Array items added or deleted whole,
 *   once `addItemFields` ran: the rows of its fields; in a change list,
 *   those with text to show.
 * @property {{ old?: object[], new?: object[] }} [images] Relationship rows
 *   whose ids changed, set by `addText`: the related images of each side,
 *   `{ text, href, change }` each.
 * @property {false|'changed'|'assisted'} [ai] Rows of `consolidate` only:
 *   AI's part in the change. `changed` when the last version to change this
 *   path, one above it or one below it was saved with AI; `assisted` when it
 *   was saved without, after AI changed the path; `false` when AI never did.
 *   For an order row, the same of the versions that changed that order.
 * @property {Array<{ _id: string|null, title: string }>} [authors] Rows of
 *   `attribute` only: everyone whose version changed this path, oldest
 *   first, each once. Empty when no version explains the change.
 * @property {Date} [changedAt] Rows of `attribute` only: when the newest of
 *   those versions changed it, when one of them has a time.
 * @property {string} [patchKey] Rows of `addFieldData` only: where a PATCH
 *   of the document sets this value. The field names from the top level,
 *   dotted; below an array item, a widget or an object whose `_id` the
 *   document holds exactly once, the deepest of them, `@<its _id>.` and the
 *   field names from there. `@<_id>` alone for a whole item or widget,
 *   `@<_id>.content` for the markup of a rich text widget; the array itself
 *   for the order of an array. None for the order of an area, nor where no
 *   `_id` reaches the value without ambiguity.
 * @property {string} [fieldId] Rows of `addFieldData` only: the `_id` of the
 *   schema field the row belongs to; for a whole item or widget, or the
 *   markup of a rich text widget, the array or area holding it.
 * @property {string} [widgetType] Rows of `addFieldData` only, for a whole
 *   widget and the markup of a rich text widget: the widget `type`.
 * @property {object} [widgetOptions] With `widgetType`: the options the area
 *   holding the widget gives its type.
 * @property {object} [contextual] Rows of `addFieldData` only, for a row a
 *   contextual widget's own editor edits on the page: the widget itself and
 *   its fields other than its styles, the nearest widget along the path
 *   being contextual. That widget's `{ patchKey, widgetType, widgetOptions }`:
 *   its `@<_id>`, its `type` and the options its area gives it; none when
 *   its `_id` is not in the document exactly once.
 * @property {string|null} [markedHtml] Rows of `addFieldData` only, for a
 *   `richText` field: the newer markup with the changed text marked (see
 *   `lib/rich-text-diff.js`), `null` when the change cannot be shown that
 *   way.
 * @property {string} [listKey] Rows of `addFieldData` only, for a whole item
 *   or widget that was added or deleted: where a PATCH of the document finds
 *   the list it is in. `@<area _id>.items` for a widget, the area editor's
 *   own form; the array's key, as `patchKey` has it, for an array item.
 * @property {true} [system] An item or widget whose only change is in
 *   fields the system manages, which no editor shows (`hidden` fields, a
 *   widget type's own `utility` fields): modified, with no detail, never
 *   edited nor restored. Such fields are no rows of their own.
 * @property {true} [editable] Rows of `addRestore` only: the request may
 *   change the value at `patchKey`, for the order of an array the whole
 *   array, no field along the path being read only
 *   or beyond its permissions and no widget along it of a type its area
 *   does not allow.
 * @property {{ patch: object, inverse: object }} [restore] Rows of
 *   `addRestore` only: the PATCH that puts the older value back, and the
 *   one that takes that back again. None where a patch cannot do it exactly.
 */

/**
 * Every change from `older` to `newer` as rows at their full depth, in
 * schema order, depth first. Neither document is modified.
 *
 * - Array items and widgets match by `_id`. One that exists on one side
 *   only is a single row, with nothing listed below it; so is an object
 *   that appears or goes.
 * - An array or area whose items changed places is one `modified` row of
 *   its own, ahead of the rows of its items. Only the relative order of the
 *   items both documents have counts, so an added or deleted item moves
 *   nothing.
 * - Objects recurse. Relationships compare their stored ids and fields.
 *   Any other value compares with its field type's `isEqual` when it has
 *   one, otherwise deeply, `null` and `undefined` being the same.
 * - A matched widget walks its type's schema. A rich text widget (a type
 *   with `getRichText`) then compares its markup as one `richText` row and
 *   nothing else, since the id lists it stores derive from the markup. Any
 *   other widget compares the data it stores outside its schema as one
 *   `widget` row. A widget whose type has no module is compared whole.
 * - `group` and `relationshipReverse` fields store nothing and are skipped.
 *
 * Never throws over what the documents hold. A value that is not of its
 * field's kind (one stored under an earlier schema, or by a type extending
 * `array`, `area` or `object` with a shape of its own) compares whole, as
 * one `leaf` row. So does a field whose walk fails, in project code such as
 * a type's `isEqual` included; `ctx.onError` is told, and the rest of the
 * document keeps its full depth.
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
 * A deep copy of `newer` marked with its changes since `older`, for display
 * in place. Neither document is modified.
 *
 * Widgets carry the markers:
 *
 * - `_inserted: true` on a widget `older` does not have.
 * - `_deleted: true` on a widget `newer` does not have. A clone of it is
 *   put back into the area at its older position, so it can render in
 *   place; it exists in the returned document only. A widget whose type
 *   does not stand alone (the `versionsStandalone` option) is not put back:
 *   the widget holding it is marked as changed instead, or, in a top-level
 *   area, the field is highlighted.
 * - `_olderVersion: <the older widget>` on a changed widget whose type sets
 *   the `versionsRender` option, so its template can compare the two. For
 *   a rich text type the copy's `content` also becomes its markup with the
 *   changed text marked (see `lib/rich-text-diff.js`), unless no text
 *   changed or the change cannot be shown that way.
 * - `_modified: true` on a changed widget of any other type.
 * - `_moved: true` on a widget that changed places in its area, beside any
 *   marker above. Only the fewest widgets that explain the new order are
 *   marked: one widget dragged to the top is one `_moved`, not one for
 *   every widget it passed.
 *
 * A widget whose only changes are in widgets nested inside it gets no
 * marker; the nested widgets carry them.
 *
 * A change outside any widget sets the `@apostrophecms/schema:highlight`
 * meta of its top-level field (`aposMeta.<field>`), which the read-only
 * schema view shows as highlighted.
 *
 * Rows with an `ai` part (see `consolidate`) add `_changedWithAi` beside
 * `_inserted`, `_deleted`, `_modified` or `_olderVersion`, `_movedWithAi`
 * beside `_moved`, and the `@apostrophecms/document-versions:ai` meta
 * beside a field's highlight, each set to that part. Where several rows
 * meet, `changed` wins over `assisted`.
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
          setAi(widget, '_movedWithAi', row.aiItems ? row.aiItems.get(id) : row.ai);
        }
      }
      continue;
    }
    let widgetAt = _.findLastIndex(row.path, segment => segment.widgetType);
    if (row.kind === 'widget' && row.type === 'deleted') {
      if (isStandalone(row.path.at(-1).widgetType, ctx)) {
        const area = resolve(doc, row.path.slice(0, -1));
        if (area?.items) {
          // Positions count the widgets of the types the site has
          const known = knownWidgets(area, ctx);
          const index = row.path.at(-1).ordinal - 1;
          const at = (index < known.length)
            ? area.items.indexOf(known[index])
            : area.items.length;
          area.items.splice(at, 0, {
            ..._.cloneDeep(row.old),
            _deleted: true,
            ...(row.ai && { _changedWithAi: row.ai })
          });
        }
        continue;
      }
      // Marked on the widget holding it, or on its top-level field
      widgetAt = _.findLastIndex(row.path.slice(0, -1), segment => segment.widgetType);
    }
    if (row.kind === 'widget' && row.type === 'added') {
      const widget = resolve(doc, row.path);
      if (widget) {
        widget._inserted = true;
        setAi(widget, '_changedWithAi', row.ai);
      }
      continue;
    }
    if (widgetAt === -1) {
      if (row.kind === 'richText') {
        markRichTextField(doc, row, ctx);
      }
      ctx.setMeta(doc, HIGHLIGHT_NAMESPACE, row.path[0].name, HIGHLIGHT_KEY, true);
      const marked = doc.aposMeta?.[row.path[0].name]?.[`${AI_NAMESPACE}:${AI_KEY}`];
      const ai = getStrongerAi(marked, row.ai);
      if (ai) {
        ctx.setMeta(doc, AI_NAMESPACE, row.path[0].name, AI_KEY, ai);
      }
      continue;
    }
    const widgetPath = row.path.slice(0, widgetAt + 1);
    const widget = resolve(doc, widgetPath);
    if (!widget) {
      continue;
    }
    setAi(widget, '_changedWithAi', row.ai);
    const manager = ctx.getWidgetManager(widget.type);
    if ((row.kind === 'richText') && manager?.options.versionsRender) {
      markRichText(widget, row, ctx);
    }
    if (widget._modified || widget._olderVersion) {
      continue;
    }
    if (manager?.options.versionsRender) {
      widget._olderVersion = _.cloneDeep(resolve(older, widgetPath));
    } else {
      widget._modified = true;
    }
  }
  return doc;

  function setAi(widget, key, ai) {
    const stronger = getStrongerAi(widget[key], ai);
    if (stronger) {
      widget[key] = stronger;
    }
  }
}

/**
 * The changes of consecutive versions of one document as a single list:
 * one `walk` from the document before the first version to the last
 * version. Each changed path appears once, from the value it started with
 * to the value it ended with. A path that ended where it started, or was
 * added and deleted along the way, does not appear.
 *
 * Every row gains `ai`, AI's part in it: `changed` when the last version
 * that changed that path, one above it or one below it was saved with AI;
 * `assisted` when that version was saved without AI but an earlier one, or
 * a row of `before`, changed a related path with AI; `false` otherwise. The
 * order of an array or area is apart from its items: its row is related to
 * the versions that changed the order, and to no other row. With one pair
 * and no `before`, every row takes that pair's flag.
 *
 * @param {object[]} schema The schema of the documents.
 * @param {Array<{ older: object, newer: object, ai?: boolean }>} pairs
 *   The versions, oldest first, at least one: each version's document as
 *   `newer`, the document it changed as `older` (the previous version's
 *   `newer`, or for the first one the version before them) and whether the
 *   version was saved with AI.
 * @param {DiffContext} ctx
 * @param {object} [options]
 * @param {ChangeRow[]} [options.before] Rows AI changed before the versions,
 *   which make a later change without AI `assisted`.
 * @returns {ChangeRow[]} Empty when the versions end where they started.
 */
function consolidate(schema, pairs, ctx, { before = [] } = {}) {
  const rows = walk(schema, pairs[0].older, pairs.at(-1).newer, ctx);
  const withAi = pairs.filter(pair => pair.ai).length;
  if ((withAi === pairs.length) || (!withAi && !before.length)) {
    for (const row of rows) {
      row.ai = withAi ? 'changed' : false;
    }
    return rows;
  }
  // Every version's own rows, oldest first
  const edits = pairs.map(pair => {
    const editRows = (pairs.length === 1)
      ? rows
      : walk(schema, pair.older, pair.newer, ctx);
    return {
      ai: Boolean(pair.ai),
      rows: editRows,
      keys: editRows.map(keyOf)
    };
  });
  const earlier = before.map(keyOf);
  for (const row of rows) {
    const key = keyOf(row);
    const related = keys => keys.some(other => isRelated(key, other));
    const touching = edits.filter(edit => related(edit.keys));
    row.ai = getAi(touching, related(earlier));
  }
  for (const row of rows) {
    if (row.ai && isOrder(row)) {
      explainOrder(row, edits, before);
    }
  }
  return rows;
}

/**
 * Credits the rows of a `consolidate` of `pairs` to the versions that made
 * them: sets `authors` and `changedAt` on every row. A version changed a
 * row when one of its own changes is at the row's path, above it or below
 * it, as `consolidate` relates them for `ai`. Rows are modified in place.
 *
 * @param {object[]} schema The schema of the documents.
 * @param {Array<{
 *   older: object,
 *   newer: object,
 *   author?: { _id: string|null, title: string },
 *   changedAt?: Date
 * }>} pairs The pairs the rows consolidate, oldest first, each with who
 *   saved its `newer` and when. A pair without an `author` credits no one.
 * @param {ChangeRow[]} rows
 * @param {DiffContext} ctx
 * @returns {ChangeRow[]} `rows`.
 */
function attribute(schema, pairs, rows, ctx) {
  const edits = pairs.map(pair => ({
    author: pair.author,
    changedAt: pair.changedAt,
    keys: walk(schema, pair.older, pair.newer, ctx).map(keyOf)
  }));
  for (const row of rows) {
    const key = keyOf(row);
    const touching = edits.filter(edit => edit.keys.some(other => isRelated(key, other)));
    row.authors = _.uniqBy(
      touching.map(edit => edit.author).filter(Boolean),
      author => author._id
    );
    const changedAt = touching.map(edit => edit.changedAt).filter(Boolean).at(-1);
    if (changedAt) {
      row.changedAt = changedAt;
    }
  }
  return rows;
}

/**
 * Adds to every row what an editor of its value needs: `patchKey`,
 * `fieldId`, `widgetType` and `widgetOptions` where they apply, and the
 * `markedHtml` of a `richText` field. Rows are modified in place.
 *
 * @param {object[]} schema The schema of the document the rows are of.
 * @param {ChangeRow[]} rows
 * @param {object} doc The document the patch keys address, as stored: the
 *   newer side of the rows.
 * @param {DiffContext} ctx
 * @returns {ChangeRow[]} `rows`.
 */
function addFieldData(schema, rows, doc, ctx) {
  const idCounts = countIds(doc);
  for (const row of rows) {
    if (row.kind === 'area') {
      continue;
    }
    const target = locate(schema, row.path, ctx);
    if (!target) {
      continue;
    }
    const { itemAt, area } = target;
    const names = row.path.slice(itemAt + 1).map(segment => segment.name);
    const patchKey = getPatchKey(row, target);
    if (patchKey) {
      row.patchKey = patchKey;
    }
    const listKey = patchKey && !names.length && (row.type !== 'modified') &&
      getListKey(row, target);
    if (listKey) {
      row.listKey = listKey;
    }
    const widgetType = !names.length && row.path[itemAt]?.widgetType;
    const fieldId = widgetType ? area?._id : row.field?._id;
    if (fieldId) {
      row.fieldId = fieldId;
    }
    if (widgetType) {
      row.widgetType = widgetType;
      const allowed = area && ctx.getAreaWidgets?.(area.options || {});
      row.widgetOptions = allowed?.[widgetType] || {};
    }
    const contextual = getContextual(row, target);
    if (contextual) {
      row.contextual = contextual;
    }
    if ((row.kind === 'richText') && row.field) {
      row.markedHtml = getMarkedRichText(row, ctx);
    }
  }
  return rows;

  // The nearest widget along the path, the row's own included, when it is
  // contextual and the row is not one of its styles
  function getContextual(row, { widgets }) {
    const at = row.path.findLastIndex(segment => segment.widgetType);
    const { type, area } = widgets.at(-1) || {};
    const manager = (at !== -1) && ctx.getWidgetManager(type);
    if (!manager?.options?.contextual) {
      return;
    }
    const head = row.path[at + 1]?.name;
    if (head && Object.keys(manager.styles || {}).includes(head)) {
      return;
    }
    const id = row.path[at].name;
    if (!id || (idCounts.get(id) !== 1)) {
      return;
    }
    const allowed = area && ctx.getAreaWidgets?.(area.options || {});
    return {
      patchKey: `@${id}`,
      widgetType: type,
      widgetOptions: allowed?.[type] || {}
    };
  }

  // A key that reaches this value and nothing else. An `@` reference names
  // an `_id` the draft holds exactly once, or, for an item the draft no
  // longer has, not at all, since a patch finds the first object with it.
  // Below an object with such an `_id` the key starts there, as the field
  // app keys the fields of an object; otherwise at the item above. None
  // when the item's `_id` is missing or not unique
  function getPatchKey(row, { itemAt, objects }) {
    const namesAfter = at => row.path.slice(at + 1).map(segment => segment.name);
    for (const at of [ ...objects ].reverse()) {
      const id = resolve(doc, row.path.slice(0, at + 1))?._id;
      if (id && (idCounts.get(id) === 1)) {
        return [ `@${id}`, ...namesAfter(at) ].join('.');
      }
    }
    if (itemAt === -1) {
      return namesAfter(-1).join('.');
    }
    const id = row.path[itemAt].name;
    const whole = itemAt === row.path.length - 1;
    const expected = (whole && (row.type === 'deleted')) ? 0 : 1;
    if (!id || ((idCounts.get(id) || 0) !== expected)) {
      return;
    }
    return [
      `@${id}`,
      ...namesAfter(itemAt),
      ...((whole && (row.kind === 'richText')) ? [ 'content' ] : [])
    ].join('.');
  }

  // Where the list holding a whole item or widget is: its area by `_id`, as
  // the area editor addresses it, or its array by the key of the array field
  function getListKey(row, { itemAt, area }) {
    const path = row.path.slice(0, itemAt);
    if (!area) {
      const target = locate(schema, path, ctx);
      return target && getPatchKey({ path }, target);
    }
    const id = resolve(doc, path)?._id;
    return (id && (idCounts.get(id) === 1)) ? `@${id}.items` : undefined;
  }
}

// The deepest array item or widget along `path`, by index (-1 for none), the
// area field holding it when it is a widget, the object fields below it that
// the path is inside of, by index, every schema field along the path, those
// of them right below a widget (`heads`, the widget type's own fields) and
// every widget along it, `{ type, area }`. `null` when a name along the path
// is not in the schema
function locate(schema, path, ctx) {
  let fields = schema;
  let parent = null;
  let itemAt = -1;
  let area = null;
  let objects = [];
  const along = [];
  const widgets = [];
  const heads = [];
  let widgetType = null;
  for (const [ i, segment ] of path.entries()) {
    const kind = parent && getKind(parent, ctx);
    if (segment.widgetType || (kind === 'array')) {
      itemAt = i;
      area = segment.widgetType ? parent : null;
      widgetType = segment.widgetType || null;
      if (segment.widgetType) {
        widgets.push({
          type: segment.widgetType,
          area: parent
        });
      }
      fields = segment.widgetType
        ? ctx.getWidgetManager(segment.widgetType)?.schema || []
        : parent.schema || [];
      parent = null;
      objects = [];
      continue;
    }
    parent = fields.find(field => field.name === segment.name);
    if (!parent) {
      return null;
    }
    along.push(parent);
    if (widgetType) {
      heads.push(parent);
      widgetType = null;
    }
    if ((getKind(parent, ctx) === 'object') && (i < path.length - 1)) {
      fields = parent.schema || [];
      objects.push(i);
    }
  }
  return {
    itemAt,
    area,
    objects,
    fields: along,
    heads,
    widgets
  };
}

/**
 * Adds `editable` to every row with a `patchKey` whose fields along its path
 * the request may change and whose widgets along it their areas allow, and
 * `restore` to those of them, the order of an array aside, that a PATCH of
 * the newer document can put back to its older value exactly: the older
 * value at `patchKey`; for a whole item or widget added or deleted, the list
 * operation that takes it out or puts it back at its place; for a widget
 * modified whole, what it stores outside its schema, its fields left as they
 * are. Values are in the
 * form a save takes, each relationship as `{ _id, _fields }` entries made
 * from its stored ids. A widget type that stores data outside its schema
 * keeps it through its own `sanitize`, as it must. None for a whole widget
 * of a type that does not stand alone (the `versionsStandalone` option), nor
 * for the order of an array. None when a save would
 * drop a widget the patch writes, at any depth: of a type the site no longer
 * has, or one its area does not allow. Rows are modified in place, after
 * `addFieldData`.
 *
 * @param {object[]} schema The schema of the document the rows are of.
 * @param {ChangeRow[]} rows
 * @param {object} options
 * @param {object} options.older The older document, as stored.
 * @param {object} options.newer The newer document, as stored.
 * @param {Set<string>} options.editable The names of the top-level fields
 *   the request may edit.
 * @param {(field: object) => boolean} options.canEdit Whether the request may
 *   edit a field, at any depth, by its `editPermission` and `viewPermission`.
 * @param {(field: object, id: string) => string} options.relatedId The `_id`
 *   a save finds a related document by, from the `aposDocId` a relationship
 *   stores.
 * @param {Set<string>} options.loadable The related `_id`s of both
 *   documents that the request can load (see `getRelatedIds`).
 * @param {DiffContext} ctx With `getAreaWidgets`.
 * @returns {ChangeRow[]} `rows`.
 */
function addRestore(schema, rows, {
  older, newer, editable, canEdit, relatedId, loadable
}, ctx) {
  for (const row of rows) {
    // Nothing of it to show, nothing to put back
    if (row.system) {
      continue;
    }
    const target = row.patchKey && locate(schema, row.path, ctx);
    if (!target || !isEditable(target)) {
      continue;
    }
    row.editable = true;
    // The older order would take back every other change of the array; a
    // widget its parent lays out together with its siblings cannot be put
    // back or taken out alone
    if (isOrder(row) || !isStandaloneRow(row, target)) {
      continue;
    }
    const restore = getRestore(row, target);
    if (restore) {
      row.restore = restore;
    }
  }
  return rows;

  // None along the path is a field the save would skip or the request may
  // not change, read only or not the request's to edit, nor a widget its
  // area does not allow, which the save would leave out. Nor a field the
  // system manages (`isSystemField`)
  function isEditable({
    fields, heads, widgets
  }) {
    return editable.has(fields[0]?.name) &&
      !fields.some(field => field.readOnly || !canEdit(field)) &&
      !fields.some(field => {
        return isSystemField(field, ctx, { widget: heads.includes(field) });
      }) &&
      widgets.every(({ type, area }) => widgetOptionsOf(area, type));
  }

  function isStandaloneRow(row, { itemAt }) {
    const widgetType = (itemAt === row.path.length - 1) && row.path[itemAt].widgetType;
    return !widgetType || isStandalone(widgetType, ctx);
  }

  // None for a field the save would skip or the request may not change
  // anywhere in the value; none either when a related document the restored
  // value holds no longer loads, nor when a widget either side writes is of
  // a type its area does not allow, since the save would leave it out. A
  // widget of a type the site no longer has is left out by the save as by
  // every edit, and is no change of its own
  function getRestore(row, target) {
    let blocked = false;
    const onField = field => {
      blocked ||= Boolean(field.readOnly) || !canEdit(field);
    };
    const onWidget = (widget, options) => {
      blocked ||= Boolean(ctx.getWidgetManager(widget.type)) && !options;
    };
    const restoring = {
      toId(field, id) {
        const _id = relatedId(field, id);
        blocked ||= !loadable.has(_id);
        return _id;
      },
      onField,
      onWidget
    };
    const undoing = {
      toId: relatedId,
      onField,
      onWidget
    };
    const { itemAt } = target;
    const whole = itemAt === row.path.length - 1;
    let restore;
    if (!whole || (row.kind === 'richText')) {
      restore = {
        patch: { [row.patchKey]: valueAt(older, row, target, restoring) },
        inverse: { [row.patchKey]: valueAt(newer, row, target, undoing) }
      };
    } else if (row.type === 'modified') {
      restore = getWidgetRestore(row, target, restoring, undoing);
    } else {
      restore = row.listKey &&
        getListRestore(row, target, deleted => (deleted ? restoring : undoing));
    }
    return blocked ? undefined : restore;
  }

  // A widget modified whole changed what it stores outside its schema: that
  // goes back, and its fields stay as they are, each a row of its own
  function getWidgetRestore(row, { area }, restoring, undoing) {
    const { widgetType } = row.path.at(-1);
    const manager = ctx.getWidgetManager(widgetType);
    const widget = resolve(newer, row.path);
    if (!widget) {
      return;
    }
    const options = widgetOptionsOf(area, widgetType);
    const back = {
      ..._.omit(
        toInput(manager.schema, widget, ctx, restoring),
        Object.keys(outsideSchema(manager, widget))
      ),
      ...outsideSchema(manager, resolve(older, row.path))
    };
    const current = toInput(manager.schema, widget, ctx, undoing);
    restoring.onWidget(back, options);
    undoing.onWidget(current, options);
    return {
      patch: { [row.patchKey]: back },
      inverse: { [row.patchKey]: current }
    };
  }

  // A deleted item goes back next to a neighbour the newer list still has;
  // taking back the removal of an added one puts it next to its own
  function getListRestore(row, {
    itemAt, area, fields
  }, sideOf) {
    const id = row.path[itemAt].name;
    const { widgetType } = row.path[itemAt];
    const listPath = row.path.slice(0, itemAt);
    const olderList = listOf(resolve(older, listPath), widgetType);
    const newerList = listOf(resolve(newer, listPath), widgetType);
    const pull = { $pullAllById: { [row.listKey]: [ id ] } };
    const push = (item, place) => ({
      $push: {
        [row.listKey]: {
          $each: [ item ],
          ...place
        }
      }
    });
    // Both ways, so that the restore can be undone
    const deleted = row.type === 'deleted';
    const item = (deleted ? olderList : newerList).find(item => item?._id === id);
    if (!item) {
      return;
    }
    const itemSchema = widgetType
      ? (ctx.getWidgetManager(widgetType)?.schema || [])
      : (fields.at(-1)?.schema || []);
    const side = sideOf(deleted);
    const input = toInput(itemSchema, item, ctx, side);
    if (widgetType) {
      side.onWidget(input, widgetOptionsOf(area, widgetType));
    }
    return deleted
      ? {
        patch: push(input, placeOf(id, olderList, newerList)),
        inverse: pull
      }
      : {
        patch: pull,
        inverse: push(input, placeOf(id, newerList, newerList))
      };
  }

  function widgetOptionsOf(area, widgetType) {
    return ctx.getAreaWidgets(area?.options || {})[widgetType];
  }

  // Before the next item of `list` that `present` has, else after the
  // previous one, else at the same index
  function placeOf(id, list, present) {
    const ids = new Set(present.map(item => item?._id).filter(other => other !== id));
    const index = list.findIndex(item => item?._id === id);
    const next = list.slice(index + 1).find(item => ids.has(item?._id));
    if (next) {
      return { $before: next._id };
    }
    const previous = list.slice(0, index).reverse().find(item => ids.has(item?._id));
    if (previous) {
      return { $after: previous._id };
    }
    return { $position: index };
  }

  // The row's value in `doc`: its field's, taken from the object holding it,
  // or the markup of a rich text widget. `null` for none, so that it survives
  // the trip to the browser
  function valueAt(doc, row, { itemAt, fields }, side) {
    const value = (itemAt === row.path.length - 1)
      ? resolve(doc, row.path)?.content
      : fieldInput(fields.at(-1), resolve(doc, row.path.slice(0, -1)), ctx, side);
    return (value === undefined) ? null : value;
  }

  // An area's widgets of the types the site has, so that no anchor is one
  // the page does not show
  function listOf(node, widgetType) {
    return widgetType ? knownWidgets(node, ctx) : (Array.isArray(node) ? node : []);
  }
}

/**
 * The `_id`s of the documents the relationships of `doc` relate to, at any
 * depth, as `relatedId` makes them. What `addRestore` asks to be loadable.
 *
 * @param {object[]} schema The schema of `doc`.
 * @param {object} doc A document as stored.
 * @param {DiffContext} ctx
 * @param {(field: object, id: string) => string} relatedId See `addRestore`.
 * @returns {Set<string>}
 */
function getRelatedIds(schema, doc, ctx, relatedId) {
  const ids = new Set();
  toInput(schema, doc, ctx, {
    toId(field, id) {
      const _id = relatedId(field, id);
      ids.add(_id);
      return _id;
    }
  });
  return ids;
}

// A copy of `object` in the form a save takes, by its schema: every
// relationship, at any depth, as the `{ _id, _fields }` entries a save reads,
// in place of the ids and fields it stores. `side.toId` makes the `_id` of a
// related document; `side.onField` is told of every field the copy holds,
// `side.onWidget` of every widget in its areas, with the options its area
// gives it
function toInput(schema, object, ctx, side) {
  if (!object || (typeof object !== 'object')) {
    return object;
  }
  const input = { ...object };
  for (const field of schema) {
    if (field.idsStorage) {
      delete input[field.idsStorage];
      delete input[field.fieldsStorage];
    }
    if (_.has(object, field.name) || field.idsStorage) {
      side.onField?.(field);
      input[field.name] = fieldInput(field, object, ctx, side);
    }
  }
  return input;
}

// The value of `field` in `holder`, as `toInput` has it
function fieldInput(field, holder, ctx, side) {
  const kind = getKind(field, ctx);
  if (kind === 'relationship') {
    const fields = holder?.[field.fieldsStorage] || {};
    return (holder?.[field.idsStorage] || []).map(id => ({
      _id: side.toId(field, id),
      _fields: fields[id] || {}
    }));
  }
  const value = holder?.[field.name];
  if ((kind === 'area') && Array.isArray(value?.items)) {
    const allowed = side.onWidget && ctx.getAreaWidgets(field.options || {});
    return {
      ...value,
      items: value.items.map(widget => {
        const input = toInput(
          ctx.getWidgetManager(widget?.type)?.schema || [],
          widget,
          ctx,
          side
        );
        if (allowed && input && (typeof input === 'object')) {
          side.onWidget(input, allowed[input.type]);
        }
        return input;
      })
    };
  }
  if ((kind === 'array') && Array.isArray(value)) {
    return value.map(item => toInput(field.schema || [], item, ctx, side));
  }
  if (kind === 'object') {
    return toInput(field.schema || [], value, ctx, side);
  }
  return value;
}

// How many times each `_id` occurs inside a document, its own left out: what
// an `@` reference of a patch is looked up among
function countIds(doc) {
  const counts = new Map();
  const visit = value => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || (typeof value !== 'object')) {
      return;
    }
    if (typeof value._id === 'string') {
      counts.set(value._id, (counts.get(value._id) || 0) + 1);
    }
    for (const [ key, child ] of Object.entries(value)) {
      if (key !== '_id') {
        visit(child);
      }
    }
  };
  for (const [ key, value ] of Object.entries(doc || {})) {
    if (key !== '_id') {
      visit(value);
    }
  }
  return counts;
}

/**
 * Sets `fieldRows` on every array item added or deleted whole: the rows of
 * its fields, as a change of each field alone would be, below the item's
 * path. Rows are modified in place.
 *
 * @param {ChangeRow[]} rows
 * @param {DiffContext} ctx
 * @returns {ChangeRow[]} `rows`.
 */
function addItemFields(rows, ctx) {
  for (const row of rows) {
    if ((row.kind !== 'arrayItem') || !row.field?.schema) {
      continue;
    }
    const fieldRows = [];
    walkFields(row.field.schema, row.old || {}, row.new || {}, ctx, row.path, fieldRows);
    row.fieldRows = fieldRows;
  }
  return rows;
}

module.exports = {
  walk,
  annotate,
  consolidate,
  attribute,
  addFieldData,
  addRestore,
  addItemFields,
  getRelatedIds
};

// Walks the fields of `schema`, a widget type's own when `widget` is true.
// A field the system manages is no row (see `isSystemField`); returns
// whether such a field changed, here or in an object below, for the item or
// widget holding them to show as modified when nothing else of it changed
function walkFields(schema, older, newer, ctx, path, rows, { widget = false } = {}) {
  let system = false;
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
    if (isSystemField(field, ctx, { widget })) {
      const changes = [];
      walkField(field, kind, older, newer, ctx, fieldPath, changes);
      system ||= changes.length > 0;
      continue;
    }
    system = walkField(field, kind, older, newer, ctx, fieldPath, rows) || system;
  }
  return system;
}

// Whole when the value is not of its kind, or when its walk fails: a change
// is never lost to a failure. Returns whether a field the system manages
// changed in an object below
function walkField(field, kind, older, newer, ctx, path, rows) {
  let whole = !canWalk(kind, older[field.name], newer[field.name]);
  const mark = rows.length;
  let system = false;
  if (!whole) {
    try {
      if (kind === 'area') {
        walkArea(field, older[field.name], newer[field.name], ctx, path, rows);
      } else if (kind === 'array') {
        walkArray(field, older[field.name], newer[field.name], ctx, path, rows);
      } else if (kind === 'object') {
        system = walkObject(field, older[field.name], newer[field.name], ctx, path, rows);
      } else if (kind === 'relationship') {
        walkRelationship(field, older, newer, path, rows);
      } else {
        walkLeaf(field, kind, older, newer, ctx, path, rows);
      }
    } catch (err) {
      rows.length = mark;
      ctx.onError?.(err, path);
      whole = true;
    }
  }
  if (whole) {
    walkWhole(field, older, newer, path, rows);
  }
  return system;
}

// A field the system manages, which no editor shows: a `hidden` one, or a
// widget type's own field in its `utility` group (`widget`), such as the
// place of a layout column in its grid. An area is edited on the page,
// whatever its group
function isSystemField(field, ctx, { widget = false } = {}) {
  return (getKind(field, ctx) !== 'area') &&
    (Boolean(field.hidden) || (widget && (field.group?.name === 'utility')));
}

// The row of an item or widget whose only change is in fields the system
// manages: modified, with nothing to show of it
function systemRow(path, kind, older, newer, field) {
  const result = row(path, 'modified', kind, kind, older, newer, field);
  result.system = true;
  return result;
}

// Whether a widget of this type stands alone in a version: false for a type
// whose widgets their parent lays out together (`versionsStandalone: false`,
// or its older name `versionsRenderDeleted: false`), so that one of them is
// neither shown deleted in place nor put back or taken out alone
function isStandalone(widgetType, ctx) {
  const options = ctx.getWidgetManager(widgetType)?.options || {};
  return (options.versionsStandalone !== false) &&
    (options.versionsRenderDeleted !== false);
}

// The walk a field takes: one of the structural types, `valueless`, or
// `leaf`, except that a `richText` field is `richText`. A type extending
// one of those is taken for it
function getKind(field, ctx) {
  const name = findBaseType(field, ctx, KNOWN);
  if (!name) {
    return 'leaf';
  }
  return VALUELESS.has(name) ? 'valueless' : name;
}

// Whether both values are of the kind their field walks as. One stored
// under an earlier schema may not be, nor that of a type extending a
// structural type, free to store a shape of its own
function canWalk(kind, older, newer) {
  return [ older, newer ].every(value => {
    if (value == null) {
      return true;
    }
    if (kind === 'array') {
      return Array.isArray(value);
    }
    if (kind === 'area') {
      return isPlainValue(value) &&
        ((value.items === undefined) || Array.isArray(value.items));
    }
    if (kind === 'object') {
      return isPlainValue(value);
    }
    if (kind === 'richText') {
      return typeof value === 'string';
    }
    return true;
  });

  function isPlainValue(value) {
    return !!value && (typeof value === 'object') && !Array.isArray(value);
  }
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

// A value compared whole and deeply, as one `leaf` row. Nothing is asked
// of its type, whose `isEqual` and `isEmpty` do not know the shape stored
function walkWhole(field, older, newer, path, rows) {
  const oldValue = older[field.name];
  const newValue = newer[field.name];
  if (_.isEqual(oldValue, newValue) || ((oldValue == null) && (newValue == null))) {
    return;
  }
  rows.push(row(
    path,
    changeType(isEmpty(null, field, oldValue), isEmpty(null, field, newValue)),
    field.type,
    'leaf',
    oldValue,
    newValue,
    field
  ));
}

// Relationship fields with no values are no fields: saving from the editor
// stores a `null` for each where picking the document stored `{}`
function walkRelationship(field, older, newer, path, rows) {
  const idsOf = doc => Array.isArray(doc[field.idsStorage]) ? doc[field.idsStorage] : [];
  const fieldsOf = doc => {
    const byId = (field.fieldsStorage && doc[field.fieldsStorage]) || {};
    return _.omitBy(
      _.mapValues(byId, values => _.omitBy(values, value => value == null)),
      _.isEmpty
    );
  };
  const oldIds = idsOf(older);
  const newIds = idsOf(newer);
  if (_.isEqual(oldIds, newIds) && _.isEqual(fieldsOf(older), fieldsOf(newer))) {
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
    return false;
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
    return false;
  }
  return walkFields(field.schema, older, newer, ctx, path, rows);
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
      const mark = rows.length;
      if (walkFields(field.schema, oldItem, newItem, ctx, itemPath, rows) &&
        (rows.length === mark)) {
        rows.push(systemRow(itemPath, 'arrayItem', oldItem, newItem, field));
      }
    }
  }
}

// Widgets match by `_id`, like array items; a matched pair walks the
// widget type's schema, then its content outside the schema. A widget of a
// type the site no longer has is left out, as the page and a save leave it
// out, so that positions are the ones the page shows
function walkArea(field, older, newer, ctx, path, rows) {
  const entries = mergeItems(knownWidgets(older, ctx), knownWidgets(newer, ctx));
  walkOrder('area', field, entries, path, rows, (widget, ordinal) => {
    const manager = ctx.getWidgetManager(widget.type);
    return {
      ordinal,
      label: manager.label,
      title: manager.options.titleField && text.getWidgetText(widget, ctx)
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
    const title = manager.options.titleField && text.getWidgetText(widget, ctx);
    const widgetPath = [
      ...path,
      {
        name: widget._id,
        label: manager.label,
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
    } else {
      walkWidget(manager, oldWidget, newWidget, ctx, widgetPath, rows);
    }
  }
}

// The widgets of an area whose type the site has
function knownWidgets(area, ctx) {
  return (area?.items || []).filter(widget => ctx.getWidgetManager(widget?.type));
}

// Rich text lives outside the widget schema, so it is compared on its own
// as a `richText` row at the widget's path; the rest of a rich text widget
// (the id lists sanitize derives from its markup) follows the content and
// is not compared. Any other data another widget type stores outside its
// schema is one `widget` row, and so is rich text that is no string
function walkWidget(manager, older, newer, ctx, path, rows) {
  const mark = rows.length;
  const system = walkFields(manager.schema, older, newer, ctx, path, rows, {
    widget: true
  });
  walkContent();
  if (system && (rows.length === mark)) {
    rows.push(systemRow(path, 'widget', older, newer, null));
  }

  function walkContent() {
    if (manager.getRichText) {
      const oldText = manager.getRichText(older) || '';
      const newText = manager.getRichText(newer) || '';
      if ((typeof oldText === 'string') && (typeof newText === 'string')) {
        if (oldText !== newText) {
          rows.push(row(path, 'modified', 'richText', 'richText', oldText, newText, null));
        }
        return;
      }
    }
    if (!_.isEqual(outsideSchema(manager, older), outsideSchema(manager, newer))) {
      rows.push(row(path, 'modified', 'widget', 'widget', older, newer, null));
    }
  }
}

// What a widget stores outside its schema, which only the widget type itself
// reads and keeps through a save, with its own `sanitize`
function outsideSchema(manager, widget) {
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
  return _.pickBy(widget, (value, key) => !ignored.has(key) && !key.startsWith('_'));
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

// `null` when the change cannot be shown that way, a failure included
function getMarkedRichText(row, ctx) {
  try {
    return diffRichText(row.old || '', row.new || '', {
      labels: {
        removed: ctx.t?.('apostrophe:versionRemovedText'),
        added: ctx.t?.('apostrophe:versionAddedText')
      }
    });
  } catch (err) {
    ctx.onError?.(err, row.path);
    return null;
  }
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
      {
        ...describe(entry.newer, entry.ordinal),
        olderOrdinal: entry.olderOrdinal
      }
    ])),
    enumerable: false
  });
  rows.push(result);
}

// The two item lists as one sequence of `{ older, newer, ordinal }`, in the
// newer order, each deleted item placed after the item that preceded it in
// the older list. `ordinal` is the item's 1-based position in the list it
// is taken from, `olderOrdinal` the one in the older list when it is there.
// Items without an `_id` match by position; a position holding no item on
// either side (`null`) is left out
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
  return merged.filter(entry => entry.older || entry.newer);
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

// Names the items a consolidated order row moved, and AI's part in moving
// each. "Which items moved" has more than one right answer, and the fewest
// moves between the two ends may name items no version touched. So the
// moves of the versions themselves are preferred when they explain the new
// order: without the moved items, both lists are in the same order. Sets
// `movedItems` and `aiItems` then; otherwise leaves `row` as it is, and
// every moved item takes the row's `ai`. `edits` are the versions' own
// rows, oldest first, `before` the rows AI changed before them
function explainOrder(row, edits, before) {
  const key = keyOf(row);
  const movedIn = rows => new Set(rows
    .filter(other => isOrder(other) && _.isEqual(keyOf(other), key))
    .flatMap(getMovedIds)
    .filter(id => row.new.includes(id)));
  const moves = edits.map(edit => ({
    ai: edit.ai,
    ids: movedIn(edit.rows)
  }));
  const holds = moved => _.isEqual(
    row.old.filter(id => !moved.has(id)),
    row.new.filter(id => !moved.has(id))
  );
  const moved = new Set(moves.flatMap(move => [ ...move.ids ]));
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
  const movedBefore = movedIn(before);
  const aiItems = new Map();
  for (const id of moved) {
    const ai = getAi(moves.filter(move => move.ids.has(id)), movedBefore.has(id));
    if (ai) {
      aiItems.set(id, ai);
    }
  }
  Object.defineProperties(row, {
    movedItems: {
      value: row.new.filter(id => moved.has(id)),
      enumerable: false
    },
    aiItems: {
      value: aiItems,
      enumerable: false
    }
  });
}

// AI's part in a change, from the versions that made it, oldest first, and
// whether AI changed it before them (see `consolidate`)
function getAi(touching, aiBefore) {
  const last = touching.at(-1);
  if (!last) {
    return false;
  }
  if (last.ai) {
    return 'changed';
  }
  return (aiBefore || touching.some(edit => edit.ai)) ? 'assisted' : false;
}

// The stronger of two AI parts: `changed` over `assisted` over none
function getStrongerAi(one, two) {
  if ((one === 'changed') || (two === 'changed')) {
    return 'changed';
  }
  return one || two || false;
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
      node = node.find(item => item?._id === segment.name);
    } else if (node.metaType === 'area') {
      node = (node.items || []).find(item => item?._id === segment.name);
    } else {
      node = node[segment.name];
    }
  }
  return node;
}
