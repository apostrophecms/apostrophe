// Text representations of stored values, for reading a change: what the
// older and newer side of a change row say in words. Pure functions, like
// `diff.js`; related document titles are resolved by the module and passed
// in as a map.

const _ = require('lodash');
const { diffWords, diffArrays } = require('diff');
const getFormatChanges = require('./rich-text-format.js');
const findBaseType = require('./field-kind.js');
const {
  formatLines, countLines, getLinks, getPermalinkId
} = require('./format-text.js');

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
const SPECIAL = new Set([ 'richText', 'attachment', 'relationship', 'box', 'oembed' ]);
const KNOWN = new Set([ ...SCALAR, ...SPECIAL ]);
// The sides of a box, as its input names them
const BOX_SIDES = {
  top: 'apostrophe:boxFieldTop',
  right: 'apostrophe:boxFieldRight',
  bottom: 'apostrophe:boxFieldBottom',
  left: 'apostrophe:boxFieldLeft'
};
/**
 * Plaintext of rich text markup: tags stripped, entities decoded, every
 * block boundary a line break, runs of them one line break. A figure, its
 * caption and a rule are boundaries too, which `htmlToPlaintext` does not
 * know as blocks. `''` for anything but a string.
 *
 * @param {string} html
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {string}
 */
function toPlaintext(html, ctx) {
  if (typeof html !== 'string') {
    return '';
  }
  return ctx.htmlToPlaintext(html.replace(/<(figure|figcaption|hr)\b/gi, '<br><$1'))
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * The text of one stored field value: scalars (and types extending them)
 * as their value, a choice as its label when the field lists its choices,
 * a number with the field's `unit` when it has one, rich text as plaintext,
 * an attachment as its name and extension, a relationship as the titles of
 * the related documents in id order, a box as the sides that are set
 * (`Top 10px, Left 20px`), an embed as its URL. Anything else, and a value
 * with no safe string form, is `''`.
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
  if (kind === 'oembed') {
    return scalarText(value.url);
  }
  if (kind === 'box') {
    return Object.entries(BOX_SIDES)
      .filter(([ side ]) => typeof value[side] === 'number')
      .map(([ side, label ]) => {
        return `${ctx.t ? ctx.t(label) : side} ${withUnit(field, value[side])}`;
      })
      .join(', ');
  }
  if (kind === 'scalar') {
    return Array.isArray(field.choices)
      ? scalarText(getChoiceLabels(field, value, ctx.t))
      : scalarText(withUnit(field, value));
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
    return scalarText(getChoiceLabels(field, value));
  }
  return getKind(field, ctx) === 'relationship' ? '' : toText(field, value, ctx);
}

/**
 * Sets `format` on each modified rich text row whose formatting changed:
 * the records of `lib/rich-text-format.js` from its `old` to its `new`, for
 * `addText` to put in words. Run before `getRelatedIds`, which the images
 * among them need. A row whose markup cannot be read gets none.
 *
 * @param {import('./diff.js').ChangeRow[]} rows Rows from `walk`, modified.
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {import('./diff.js').ChangeRow[]} The same rows.
 */
function addFormat(rows, ctx) {
  for (const row of rows) {
    if ((row.kind !== 'richText') || !row.old || !row.new) {
      continue;
    }
    try {
      const format = getFormatChanges(row.old, row.new);
      if (format.length) {
        Object.defineProperty(row, 'format', {
          value: format,
          enumerable: false
        });
      }
    } catch (err) {
      ctx.onError?.(err, row.path);
    }
  }
  return rows;
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
    if (row.kind === 'relationship') {
      [ ...(row.old || []), ...(row.new || []) ].forEach(id => ids.add(id));
    }
    for (const record of (row.format || [])) {
      [ record.id, record.old?.id ].filter(Boolean).forEach(id => ids.add(id));
      getLinks(record).map(getPermalinkId).filter(Boolean).forEach(id => ids.add(id));
    }
  }
  return [ ...ids ];
}

/**
 * Sets `oldText` and `newText` on each row: the text of `old` and `new`.
 *
 * - A rich text row reads as plaintext.
 * - An array item reads as its title: its array's `titleField`, else its
 *   `title` field.
 * - A widget reads as its title (the `titleField` option of its type), a
 *   rich text widget as its plaintext.
 * - An order row reads as its items in that order, each as `#n`, its widget
 *   type and its title. `n` is the item's position in the newer document,
 *   which tells items that read alike apart.
 * - Any other row reads as its field's text (`toText`).
 *
 * A row with `format` records (see `addFormat`) also gets `formatChanges`:
 * `FormatLine`s in the language of the admin UI, saying what changed, the
 * words affected, and the old and new value where there is one. Most
 * records are one line; a link or an image is one line for each attribute
 * that changed; the rules and the line breaks are one line each, last, by
 * their count. Blocks and marks go by the rich text editor's own labels,
 * an image by its title.
 *
 * A relationship row whose ids changed also gets `images`: for each side
 * whose related documents are all images, `{ text, href, change }` for
 * each in id order, `change` being `same`, or `added` or `removed` for an
 * image on that side only.
 *
 * A row that cannot be put in words stays, with empty text.
 *
 * @param {import('./diff.js').ChangeRow[]} rows Rows from `walk`, modified.
 * @param {import('./diff.js').DiffContext} ctx
 * @param {object} [options]
 * @param {Object<string, string>} [options.titles] Related document titles
 *   by id, for relationship rows (see `getRelatedIds`).
 * @param {Object<string, string>} [options.urls] Image URLs by id, for
 *   formatting changes and relationship rows.
 * @param {Object<string, string>} [options.links] Document URLs by id,
 *   for internal links.
 * @returns {import('./diff.js').ChangeRow[]} The same rows.
 */
function addText(rows, ctx, {
  titles = {}, urls = {}, links = {}
} = {}) {
  for (const row of rows) {
    try {
      row.oldText = rowText(row, row.old, ctx, titles);
      row.newText = rowText(row, row.new, ctx, titles);
      if (row.kind === 'relationship') {
        addImages(row, titles, urls);
      }
      if (row.format && ctx.t) {
        row.formatChanges = [
          ...row.format.flatMap(record => formatLines(record, ctx, {
            titles,
            urls,
            links
          })),
          ...countLines(row.format, ctx)
        ];
      }
    } catch (err) {
      ctx.onError?.(err, row.path);
      row.oldText = '';
      row.newText = '';
      delete row.images;
      delete row.formatChanges;
    }
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
 * `addText`. A row that cannot be compared has no parts.
 *
 * @param {import('./diff.js').ChangeRow[]} rows Rows with text, modified.
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {import('./diff.js').ChangeRow[]} The same rows.
 */
function addWordDiff(rows, ctx) {
  for (const row of rows) {
    try {
      row.diff = row.items
        ? orderDiff(row, ctx)
        : diffWords(row.oldText, row.newText).map(part => ({
          text: part.value,
          change: changeOf(part)
        }));
    } catch (err) {
      ctx.onError?.(err, row.path);
      row.diff = [];
    }
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
  toText,
  getItemText,
  getWidgetText,
  addFormat,
  getRelatedIds,
  addText,
  addWordDiff
};

// The images of each side of a relationship row, when its ids changed. A
// side with no ids, or with a document that is no image or cannot be
// opened, has none
function addImages(row, titles, urls) {
  const oldIds = row.old || [];
  const newIds = row.new || [];
  if (_.isEqual(oldIds, newIds)) {
    return;
  }
  const imagesOf = (ids, others, change) => {
    if (!ids.length || !ids.every(id => urls[id])) {
      return undefined;
    }
    return ids.map(id => ({
      text: titles[id] || '',
      href: urls[id],
      change: others.includes(id) ? 'same' : change
    }));
  };
  const images = _.omitBy({
    old: imagesOf(oldIds, newIds, 'removed'),
    new: imagesOf(newIds, oldIds, 'added')
  }, _.isUndefined);
  if (!_.isEmpty(images)) {
    row.images = images;
  }
}

function rowText(row, value, ctx, titles) {
  if (value == null) {
    return '';
  }
  if (row.kind === 'richText') {
    return toPlaintext(value, ctx);
  }
  if (row.kind === 'arrayItem') {
    return getItemText(row.field, value, ctx);
  }
  if (row.kind === 'widget') {
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
// `added` where it is. No part holds the commas of the text. The items
// that moved are the row's `movedItems` when it names them, otherwise the
// fewest that explain the new order
function orderDiff(row, ctx) {
  const part = (id, change) => ({
    text: itemText(row.items[id], ctx),
    change
  });
  if (!row.movedItems) {
    return diffArrays(row.old, row.new)
      .flatMap(found => found.value.map(id => part(id, changeOf(found))));
  }
  const moved = new Set(row.movedItems);
  const parts = [];
  let at = 0;
  for (const id of row.new) {
    if (moved.has(id)) {
      parts.push(part(id, 'added'));
      continue;
    }
    // The items that stayed stand in one order on both sides
    for (; row.old[at] !== id; at++) {
      parts.push(part(row.old[at], 'removed'));
    }
    parts.push(part(id, 'same'));
    at++;
  }
  return [
    ...parts,
    ...row.old.slice(at).map(id => part(id, 'removed'))
  ];
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
  const name = findBaseType(field, ctx, KNOWN);
  return SCALAR.has(name) ? 'scalar' : name;
}

// The labels of the stored choice or choices of a field that lists them,
// in the language of `t` when given; a value that is no choice stays
function getChoiceLabels(field, value, t) {
  const labelOf = choice => {
    const label = field.choices.find(option => option.value === choice)?.label;
    return (label == null) ? choice : (t ? t(label) : label);
  };
  return Array.isArray(value) ? value.map(labelOf) : labelOf(value);
}

// A number with the unit its field gives it: `50%`
function withUnit(field, value) {
  return ((typeof value === 'number') && (typeof field.unit === 'string'))
    ? `${value}${field.unit}`
    : value;
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
