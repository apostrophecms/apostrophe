// Text representations of stored values, for reading a change: what the
// older and newer side of a change row say in words. Pure functions, like
// `diff.js`; related document titles are resolved by the module and passed
// in as a map.

const _ = require('lodash');
const { diffWords, diffArrays } = require('diff');

// Core field types whose stored value reads as text as it is, reached
// through `extend` as well
const SCALAR = new Set([
  'string',
  'select',
  'checkboxes',
  'boolean',
  'integer',
  'float',
  'range',
  'date',
  'time',
  'dateAndTime',
  'email',
  'url',
  'color'
]);
// Field types with a representation of their own
const SPECIAL = new Set([ 'richText', 'attachment', 'relationship' ]);

/**
 * Plaintext of rich text markup: tags stripped, entities decoded, every
 * block boundary a line break, runs of them one line break.
 *
 * @param {string} html
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {string}
 */
function toPlaintext(html, ctx) {
  return ctx.htmlToPlaintext(html || '')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * The text of one stored field value: scalars (and types extending them)
 * as their value, rich text as plaintext, an attachment as its name and
 * extension, a relationship as the titles of the related documents in id
 * order. Anything else, and a value with no safe string form, is `''`.
 *
 * @param {object} field The schema field.
 * @param {any} value The stored value; for a relationship, its ids.
 * @param {import('./diff.js').DiffContext} ctx
 * @param {object} [options]
 * @param {Object<string, string>} [options.titles] Related document titles
 *   by id. An id without a title is left out.
 * @returns {string}
 */
function toText(field, value, ctx, { titles = {} } = {}) {
  if (value == null) {
    return '';
  }
  const kind = getKind(field, ctx);
  if (kind === 'richText') {
    return (typeof value === 'string') ? toPlaintext(value, ctx) : '';
  }
  if (kind === 'attachment') {
    return value.name ? [ value.name, value.extension ].filter(Boolean).join('.') : '';
  }
  if (kind === 'relationship') {
    return Array.isArray(value)
      ? value.map(id => titles[id]).filter(Boolean).join(', ')
      : '';
  }
  if (kind === 'scalar') {
    return scalarText(value);
  }
  return '';
}

/**
 * The title of an array item or a widget: the text of its `titleField`,
 * which may be a dotted path into object fields. A choice field reads as
 * the label of the stored choice, as the array editor shows it. `''` when
 * there is no such field or it has no text.
 *
 * @param {object[]} schema The item's or widget's schema.
 * @param {string} [titleField]
 * @param {object} item
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {string}
 */
function getTitle(schema, titleField, item, ctx) {
  const field = titleField && findField(schema, titleField);
  if (!field || !item) {
    return '';
  }
  const value = _.get(item, titleField);
  if (Array.isArray(field.choices)) {
    const labelOf = choice => field.choices
      .find(option => option.value === choice)?.label ?? choice;
    return scalarText(Array.isArray(value) ? value.map(labelOf) : labelOf(value));
  }
  return getKind(field, ctx) === 'relationship' ? '' : toText(field, value, ctx);
}

/**
 * The ids of every related document the rows' text needs a title for.
 *
 * @param {import('./diff.js').ChangeRow[]} rows
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {string[]}
 */
function getRelatedIds(rows, ctx) {
  const ids = new Set();
  for (const row of rows) {
    if (row.field && (getKind(row.field, ctx) === 'relationship')) {
      [ ...(row.old || []), ...(row.new || []) ].forEach(id => ids.add(id));
    }
  }
  return [ ...ids ];
}

/**
 * Sets `oldText` and `newText` on each row: the text of `old` and `new`.
 * A rich text row reads as plaintext; an array item as its title (its
 * array's `titleField`, else its `title` field); a widget as its title (the
 * widget type's `titleField` option) or, for rich text, its plaintext;
 * the order of an array or area as its items in that order, each `#n`,
 * its position in the newer document, which tells items that read alike
 * apart, then its widget type and its title; any other row as its field's
 * text (`toText`).
 *
 * @param {import('./diff.js').ChangeRow[]} rows Rows from `walk`, modified.
 * @param {import('./diff.js').DiffContext} ctx
 * @param {object} [options]
 * @param {Object<string, string>} [options.titles] Related document titles
 *   by id, for relationship rows (see `getRelatedIds`).
 * @returns {import('./diff.js').ChangeRow[]} The same rows.
 */
function addText(rows, ctx, { titles = {} } = {}) {
  for (const row of rows) {
    row.oldText = rowText(row, row.old, ctx, titles);
    row.newText = rowText(row, row.new, ctx, titles);
  }
  return rows;
}

/**
 * Sets `diff` on each row: its `oldText` and `newText` compared word by
 * word, as `{ text, change }` parts in reading order, `change` being `same`,
 * `added` or `removed`. A row whose texts do not differ has no `added` or
 * `removed` part. The order of an array or area compares item by item:
 * each part is a whole item, without the commas of the text, so an item
 * that moved is marked whole and the ones it passed are not. Run after
 * `addText`.
 *
 * @param {import('./diff.js').ChangeRow[]} rows Rows with text, modified.
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {import('./diff.js').ChangeRow[]} The same rows.
 */
function addWordDiff(rows, ctx) {
  for (const row of rows) {
    row.diff = row.items
      ? orderDiff(row, ctx)
      : diffWords(row.oldText, row.newText).map(part => ({
        text: part.value,
        change: changeOf(part)
      }));
  }
  return rows;
}

/**
 * The title of a widget for display: its type's `titleField` option, or
 * for a rich text type its plaintext. `''` when it has neither.
 *
 * @param {object} widget
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {string}
 */
function getWidgetText(widget, ctx) {
  const manager = widget && ctx.getWidgetManager(widget.type);
  if (!manager) {
    return '';
  }
  if (manager.options.titleField) {
    return getTitle(manager.schema, manager.options.titleField, widget, ctx);
  }
  if (manager.getRichText) {
    return toPlaintext(manager.getRichText(widget), ctx);
  }
  return '';
}

/**
 * The title of an array item for display: its array's `titleField`, else
 * the item's `title` field. `''` when it has neither.
 *
 * @param {object} field The array field.
 * @param {object} item
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {string}
 */
function getItemText(field, item, ctx) {
  return getTitle(field.schema || [], field.titleField || 'title', item, ctx);
}

module.exports = {
  toPlaintext,
  toText,
  getItemText,
  getWidgetText,
  getRelatedIds,
  addText,
  addWordDiff
};

function rowText(row, value, ctx, titles) {
  if (value == null) {
    return '';
  }
  if (row.fieldType === 'richText') {
    return toPlaintext(value, ctx);
  }
  if (row.fieldType === 'arrayItem') {
    return getItemText(row.field, value, ctx);
  }
  if (row.fieldType === 'widget') {
    return getWidgetText(value, ctx);
  }
  if (row.items) {
    return value.map(id => itemText(row.items[id], ctx)).join(', ');
  }
  return row.field ? toText(row.field, value, ctx, { titles }) : '';
}

function changeOf(part) {
  return part.added ? 'added' : part.removed ? 'removed' : 'same';
}

// The parts of an order row: whole items, in the order a reader of both
// sides meets them, an item that moved being `removed` where it was and
// `added` where it is. No part holds the commas of the text
function orderDiff(row, ctx) {
  return diffArrays(row.old, row.new).flatMap(part => part.value.map(id => ({
    text: itemText(row.items[id], ctx),
    change: changeOf(part)
  })));
}

// An item of an order row: `#2 Rich Text · Its title`
function itemText({
  ordinal, label, title
}, ctx) {
  const type = label && (ctx.t ? ctx.t(label) : label);
  const name = [ type, title ].filter(Boolean).join(' · ');
  return name ? `#${ordinal} ${name}` : `#${ordinal}`;
}

// `scalar`, one of the special types, or `null` when the value has no text.
// A type extending a known type reads like it
function getKind(field, ctx) {
  const seen = new Set();
  let name = field.type;
  while (name && !seen.has(name)) {
    if (SCALAR.has(name)) {
      return 'scalar';
    }
    if (SPECIAL.has(name)) {
      return name;
    }
    seen.add(name);
    name = ctx.getFieldType(name)?.extend;
  }
  return null;
}

function scalarText(value) {
  if (typeof value === 'string') {
    return value;
  }
  if ((typeof value === 'number') || (typeof value === 'boolean')) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(scalarText).filter(Boolean).join(', ');
  }
  return '';
}

// The schema field a dotted path names, through object fields
function findField(schema, dotted) {
  let field;
  for (const name of dotted.split('.')) {
    field = (schema || []).find(candidate => candidate.name === name);
    if (!field) {
      return null;
    }
    schema = field.schema;
  }
  return field;
}
