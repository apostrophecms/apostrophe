// The formatting that changed between two versions of rich text markup:
// what the word marks of `rich-text-diff.js` cannot say. A pure function,
// like `diff.js`.

const { diffArrays } = require('diff');
const {
  INLINE, parse, getWords, compareTokens
} = require('./rich-text-tokens.js');

const ATOMS = {
  img: 'image',
  hr: 'rule',
  br: 'break'
};
const TABLE = new Set([
  'table', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'
]);
// Elements that hold blocks and say nothing of the kind of block a word
// stands in
const WRAPPERS = new Set([ ...TABLE, 'li', 'figure', 'figcaption' ]);
const MARKS = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  s: 'strike',
  u: 'underline',
  code: 'code',
  sub: 'subscript',
  sup: 'superscript',
  mark: 'highlight'
};

/**
 * A mark on words: `name` is `bold`, `italic`, `strike`, `underline`,
 * `code`, `subscript`, `superscript`, `highlight`, `color`, `style` (a
 * `span` with a class) or the tag name of any other inline element.
 *
 * @typedef {object} FormatMark
 * @property {string} name
 * @property {string} [tag] With `class`, when the element has one: the
 *   pair a configured style is known by.
 * @property {string} [class]
 * @property {string} [value] The colour of a `color` or `highlight` mark.
 */

/**
 * A block a word stands in, as a configured style names it.
 *
 * @typedef {object} FormatBlock
 * @property {string} tag
 * @property {string} [class]
 */

/**
 * One formatting change. `text` is the words affected, as `newer` has them.
 * By `kind`:
 *
 * - `link`: the link around the words changed; `old` and `new` are the
 *   attributes of the `a` element.
 * - `linkAdded`, `linkRemoved`: `new` or `old` is the `href`.
 * - `marksAdded`, `marksRemoved`: `new` or `old` is a `FormatMark[]`.
 * - `mark`: a mark the words keep changed its class or colour; `old` and
 *   `new` are `FormatMark`.
 * - `anchor`: `old` and `new` are the anchor id, one of them `undefined`
 *   when the anchor was added or removed.
 * - `block`: the words stand in another kind of block; `old` and `new`
 *   are `FormatBlock`, the outermost that differ (a list, not its items).
 * - `style`: the same tag with another class; `FormatBlock` again.
 * - `align`: `old` and `new` are the `text-align` value, `undefined` when
 *   the block sets none.
 * - `merged`, `split`: words of two blocks now stand in one, or the
 *   reverse; `text` runs from the seam to the end of the newer block.
 * - `imageAdded`, `imageRemoved`: `id` is the image's `aposDocId`, `text`
 *   its `alt`.
 * - `imageReplaced`: an image went and another came where it stood; `id`
 *   and `text` are the newer image's, `old` and `new` are `{ id, alt }`.
 * - `image`: `old` and `new` hold what changed of `alt`, `style` (the
 *   class of the `figure`) and `href`.
 * - `ruleAdded`, `ruleRemoved`, `breakAdded`, `breakRemoved`: no `text`.
 * - `table`: no `text`; once, last, whatever changed in however many
 *   tables.
 *
 * @typedef {object} FormatChange
 * @property {string} kind
 * @property {string} [text]
 * @property {string} [id]
 * @property {any} [old]
 * @property {any} [new]
 */

/**
 * The formatting changes from `older` to `newer`, in the reading order of
 * `newer`. The words both have are compared by what stands around them:
 * their marks, their link and anchor, the block they are in. Adjacent
 * words with the same change are one record, across added words and block
 * boundaries too. Images, rules and line breaks are compared as they
 * come and go.
 *
 * Added and removed words are left to the word marks and never compared.
 * So there is no record for a new bold word or a new paragraph, for a line
 * break that came or went with the words around it, or for a table that
 * came or went with its words. White space is never a record. Every
 * difference in the rows, cells and columns of tables is a single `table`
 * record.
 *
 * `[]` when no formatting changed, and when the text was rewritten at
 * length, where `rich-text-diff.js` gives up too.
 *
 * @param {string} older Markup of the older version.
 * @param {string} newer Markup of the newer version.
 * @returns {FormatChange[]}
 */
module.exports = function getFormatChanges(older, newer) {
  const before = flatten(older);
  const after = flatten(newer);
  const parts = compareTokens(before.tokens, after.tokens);
  if (!parts) {
    return [];
  }
  const records = [];
  // The records the next word may still join, by signature
  let open = new Map();
  // The newer text since the last word both sides have
  let gap = '';
  let holder = null;
  let previous = null;
  // The removed images that the images added next replace, one for one
  let replaced = [];
  let oldAt = 0;
  let newAt = 0;

  for (const [ index, part ] of parts.entries()) {
    const count = part.value.length;
    if (part.removed) {
      const tokens = before.tokens.slice(oldAt, oldAt + count);
      const next = parts[index + 1];
      const coming = next?.added
        ? after.tokens.slice(newAt, newAt + next.value.length).filter(isImage)
        : [];
      replaced = tokens.filter(isImage).slice(0, coming.length);
      addAtoms(tokens, 'Removed');
      oldAt += count;
    } else if (part.added) {
      const tokens = after.tokens.slice(newAt, newAt + count);
      addAtoms(tokens, 'Added');
      tokens.forEach(pass);
      newAt += count;
    } else {
      for (let i = 0; i < count; i++) {
        pair(before.tokens[oldAt + i], newAt + i);
      }
      oldAt += count;
      newAt += count;
    }
  }
  if (tablesChanged(before.tables, after.tables)) {
    records.push({ kind: 'table' });
  }
  return records;

  function addAtoms(tokens, suffix) {
    const hasWords = tokens.some(isWord);
    for (const token of tokens) {
      if (isImage(token)) {
        addImage(token, suffix);
      } else if (token.atom && ((token.atom === 'rule') || !hasWords)) {
        records.push({ kind: `${token.atom}${suffix}` });
      }
    }
  }

  function addImage(token, suffix) {
    if (replaced.includes(token)) {
      return;
    }
    const was = (suffix === 'Added') && replaced.shift();
    records.push(was
      ? record('imageReplaced', token.alt, {
        id: token.id,
        old: {
          id: was.id,
          alt: was.alt
        },
        new: {
          id: token.id,
          alt: token.alt
        }
      })
      : record(`image${suffix}`, token.alt, { id: token.id }));
  }

  // A newer token no older one stands against
  function pass(token) {
    space(token);
    gap += token.text ?? ' ';
  }

  // Words of different blocks do not run together in a record's text
  function space(token) {
    if (holder && (token.holder !== holder) && !/\s$/.test(gap)) {
      gap += ' ';
    }
    holder = token.holder;
  }

  function pair(one, at) {
    const two = after.tokens[at];
    if (!isWord(two)) {
      if (two.atom === 'image') {
        const found = compareImage(one, two);
        found && records.push(found);
      }
      return pass(two);
    }
    space(two);
    if (previous) {
      const wasOne = previous.one.holder === one.holder;
      const isOne = previous.two.holder === two.holder;
      if (wasOne !== isOne) {
        records.push(record(isOne ? 'merged' : 'split', restOf(after.tokens, at)));
      }
    }
    previous = {
      one,
      two
    };
    const still = new Map();
    for (const change of compare(one, two)) {
      const signature = JSON.stringify(change);
      let found = open.get(signature);
      if (found) {
        found.text += gap + two.text;
      } else {
        found = record(change.kind, two.text, change);
        records.push(found);
      }
      still.set(signature, found);
    }
    open = still;
    gap = '';
  }
};

function record(kind, text, {
  id, old, new: now
} = {}) {
  const found = {
    kind,
    text
  };
  if (id !== undefined) {
    found.id = id;
  }
  if (old !== undefined) {
    found.old = old;
  }
  if (now !== undefined) {
    found.new = now;
  }
  return found;
}

function isImage(token) {
  return token.atom === 'image';
}

function isWord(token) {
  return Boolean(token.text?.trim());
}

// The text from the token at `at` to the end of its block
function restOf(tokens, at) {
  let text = '';
  for (let i = at; tokens[i]?.holder === tokens[at].holder; i++) {
    text += tokens[i].text ?? ' ';
  }
  return text.trim();
}

// What differs around one word both sides have, as `{ kind, old, new }`
function compare(one, two) {
  return [
    ...compareBlocks(one.blocks, two.blocks),
    ...compareLink(one.link, two.link),
    ...compareAnchor(one.anchor, two.anchor),
    ...compareMarks(one.marks, two.marks)
  ];
}

// One record for the kind of block, never one for every level: a bulleted
// list that became an ordered one changed the list, not its paragraphs
function compareBlocks(older, newer) {
  const changes = [];
  const oldTags = older.map(block => block.tag);
  const newTags = newer.map(block => block.tag);
  if (oldTags.join('>') !== newTags.join('>')) {
    let at = 0;
    const last = Math.min(older.length, newer.length) - 1;
    while ((oldTags[at] === newTags[at]) && (at < last)) {
      at++;
    }
    changes.push({
      kind: 'block',
      old: named(older[Math.min(at, older.length - 1)]),
      new: named(newer[Math.min(at, newer.length - 1)])
    });
  } else {
    for (let at = newer.length - 1; at >= 0; at--) {
      if (older[at].class !== newer[at].class) {
        changes.push({
          kind: 'style',
          old: named(older[at]),
          new: named(newer[at])
        });
        break;
      }
    }
  }
  const oldAlign = older.at(-1)?.align;
  const newAlign = newer.at(-1)?.align;
  if (oldAlign !== newAlign) {
    changes.push({
      kind: 'align',
      old: oldAlign,
      new: newAlign
    });
  }
  return changes;

  function named(block) {
    return block && clean({
      tag: block.tag,
      class: block.class
    });
  }
}

function compareLink(older, newer) {
  if (!older && !newer) {
    return [];
  }
  if (!older || !newer) {
    return [ {
      kind: older ? 'linkRemoved' : 'linkAdded',
      old: older?.href,
      new: newer?.href
    } ];
  }
  return same(older, newer)
    ? []
    : [ {
      kind: 'link',
      old: older,
      new: newer
    } ];
}

function compareAnchor(older, newer) {
  return (older === newer)
    ? []
    : [ {
      kind: 'anchor',
      old: older,
      new: newer
    } ];
}

function compareMarks(older, newer) {
  const changes = [];
  const added = newer.filter(mark => !older.some(other => other.name === mark.name));
  const removed = older.filter(mark => !newer.some(other => other.name === mark.name));
  if (added.length) {
    changes.push({
      kind: 'marksAdded',
      new: added
    });
  }
  if (removed.length) {
    changes.push({
      kind: 'marksRemoved',
      old: removed
    });
  }
  for (const mark of newer) {
    const was = older.find(other => other.name === mark.name);
    if (was && !same(was, mark)) {
      changes.push({
        kind: 'mark',
        old: was,
        new: mark
      });
    }
  }
  return changes;
}

function compareImage(older, newer) {
  const keys = [ 'alt', 'style', 'href' ].filter(key => older[key] !== newer[key]);
  if (!keys.length) {
    return null;
  }
  const pick = token => Object.fromEntries(
    keys.filter(key => token[key] !== undefined).map(key => [ key, token[key] ])
  );
  return record('image', newer.alt, {
    id: newer.id,
    old: pick(older),
    new: pick(newer)
  });
}

// A table that came or went with its words is told by them; one that
// changed, or came or went empty, is not
function tablesChanged(older, newer) {
  const parts = diffArrays(older, newer, {
    comparator: (one, two) => one.skeleton === two.skeleton
  });
  const changed = part => part && (part.added || part.removed);
  return parts.some((part, at) => changed(part) && (
    part.value.some(table => !table.words) ||
    changed(parts[at - 1]) ||
    changed(parts[at + 1])
  ));
}

// The markup as `tokens`, one for every word, run of white space and
// punctuation mark, each with what stands around it, and one for every
// image, rule and line break; and its `tables`, each as the `skeleton` of
// its rows, cells and columns. Two tokens are the same when their `key` is
function flatten(html) {
  const $ = parse(html);
  const tokens = [];
  const tables = [];
  visit($.root()[0].children, {
    blocks: [],
    marks: [],
    holder: null
  });
  return {
    tokens,
    tables
  };

  function visit(nodes, context) {
    for (const node of nodes) {
      if (node.type === 'text') {
        for (const word of getWords(node.data)) {
          tokens.push({
            ...word,
            ...context
          });
        }
        continue;
      }
      if (node.type !== 'tag') {
        continue;
      }
      const tag = node.name;
      if (ATOMS[tag]) {
        tokens.push(getAtom(node, context));
      } else if (INLINE.has(tag)) {
        visit(node.children, getInline(node, context));
      } else {
        if ((tag === 'table') && !context.table) {
          tables.push({
            skeleton: getSkeleton(node),
            words: Boolean($(node).text().trim())
          });
        }
        visit(node.children, {
          ...context,
          holder: node,
          blocks: isWrapper(node)
            ? context.blocks
            : [ ...context.blocks, getBlock(node) ],
          figure: (tag === 'figure') ? node : context.figure,
          table: context.table || (tag === 'table')
        });
      }
    }
  }
}

function getAtom(node, context) {
  const atom = ATOMS[node.name];
  if (atom !== 'image') {
    return {
      key: `<${atom}`,
      atom,
      holder: context.holder
    };
  }
  const src = node.attribs.src || '';
  const id = src.match(/\/([^/]+)\/src(?:[?#]|$)/)?.[1] || src;
  return {
    key: `<image ${id}`,
    atom,
    holder: context.holder,
    id,
    alt: node.attribs.alt || '',
    style: context.figure?.attribs.class,
    href: context.link?.href
  };
}

// The context of the words inside an inline element
function getInline(node, context) {
  const {
    id, style, class: className
  } = node.attribs;
  if (node.name === 'a') {
    return {
      ...context,
      link: { ...node.attribs }
    };
  }
  if ((node.name === 'code') && (node.parent?.name === 'pre')) {
    return context;
  }
  const marks = [];
  if (node.name === 'span') {
    const color = style?.match(/(?:^|;)\s*color:\s*([^;]+)/)?.[1].trim();
    if (color) {
      marks.push({
        name: 'color',
        value: color
      });
    }
    if (className) {
      marks.push({
        name: 'style',
        tag: 'span',
        class: className
      });
    }
  } else {
    marks.push(clean({
      name: MARKS[node.name] || node.name,
      tag: className && node.name,
      class: className,
      value: (node.name === 'mark')
        ? (node.attribs['data-color'] || style)
        : undefined
    }));
  }
  return {
    ...context,
    anchor: ((node.name === 'span') && id) || context.anchor,
    marks: [ ...context.marks, ...marks ]
  };
}

function getBlock(node) {
  return {
    tag: node.name,
    class: node.attribs.class,
    align: node.attribs.style?.match(/(?:^|;)\s*text-align:\s*([a-z-]+)/)?.[1]
  };
}

function isWrapper(node) {
  return WRAPPERS.has(node.name) ||
    ((node.name === 'div') && /\btableWrapper\b/.test(node.attribs.class || ''));
}

function getSkeleton(node) {
  if (node.type !== 'tag') {
    return '';
  }
  const inner = node.children.map(getSkeleton).join('');
  if (!TABLE.has(node.name)) {
    return inner;
  }
  const attributes = Object.entries(node.attribs)
    .sort(([ one ], [ two ]) => one.localeCompare(two))
    .map(([ name, value ]) => ` ${name}="${value}"`)
    .join('');
  return `<${node.name}${attributes}>${inner}</${node.name}>`;
}

function same(one, two) {
  return JSON.stringify(Object.entries(one).sort()) ===
    JSON.stringify(Object.entries(two).sort());
}

function clean(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([ , value ]) => value !== undefined)
  );
}
