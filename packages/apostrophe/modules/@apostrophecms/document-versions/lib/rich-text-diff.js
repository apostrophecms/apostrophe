// The text that changed between two versions of rich text markup, marked
// inside the newer markup. A pure function, like `diff.js`.

const cheerio = require('cheerio');
const { diffArrays, wordsWithSpaceDiff } = require('diff');

const ATTRIBUTE = 'data-apos-version-change';
const HIDDEN_CLASS = 'apos-sr-only';
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr'
]);
// Elements that flow with the text around them. A boundary of any other
// element separates words
const INLINE = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i',
  'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup',
  'time', 'u', 'var'
]);
// Elements that may not hold text or a `del` of their own
const NO_TEXT = new Set([
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'ul', 'ol', 'dl'
]);
// The most tokens the two sides may differ by. Past it the comparison costs
// more than a request can take and the marks more than a reader can
const MAX_EDIT_LENGTH = 2000;

/**
 * The newer markup with the text that changed marked in it: text `older`
 * had and `newer` does not in a `del`, where it was, and text only `newer`
 * has in an `ins`, word by word. Each mark carries
 * `data-apos-version-change` (`removed` or `added`) and opens with a
 * visually hidden `span` (class `apos-sr-only`) saying so, for screen
 * readers, as the marks of the change list do.
 *
 * The elements are those of `newer`, untouched. An element of `older` comes
 * back only when it went with all of its text and the element it stood in
 * is still there; otherwise its text stands alone in its `del`. Images and
 * other elements without text are never marked.
 *
 * `null` when no text changed, so that the markup differs by attributes,
 * marks or structure only; when removed text has no place to go (the
 * rows or cells of a table that was rebuilt, the items of a list that
 * became something else); and when the text was rewritten at length, about
 * a thousand words. The caller marks the whole widget as modified.
 *
 * @param {string} older Markup of the older version.
 * @param {string} newer Markup of the newer version.
 * @param {object} [options]
 * @param {{ removed?: string, added?: string }} [options.labels] The
 *   hidden text that opens a mark. A label left out adds no `span`.
 * @returns {string|null}
 */
module.exports = function diffRichText(older, newer, { labels = {} } = {}) {
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
};

// Shared with `rich-text-format.js`, which reads the same markup
module.exports.INLINE = INLINE;
module.exports.MAX_EDIT_LENGTH = MAX_EDIT_LENGTH;

function hidden(label) {
  return label
    ? `<span class="${HIDDEN_CLASS}">${escapeText(label)} </span>`
    : '';
}

// The markup as a flat list: `open`, `close` and `void` tokens for the
// elements, `text` tokens for every word, run of white space and
// punctuation mark. Two tokens are the same when their `key` is
function tokenize(html) {
  const $ = cheerio.load(html || '', null, false);
  const tokens = [];
  visit($.root()[0].children);
  return tokens;

  function visit(nodes) {
    for (const node of nodes) {
      if (node.type === 'text') {
        for (const text of wordsWithSpaceDiff.tokenize(node.data)) {
          tokens.push({
            kind: 'text',
            key: `"${text}`,
            text,
            html: escapeText(text)
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
          key: open,
          tag: node.name,
          html: open
        });
        continue;
      }
      tokens.push({
        kind: 'open',
        key: open,
        tag: node.name,
        html: open
      });
      visit(node.children);
      tokens.push({
        kind: 'close',
        key: `</${node.name}>`,
        tag: node.name,
        html: `</${node.name}>`
      });
    }
  }
}

// The two token lists compared, as regions in reading order: `{ same }`,
// pairs of equal tokens, or `{ removed, added }`, what stands between two
// such runs on either side. White space alone between two changes joins
// them, so that a rewritten phrase is one mark, not one for every word.
// `undefined` past `MAX_EDIT_LENGTH`
function getOps(older, newer) {
  const parts = diffArrays(older, newer, {
    comparator: (one, two) => one.key === two.key,
    maxEditLength: MAX_EDIT_LENGTH
  });
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
  return joined;
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
