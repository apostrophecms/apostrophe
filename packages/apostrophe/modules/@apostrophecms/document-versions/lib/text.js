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
const SPECIAL = new Set([ 'richText', 'attachment', 'relationship', 'box', 'oembed' ]);
// The sides of a box, as its input names them
const BOX_SIDES = {
  top: 'apostrophe:boxFieldTop',
  right: 'apostrophe:boxFieldRight',
  bottom: 'apostrophe:boxFieldBottom',
  left: 'apostrophe:boxFieldLeft'
};
// An internal link as rich text stores it, until the page loads and the
// placeholder becomes the document's URL
const PERMALINK = /^#apostrophe-permalink-([^?]+)/;
// The most of the affected text a formatting line quotes
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
// What changes of an image, other than the image itself
const IMAGE_LABELS = {
  alt: 'apostrophe:versionFormatImageAlt',
  style: 'apostrophe:versionFormatImageStyle',
  href: 'apostrophe:versionFormatImageLink'
};

/**
 * Plaintext of rich text markup: tags stripped, entities decoded, every
 * block boundary a line break, runs of them one line break. A figure, its
 * caption and a rule are boundaries too, which `htmlToPlaintext` does not
 * know as blocks.
 *
 * @param {string} html
 * @param {import('./diff.js').DiffContext} ctx
 * @returns {string}
 */
function toPlaintext(html, ctx) {
  return ctx.htmlToPlaintext((html || '').replace(/<(figure|figcaption|hr)\b/gi, '<br><$1'))
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
 * among them need.
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
 * A rich text row reads as plaintext; an array item as its title (its
 * array's `titleField`, else its `title` field); a widget as its title (the
 * widget type's `titleField` option) or, for rich text, its plaintext;
 * the order of an array or area as its items in that order, each `#n`,
 * its position in the newer document, which tells items that read alike
 * apart, then its widget type and its title; any other row as its field's
 * text (`toText`).
 *
 * A row with `format` records (see `addFormat`) also gets `formatChanges`,
 * `FormatLine`s in the language of the admin UI: what changed, the words
 * affected, and the old and new value where there is one. A record is one
 * line; a link or an image is one for each attribute that changed; the
 * rules are one and the line breaks are one, last, with how many came and
 * went. Blocks
 * and marks go by the rich text editor's own labels, an image by its
 * title, with its URL when there is one in `urls`.
 *
 * @param {import('./diff.js').ChangeRow[]} rows Rows from `walk`, modified.
 * @param {import('./diff.js').DiffContext} ctx
 * @param {object} [options]
 * @param {Object<string, string>} [options.titles] Related document titles
 *   by id, for relationship rows (see `getRelatedIds`).
 * @param {Object<string, string>} [options.urls] Image URLs by id.
 * @param {Object<string, string>} [options.links] Document URLs by id,
 *   for internal links.
 * @returns {import('./diff.js').ChangeRow[]} The same rows.
 */
function addText(rows, ctx, {
  titles = {}, urls = {}, links = {}
} = {}) {
  for (const row of rows) {
    row.oldText = rowText(row, row.old, ctx, titles);
    row.newText = rowText(row, row.new, ctx, titles);
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

// One formatting change of rich text as lines of `formatChanges`: a line
// for most, one for each attribute that changed for a link or an image
function formatLines(record, ctx, {
  titles, urls, links
}) {
  const {
    kind, old, new: now
  } = record;
  const text = quote(record.text);
  const value = text => (text ? { text } : undefined);
  // An internal link reads as the document it links to
  const link = href => {
    const id = getPermalinkId(href);
    if (!id) {
      return value(href);
    }
    return {
      text: quote(titles[id]) || ctx.t('apostrophe:versionFormatInternalLink'),
      ...(links[id] && { url: links[id] })
    };
  };
  const image = (id, alt) => ({
    text: quote(titles[id] || alt) || ctx.t('apostrophe:image'),
    ...(urls[id] && { href: urls[id] })
  });
  // Without `type`, the sides that have a value say it
  const line = (label, {
    type, text: words = text, old: from, new: to, ...rest
  } = {}) => ({
    change: kind,
    type: type || ((from && to) ? 'modified' : (to ? 'added' : 'deleted')),
    label: ctx.t(label),
    ...(words && { text: words }),
    ...rest,
    ...(from && { old: from }),
    ...(to && { new: to })
  });
  const marks = list => value(list.map(mark => markLabel(mark, ctx)).join(', '));

  switch (kind) {
    case 'link': {
      const tab = link => value(ctx.t((link.target === '_blank')
        ? 'apostrophe:versionFormatLinkNewTab'
        : 'apostrophe:versionFormatLinkSameTab'
      ));
      const lines = [
        (old.href !== now.href) && line('apostrophe:richTextLink', {
          old: link(old.href),
          new: link(now.href)
        }),
        ((old.target === '_blank') !== (now.target === '_blank')) &&
          line('apostrophe:versionFormatLinkTarget', {
            old: tab(old),
            new: tab(now)
          })
      ].filter(Boolean);
      return lines.length
        ? lines
        : [ line('apostrophe:versionFormatLinkSettings', { type: 'modified' }) ];
    }
    case 'linkAdded':
    case 'linkRemoved':
      return [ line('apostrophe:richTextLink', {
        old: link(old),
        new: link(now)
      }) ];
    case 'marksAdded':
      return [ line('apostrophe:versionFormatting', { new: marks(now) }) ];
    case 'marksRemoved':
      return [ line('apostrophe:versionFormatting', { old: marks(old) }) ];
    case 'mark':
      return [ line(MARK_LABELS[now.name] || now.name, {
        old: value(old.value || markLabel(old, ctx)),
        new: value(now.value || markLabel(now, ctx))
      }) ];
    case 'anchor':
      return [ line('apostrophe:richTextAnchor', {
        old: value(old),
        new: value(now)
      }) ];
    case 'block':
    case 'style':
      return [ line('apostrophe:versionFormatBlock', {
        old: value(blockLabel(old, ctx)),
        new: value(blockLabel(now, ctx))
      }) ];
    case 'align':
      return [ line('apostrophe:versionFormatAlign', {
        old: value(alignLabel(old, ctx)),
        new: value(alignLabel(now, ctx))
      }) ];
    case 'merged':
      return [ line('apostrophe:versionFormatMerged', { type: 'modified' }) ];
    case 'split':
      return [ line('apostrophe:versionFormatSplit', { type: 'modified' }) ];
    case 'imageAdded':
      return [ line('apostrophe:image', {
        text: null,
        new: image(record.id, record.text)
      }) ];
    case 'imageRemoved':
      return [ line('apostrophe:image', {
        text: null,
        old: image(record.id, record.text)
      }) ];
    case 'imageReplaced':
      return [ line('apostrophe:image', {
        text: null,
        old: image(old.id, old.alt),
        new: image(now.id, now.alt)
      }) ];
    case 'image':
      // The line is about the image its `text` names
      return Object.keys(IMAGE_LABELS)
        .filter(key => old[key] !== now[key])
        .map(key => line(IMAGE_LABELS[key], {
          ...image(record.id, record.text),
          old: (key === 'href') ? link(old.href) : value(quote(old[key])),
          new: (key === 'href') ? link(now.href) : value(quote(now[key]))
        }));
    case 'ruleAdded':
    case 'ruleRemoved':
    case 'breakAdded':
    case 'breakRemoved':
      // Counted, see `countLines`
      return [];
    default:
      return [ line('apostrophe:versionFormatTable', { type: 'modified' }) ];
  }
}

// The rules and the line breaks that came and went as a line each, by
// their count: where each stood says little
function countLines(records, ctx) {
  const count = kind => records.filter(record => record.kind === kind).length;
  return [
    [ 'rule', 'apostrophe:versionFormatRules' ],
    [ 'break', 'apostrophe:versionFormatBreaks' ]
  ].flatMap(([ atom, label ]) => {
    const added = count(`${atom}Added`);
    const removed = count(`${atom}Removed`);
    if (!added && !removed) {
      return [];
    }
    return [ {
      change: `${atom}s`,
      type: (added && removed) ? 'modified' : (added ? 'added' : 'deleted'),
      label: ctx.t(label),
      ...(removed && {
        old: { text: ctx.t('apostrophe:versionFormatCountRemoved', { count: removed }) }
      }),
      ...(added && {
        new: { text: ctx.t('apostrophe:versionFormatCountAdded', { count: added }) }
      })
    } ];
  });
}

// The affected words as a line quotes them: on one line, cut short
function quote(text) {
  const line = (text || '').replace(/\s+/g, ' ').trim();
  return (line.length > QUOTE_LENGTH)
    ? `${line.slice(0, QUOTE_LENGTH).trimEnd()}…`
    : line;
}

// The `href`s a formatting record holds
function getLinks(record) {
  if ((record.kind === 'linkAdded') || (record.kind === 'linkRemoved')) {
    return [ record.old, record.new ];
  }
  if ((record.kind === 'link') || (record.kind === 'image')) {
    return [ record.old?.href, record.new?.href ];
  }
  return [];
}

// The `aposDocId` an internal link points to, `null` for any other `href`
function getPermalinkId(href) {
  return (typeof href === 'string') ? (href.match(PERMALINK)?.[1] || null) : null;
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
