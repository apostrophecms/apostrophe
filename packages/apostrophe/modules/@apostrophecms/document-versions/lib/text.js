// Text representations of stored values, for reading a change: what the
// older and newer side of a change row say in words. Pure functions, like
// `diff.js`; related document titles are resolved by the module and passed
// in as a map.

const _ = require('lodash');
const { diffWords, diffArrays } = require('diff');
const getFormatChanges = require('./rich-text-format.js');

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
// The most of the affected text a formatting sentence quotes
const QUOTE_LENGTH = 80;
// What the rich text editor calls the blocks, marks and alignments it
// offers. A configured style goes by its own label
const BLOCK_LABELS = {
  p: 'apostrophe:richTextParagraph',
  h1: 'apostrophe:richTextH1',
  h2: 'apostrophe:richTextH2',
  h3: 'apostrophe:richTextH3',
  h4: 'apostrophe:richTextH4',
  h5: 'apostrophe:richTextH5',
  h6: 'apostrophe:richTextH6',
  blockquote: 'apostrophe:richTextBlockquote',
  pre: 'apostrophe:richTextCodeBlock',
  ul: 'apostrophe:richTextBulletedList',
  ol: 'apostrophe:richTextOrderedList'
};
const MARK_LABELS = {
  bold: 'apostrophe:richTextBold',
  italic: 'apostrophe:richTextItalic',
  strike: 'apostrophe:richTextStrikethrough',
  underline: 'apostrophe:richTextUnderline',
  highlight: 'apostrophe:richTextHighlight',
  color: 'apostrophe:richTextColor',
  subscript: 'apostrophe:subscript',
  superscript: 'apostrophe:superscript',
  code: 'apostrophe:versionFormatCode',
  style: 'apostrophe:versionFormatInlineStyle'
};
const ALIGN_LABELS = {
  left: 'apostrophe:richTextAlignLeft',
  center: 'apostrophe:richTextAlignCenter',
  right: 'apostrophe:richTextAlignRight',
  justify: 'apostrophe:richTextAlignJustify'
};

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
 * Sets `format` on each modified rich text row whose formatting changed:
 * the records of `lib/rich-text-format.js` from its `old` to its `new`, for
 * `addText` to put in words. Run before `getRelatedIds`, which the images
 * among them need.
 *
 * @param {import('./diff.js').ChangeRow[]} rows Rows from `walk`, modified.
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {import('./diff.js').ChangeRow[]} The same rows.
 */
function addFormat(rows, ctx) {
  for (const row of rows) {
    const isRichText = (row.fieldType === 'richText') ||
      (row.field && (getKind(row.field, ctx) === 'richText'));
    if (!isRichText || !row.old || !row.new) {
      continue;
    }
    const format = getFormatChanges(row.old, row.new);
    if (format.length) {
      Object.defineProperty(row, 'format', {
        value: format,
        enumerable: false
      });
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
    if (row.field && (getKind(row.field, ctx) === 'relationship')) {
      [ ...(row.old || []), ...(row.new || []) ].forEach(id => ids.add(id));
    }
    for (const record of (row.format || [])) {
      [ record.id, record.old?.id ].filter(Boolean).forEach(id => ids.add(id));
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
 * A row with `format` records (see `addFormat`) also gets `formatChanges`,
 * a `{ text, change }` line for each: `text` a sentence in the language of
 * the admin UI, quoting the words affected and the old and new value where
 * there is one, `change` the record's `kind`. Blocks and marks go by the
 * rich text editor's own labels, an image by its title. A line that names
 * an image with a URL also has `parts`, the same sentence cut around the
 * names, `{ text }` or `{ text, href }` each, so the name can be shown as a
 * link to the image.
 *
 * @param {import('./diff.js').ChangeRow[]} rows Rows from `walk`, modified.
 * @param {import('./diff.js').DiffContext} ctx
 * @param {object} [options]
 * @param {Object<string, string>} [options.titles] Related document titles
 *   by id, for relationship rows (see `getRelatedIds`).
 * @param {Object<string, string>} [options.urls] Image URLs by id.
 * @returns {import('./diff.js').ChangeRow[]} The same rows.
 */
function addText(rows, ctx, { titles = {}, urls = {} } = {}) {
  for (const row of rows) {
    row.oldText = rowText(row, row.old, ctx, titles);
    row.newText = rowText(row, row.new, ctx, titles);
    if (row.format && ctx.t) {
      row.formatChanges = row.format.map(record => formatLine(record, ctx, {
        titles,
        urls
      }));
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
  addFormat,
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

// One formatting change of rich text as a line of `formatChanges`. The
// `parts` come from the same sentence said with a placeholder for every
// image name, so they follow the word order of any language
function formatLine(record, ctx, { titles, urls }) {
  const nameOf = (id, alt) => quote(titles[id] || alt) || ctx.t('apostrophe:image');
  const line = {
    text: formatText(record, ctx, nameOf),
    change: record.kind
  };
  const names = [];
  const marked = formatText(record, ctx, (id, alt) => {
    names.push({
      text: nameOf(id, alt),
      ...(urls[id] && { href: urls[id] })
    });
    return `\uE000${names.length - 1}\uE000`;
  });
  if (names.some(name => name.href)) {
    line.parts = marked.split(/\uE000(\d+)\uE000/)
      .map((text, at) => (at % 2) ? names[text] : { text })
      .filter(part => part.text);
  }
  return line;
}

// The sentence of one formatting change. `nameOf(id, alt)` names an image
function formatText(record, ctx, nameOf) {
  const {
    kind, old, new: now
  } = record;
  const text = quote(record.text);
  const marks = list => list.map(mark => markLabel(mark, ctx)).join(', ');
  switch (kind) {
    case 'link':
      if (old.href !== now.href) {
        return ctx.t('apostrophe:versionFormatLink', {
          text,
          old: old.href,
          new: now.href
        });
      }
      if ((old.target === '_blank') !== (now.target === '_blank')) {
        return (now.target === '_blank')
          ? ctx.t('apostrophe:versionFormatLinkNewTab', { text })
          : ctx.t('apostrophe:versionFormatLinkSameTab', { text });
      }
      return ctx.t('apostrophe:versionFormatLinkSettings', { text });
    case 'linkAdded':
      return ctx.t('apostrophe:versionFormatLinkAdded', {
        text,
        new: now
      });
    case 'linkRemoved':
      return ctx.t('apostrophe:versionFormatLinkRemoved', {
        text,
        old
      });
    case 'marksAdded':
      return ctx.t('apostrophe:versionFormatMarksAdded', {
        text,
        marks: marks(now)
      });
    case 'marksRemoved':
      return ctx.t('apostrophe:versionFormatMarksRemoved', {
        text,
        marks: marks(old)
      });
    case 'mark':
      return (old.value && now.value)
        ? ctx.t('apostrophe:versionFormatMarkValue', {
          text,
          mark: markLabel({ name: now.name }, ctx),
          old: old.value,
          new: now.value
        })
        : changed(markLabel(old, ctx), markLabel(now, ctx));
    case 'anchor':
      if (old && now) {
        return ctx.t('apostrophe:versionFormatAnchor', {
          text,
          old,
          new: now
        });
      }
      return now
        ? ctx.t('apostrophe:versionFormatAnchorAdded', {
          text,
          new: now
        })
        : ctx.t('apostrophe:versionFormatAnchorRemoved', {
          text,
          old
        });
    case 'block':
    case 'style':
      return changed(blockLabel(old, ctx), blockLabel(now, ctx));
    case 'align':
      return changed(alignLabel(old, ctx), alignLabel(now, ctx));
    case 'merged':
      return ctx.t('apostrophe:versionFormatMerged', { text });
    case 'split':
      return ctx.t('apostrophe:versionFormatSplit', { text });
    case 'imageAdded':
      return ctx.t('apostrophe:versionFormatImageAdded', {
        text: nameOf(record.id, record.text)
      });
    case 'imageRemoved':
      return ctx.t('apostrophe:versionFormatImageRemoved', {
        text: nameOf(record.id, record.text)
      });
    case 'imageReplaced':
      return ctx.t('apostrophe:versionFormatImageReplaced', {
        old: nameOf(old.id, old.alt),
        new: nameOf(now.id, now.alt)
      });
    case 'image':
      return _.isEqual(_.union(Object.keys(old), Object.keys(now)), [ 'alt' ])
        ? ctx.t('apostrophe:versionFormatImageAlt', {
          old: quote(old.alt),
          new: quote(now.alt)
        })
        : ctx.t('apostrophe:versionFormatImage', {
          text: nameOf(record.id, record.text)
        });
    case 'ruleAdded':
      return ctx.t('apostrophe:versionFormatRuleAdded');
    case 'ruleRemoved':
      return ctx.t('apostrophe:versionFormatRuleRemoved');
    case 'breakAdded':
      return ctx.t('apostrophe:versionFormatBreakAdded');
    case 'breakRemoved':
      return ctx.t('apostrophe:versionFormatBreakRemoved');
    default:
      return ctx.t('apostrophe:versionFormatTable');
  }

  function changed(from, to) {
    return ctx.t('apostrophe:versionFormatChanged', {
      text,
      old: from,
      new: to
    });
  }
}

// The affected words as a sentence quotes them: on one line, cut short
function quote(text) {
  const line = (text || '').replace(/\s+/g, ' ').trim();
  return (line.length > QUOTE_LENGTH)
    ? `${line.slice(0, QUOTE_LENGTH).trimEnd()}…`
    : line;
}

// The label of the configured style with that tag and class, if any
function styleLabel({ tag, class: className }, ctx) {
  const found = (ctx.getRichTextStyles?.() || []).find(style => {
    return (style.tag === tag) && ((style.class || '') === (className || ''));
  });
  return found?.label && ctx.t(found.label);
}

function blockLabel(block, ctx) {
  if (!block) {
    return '';
  }
  const label = ctx.t(BLOCK_LABELS[block.tag] || block.tag.toUpperCase());
  return styleLabel(block, ctx) ||
    (block.class ? `${label} (${block.class})` : label);
}

function markLabel(mark, ctx) {
  const label = ctx.t(MARK_LABELS[mark.name] || mark.name);
  return (mark.class && styleLabel(mark, ctx)) ||
    (mark.class ? `${label} (${mark.class})` : label);
}

function alignLabel(align, ctx) {
  return ctx.t(ALIGN_LABELS[align] || 'apostrophe:versionFormatAlignDefault');
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
