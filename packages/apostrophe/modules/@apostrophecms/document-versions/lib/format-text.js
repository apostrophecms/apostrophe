// The formatting changes of rich text in words, for reading a change: what
// `addText` of `text.js` sets as a row's `formatChanges`. Pure functions,
// like `diff.js`.

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

module.exports = {
  formatLines,
  countLines,
  getLinks,
  getPermalinkId
};

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
