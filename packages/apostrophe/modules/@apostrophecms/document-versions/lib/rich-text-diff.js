// The text that changed between two versions of rich text markup, marked
// inside the newer markup or listed as text. Pure functions, like `diff.js`.

const {
  INLINE, MARKS, FOLDED_MARKS, parse, getWords, compareTokens, isWrapper
} = require('./rich-text-tokens.js');

const ATTRIBUTE = 'data-apos-version-change';
const HIDDEN_CLASS = 'apos-sr-only';
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr'
]);
// Elements that may not hold text or a `del` of their own
const NO_TEXT = new Set([
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'ul', 'ol', 'dl'
]);

module.exports = {
  diffRichText,
  getTextParts
};

/**
 * The newer markup with the changed text marked in it, word by word:
 * removed text in a `del` where it was, added text in an `ins`. Each mark
 * carries `data-apos-version-change` (`removed` or `added`) and opens with
 * a visually hidden `span` (class `apos-sr-only`) saying so for screen
 * readers, as the marks of the change list do.
 *
 * A word is the same only in the same form: a word that turned bold or
 * italic, or that stands in another kind of block, is removed as it was and
 * added as it is. The blocks on either side of a split or a merge are
 * removed whole and added whole.
 *
 * The elements are those of `newer`, untouched. A removed element comes
 * back only when it went with all of its text and its parent is still
 * there; otherwise its text stands alone in its `del`. Images and other
 * elements without text are never marked.
 *
 * `null`, for the caller to mark the whole widget as modified, when:
 * - no text changed (attributes, alignment, links, images or marks other
 *   than bold and italic only);
 * - removed text has no place to go: a rebuilt table;
 * - the text was rewritten at length, about a thousand words.
 *
 * @param {string} older Markup of the older version.
 * @param {string} newer Markup of the newer version.
 * @param {object} [options]
 * @param {{ removed?: string, added?: string }} [options.labels] The
 *   hidden text that opens a mark. A label left out adds no `span`.
 * @returns {string|null}
 */
function diffRichText(older, newer, { labels = {} } = {}) {
  const ops = getOps(tokenize(older), tokenize(newer));
  if (!ops) {
    return null;
  }
  // The elements open in the output, and those open in `older`, each with
  // the output element standing for it (`null` when it was dropped)
  const out = [];
  const old = [];
  let html = '';
  let marks = 0;
  let pending = '';
  let pendingChange = null;
  let failed = false;

  for (const region of ops) {
    if (region.same) {
      for (const { newer: token } of region.same) {
        emit(token);
        if (token.kind === 'open') {
          const entry = { tag: token.tag };
          out.push(entry);
          old.push({ out: entry });
        } else if (token.kind === 'close') {
          out.pop();
          old.pop();
        }
      }
      continue;
    }
    removeAll(region.removed);
    for (const token of region.added) {
      if (token.kind === 'text') {
        mark('added', token.text);
        continue;
      }
      emit(token);
      if (token.kind === 'open') {
        out.push({ tag: token.tag });
      } else if (token.kind === 'close') {
        out.pop();
      }
    }
    flush();
    if (failed) {
      return null;
    }
  }
  return marks ? html : null;

  function removeAll(tokens) {
    const kept = getWholeElements(tokens);
    tokens.forEach((token, index) => {
      if (token.kind === 'text') {
        return mark('removed', token.text);
      }
      const top = out.at(-1);
      if (token.kind === 'void') {
        return top?.removed && emit(token);
      }
      if (token.kind === 'open') {
        const parent = old.at(-1);
        const inPlace = parent ? (parent.out === top) : !top;
        const entry = (kept.has(index) && inPlace)
          ? {
            tag: token.tag,
            removed: true
          }
          : null;
        old.push({ out: entry });
        if (entry) {
          emit(token);
          out.push(entry);
        } else {
          separate(token);
        }
        return;
      }
      if (old.pop()?.out?.removed) {
        emit(token);
        out.pop();
      } else {
        separate(token);
      }
    });
    flush();
  }

  // Removed text on either side of a block that was dropped does not run
  // together
  function separate(token) {
    flush();
    if (!INLINE.has(token.tag) && html.endsWith('</del>')) {
      html += ' ';
    }
  }

  function emit(token) {
    flush();
    html += token.html;
  }

  function mark(change, text) {
    if (pendingChange !== change) {
      flush();
    }
    pendingChange = change;
    pending += text;
  }

  function flush() {
    const text = pending;
    const change = pendingChange;
    pending = '';
    pendingChange = null;
    if (!text.trim()) {
      // White space alone is no change to show. Removed, it still keeps the
      // words around it apart
      if ((change === 'added') || (text && !/\s$/.test(html))) {
        html += escapeText(text);
      }
      return;
    }
    if ((change === 'removed') && NO_TEXT.has(out.at(-1)?.tag)) {
      failed = true;
      return;
    }
    marks++;
    const tag = (change === 'removed') ? 'del' : 'ins';
    html += `<${tag} ${ATTRIBUTE}="${change}">` +
      hidden(labels[change]) +
      escapeText(text) +
      `</${tag}>`;
  }
}

/**
 * The comparison of `diffRichText` as text: `{ text, change }` parts in
 * reading order, `change` being `same`, `added` or `removed`, with a line
 * break wherever a block starts or ends, as the plaintext of rich text has
 * them (runs of them one, none at either end). White space alone is never
 * a change. A part in bold or italic says so in `marks`
 * (`[ 'bold', 'italic' ]`).
 *
 * `null` when no text changed (see `diffRichText`) and when the text was
 * rewritten at length.
 *
 * @param {string} older Markup of the older version.
 * @param {string} newer Markup of the newer version.
 * @returns {Array<{
 *   text: string,
 *   change: string,
 *   marks?: string[]
 * }>|null}
 */
function getTextParts(older, newer) {
  const ops = getOps(tokenize(older), tokenize(newer));
  if (!ops) {
    return null;
  }
  const parts = [];
  let changed = false;
  for (const region of ops) {
    if (region.same) {
      region.same.forEach(({ newer: token }) => add(token, 'same'));
      continue;
    }
    region.removed.forEach(token => add(token, 'removed'));
    region.added.forEach(token => add(token, 'added'));
  }
  if (!changed) {
    return null;
  }
  const last = parts.at(-1);
  last.text = last.text.trimEnd();
  return parts.filter(part => part.text);

  function add(token, change) {
    if (token.kind === 'text') {
      return addText(token, change);
    }
    if (!INLINE.has(token.tag) && (token.tag !== 'img')) {
      addBreak();
    }
  }

  function addText({ text, marks }, change) {
    const last = parts.at(-1);
    const lineStart = !last || /\n$/.test(last.text);
    if (!text.trim()) {
      // Joins the changed words around it, or keeps apart the words it
      // stood between
      if (lineStart) {
        return;
      }
      if ((change !== 'same') && (last.change === change)) {
        last.text += text;
      } else if ((change !== 'removed') || !/\s$/.test(last.text)) {
        addPart(text, 'same', last.marks);
      }
      return;
    }
    if (change !== 'same') {
      changed = true;
    }
    addPart(
      lineStart ? text.trimStart() : text,
      change,
      marks.length ? marks : undefined
    );
  }

  function addPart(text, change, marks) {
    const last = parts.at(-1);
    if (last && (last.change === change) && sameMarks(last.marks, marks)) {
      last.text += text;
      return;
    }
    parts.push({
      text,
      change,
      ...(marks && { marks })
    });
  }

  function addBreak() {
    const last = parts.at(-1);
    if (!last || /\n$/.test(last.text)) {
      return;
    }
    if (last.change === 'same') {
      last.text = `${last.text.trimEnd()}\n`;
    } else {
      parts.push({
        text: '\n',
        change: 'same'
      });
    }
  }
}

function sameMarks(one, two) {
  return (one || []).join() === (two || []).join();
}

function hidden(label) {
  return label
    ? `<span class="${HIDDEN_CLASS}">${escapeText(label)} </span>`
    : '';
}

// The markup as a flat list: `open`, `close` and `void` tokens for the
// elements, `text` tokens for every word, run of white space and
// punctuation mark. Two tokens are the same when their `key` is: a word's
// holds its bold and italic and the kinds of block it stands in, a block's
// tags the kinds of block around it, so that each is the same only in the
// same form. Their `plain` key leaves the form out. Every token knows its
// `holder`, the number of the innermost element around it that is not
// inline (for the tags of such an element, the element itself)
function tokenize(html) {
  const $ = parse(html);
  const tokens = [];
  let count = 0;
  visit($.root()[0].children, {
    holder: 0,
    blocks: '',
    marks: []
  });
  return tokens;

  function visit(nodes, context) {
    for (const node of nodes) {
      if (node.type === 'text') {
        for (const word of getWords(node.data)) {
          const form = word.text.trim()
            ? `|${context.marks.join()}|${context.blocks}`
            : '';
          tokens.push({
            kind: 'text',
            ...word,
            plain: word.key,
            key: `${word.key}${form}`,
            holder: context.holder,
            marks: context.marks,
            html: escapeText(word.text)
          });
        }
        continue;
      }
      if (node.type !== 'tag') {
        continue;
      }
      const attributes = Object.entries(node.attribs)
        .map(([ name, value ]) => ` ${name}="${escapeAttribute(value)}"`)
        .join('');
      const open = `<${node.name}${attributes}>`;
      if (VOID.has(node.name)) {
        tokens.push({
          kind: 'void',
          plain: open,
          key: open,
          tag: node.name,
          holder: context.holder,
          html: open
        });
        continue;
      }
      const inner = getContext(node, context);
      const isBlock = inner.holder !== context.holder;
      // A block in another kind of block is another block
      const form = isBlock ? `|${context.blocks}` : '';
      tokens.push({
        kind: 'open',
        plain: open,
        key: `${open}${form}`,
        tag: node.name,
        holder: inner.holder,
        html: open
      });
      visit(node.children, inner);
      tokens.push({
        kind: 'close',
        plain: `</${node.name}>`,
        // The end of a block is that of the same block
        key: isBlock ? `</${node.name}>${form}${open}` : `</${node.name}>`,
        tag: node.name,
        holder: inner.holder,
        html: `</${node.name}>`
      });
    }
  }

  // What stands around the words inside an element
  function getContext(node, context) {
    if (INLINE.has(node.name)) {
      const mark = MARKS[node.name];
      return (FOLDED_MARKS.has(mark) && !context.marks.includes(mark))
        ? {
          ...context,
          marks: [ ...context.marks, mark ].sort()
        }
        : context;
    }
    return {
      ...context,
      holder: ++count,
      blocks: isWrapper(node)
        ? context.blocks
        : `${context.blocks}>${node.name}.${node.attribs.class || ''}`
    };
  }
}

// The two token lists compared, as regions in reading order: `{ same }`,
// pairs of equal tokens, or `{ removed, added }`, what stands between two
// such runs on either side. White space alone between two changes joins
// them, so that a rewritten phrase is one mark, not one for every word.
// `undefined` when `compareTokens` gives up
function getOps(older, newer) {
  const parts = compare(older, newer);
  if (!parts) {
    return;
  }
  const regions = [];
  let oldAt = 0;
  let newAt = 0;
  for (const part of parts) {
    const count = part.value.length;
    let region = regions.at(-1);
    if (part.added || part.removed) {
      if (!region || region.same) {
        region = {
          removed: [],
          added: []
        };
        regions.push(region);
      }
      if (part.added) {
        region.added.push(...newer.slice(newAt, newAt + count));
        newAt += count;
      } else {
        region.removed.push(...older.slice(oldAt, oldAt + count));
        oldAt += count;
      }
      continue;
    }
    const same = part.value.map((token, index) => ({
      older: older[oldAt + index],
      newer: newer[newAt + index]
    }));
    oldAt += count;
    newAt += count;
    regions.push({ same });
  }
  const joined = regions.reduce((joined, region, index) => {
    const last = joined.at(-1);
    const isSpace = region.same?.every(({ newer: token }) => {
      return (token.kind === 'text') && !token.text.trim();
    });
    if (isSpace && last && !last.same && regions[index + 1] && !regions[index + 1].same) {
      last.removed.push(...region.same.map(pair => pair.older));
      last.added.push(...region.same.map(pair => pair.newer));
    } else if (last && !last.same && !region.same) {
      last.removed.push(...region.removed);
      last.added.push(...region.added);
    } else {
      joined.push(region);
    }
    return joined;
  }, []);
  joined.forEach((region, index) => {
    if (region.removed?.length && !region.added.length) {
      settle(region, joined[index - 1], joined[index + 1]);
    }
  });
  // A removal settled against an addition is one change with it, the
  // removed text first
  return joined.reduce((settled, region) => {
    const last = settled.at(-1);
    if (region.same && !region.same.length) {
      return settled;
    }
    if (last && !last.same && !region.same) {
      last.removed.push(...region.removed);
      last.added.push(...region.added);
    } else {
      settled.push(region);
    }
    return settled;
  }, []);
}

// The two token lists compared by `key` (see `compareTokens`), the blocks on
// either side of a split or a merge first set apart, their tokens made to
// match nothing, so that they show as removed and added whole. The seams
// are found as `rich-text-format.js` finds them, on the `plain` keys: words
// that stand in two blocks on one side and in one on the other
function compare(older, newer) {
  const plain = tokens => tokens.map(token => ({ key: token.plain }));
  const parts = compareTokens(plain(older), plain(newer));
  if (!parts) {
    return;
  }
  const seams = {
    older: new Set(),
    newer: new Set()
  };
  let previous = null;
  let oldAt = 0;
  let newAt = 0;
  for (const part of parts) {
    const count = part.value.length;
    if (part.added) {
      newAt += count;
      continue;
    }
    if (part.removed) {
      oldAt += count;
      continue;
    }
    for (let i = 0; i < count; i++) {
      const one = older[oldAt + i];
      const two = newer[newAt + i];
      if ((one.kind !== 'text') || !one.text.trim()) {
        continue;
      }
      if (previous) {
        const wasOne = previous.one.holder === one.holder;
        const isOne = previous.two.holder === two.holder;
        if (wasOne !== isOne) {
          seams.older.add(previous.one.holder).add(one.holder);
          seams.newer.add(previous.two.holder).add(two.holder);
        }
      }
      previous = {
        one,
        two
      };
    }
    oldAt += count;
    newAt += count;
  }
  const setApart = (tokens, holders, side) => tokens
    .filter(token => holders.has(token.holder))
    .forEach(token => {
      token.key = `${token.key}|${side}`;
    });
  setApart(older, seams.older, 'older');
  setApart(newer, seams.newer, 'newer');
  return compareTokens(older, newer);
}

// A removal can sit anywhere along the tokens that repeat around it: dropping
// the middle of `<p>A</p><p>B</p><p>C</p>` can come out as `B</p><p>` as well
// as `<p>B</p>`. Moves the removal back over those equal tokens until it
// covers whole elements
function settle(region, before, after) {
  if (!before?.same || !after?.same || isWhole(region.removed)) {
    return;
  }
  let run = region.removed;
  for (let count = 1; count <= before.same.length; count++) {
    const pair = before.same.at(-count);
    if (pair.older.key !== run.at(-1).key) {
      return;
    }
    run = [ pair.older, ...run.slice(0, -1) ];
    if (isWhole(run)) {
      const passed = region.removed.slice(-count);
      after.same.unshift(...before.same.splice(-count).map((moved, at) => ({
        older: passed[at],
        newer: moved.newer
      })));
      region.removed = run;
      return;
    }
  }
}

// Whether the tokens are elements from their opening to their closing tag
function isWhole(tokens) {
  let depth = 0;
  for (const token of tokens) {
    depth += (token.kind === 'open') ? 1 : (token.kind === 'close') ? -1 : 0;
    if ((depth < 0) || (!depth && (token.kind === 'text'))) {
      return false;
    }
  }
  return !depth;
}

// The indexes of the `open` tokens, among removed `tokens`, of the elements
// that went whole, their closing tag among the tokens too, and had text
function getWholeElements(tokens) {
  const whole = new Set();
  const open = [];
  tokens.forEach((token, index) => {
    if (token.kind === 'open') {
      open.push({
        index,
        text: false
      });
    } else if (token.kind === 'close') {
      const element = open.pop();
      if (element?.text) {
        whole.add(element.index);
      }
      if (element?.text && open.length) {
        open.at(-1).text = true;
      }
    } else if ((token.kind === 'text') && token.text.trim()) {
      if (open.length) {
        open.at(-1).text = true;
      }
    }
  });
  return whole;
}

function escapeText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}
