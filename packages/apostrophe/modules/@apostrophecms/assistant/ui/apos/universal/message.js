// An editor's message, read the same way on the server and in the panel:
// text with a `@[title](kind:id)` token for each mention, and the title a
// new chat takes from it. The panel shows it in blocks of text, code and
// quotes, with no HTML.
//
// This is an ES module: the panel imports it, the server `require()`s it
// (Node 22.12+).

const TOKEN = /@\[((?:\\.|[^\]\\])*)\]\(([a-z-]+):([^)\s]+)\)/g;
const TITLE_MAX = 60;
const FENCE = /^```/;
const QUOTE = /^>[ \t]?/;

/**
 * The text with each mention token replaced.
 *
 * @param {string} text
 * @param {Function} replace Takes `{ title, kind, id }`, the title
 *   unescaped, and returns the token's text.
 * @returns {string}
 */
export function replaceMentions(text, replace) {
  return (text || '').replace(TOKEN, (token, title, kind, id) => replace({
    title: unescapeTitle(title),
    kind,
    id
  }));
}

/**
 * The text and the mentions of a message, in order.
 *
 * @param {string} text
 * @returns {Array<{ text: string } | { mention: object }>} A mention has
 *   `id`, `title` and `kind`.
 */
export function parseMentions(text) {
  const parts = [];
  const source = text || '';
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    if (match.index > last) {
      parts.push({ text: source.slice(last, match.index) });
    }
    parts.push({
      mention: {
        title: unescapeTitle(match[1]),
        kind: match[2],
        id: match[3]
      }
    });
    last = match.index + match[0].length;
  }
  if (last < source.length) {
    parts.push({ text: source.slice(last) });
  }
  return parts;
}

export function mentionToken({
  id, title, kind
}) {
  return `@[${(title || '').replace(/[\]\\]/g, '\\$&')}](${kind}:${id})`;
}

// A message as plain text, each mention its title after an `@`
export function getPlainMessage(text) {
  return replaceMentions(text, ({ title }) => `@${title}`);
}

/**
 * The title a new chat takes from its first message until the model names
 * it: the plain text cut to 60 characters at a word boundary. Empty for a
 * message with no text.
 *
 * @param {string} message
 * @returns {string}
 */
export function getFirstTitle(message) {
  const clean = getPlainMessage(message).replace(/\s+/g, ' ').trim();
  if (clean.length <= TITLE_MAX) {
    return clean;
  }
  const cut = clean.slice(0, TITLE_MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${space > 0 ? cut.slice(0, space) : cut}…`;
}

/**
 * An editor's message in blocks, as the panel shows it. A line starting
 * with three backticks opens a code block and the next one closes it; an
 * unclosed one runs to the end. Consecutive lines starting with `>` are a
 * quote. Anything else is text, its line breaks kept. Nothing nests.
 *
 * @param {string} message
 * @returns {Array<{ type: 'text'|'code'|'quote', text: string }>}
 */
export function splitBlocks(message) {
  const blocks = [];
  let block = null;
  for (const line of (message || '').split('\n')) {
    if (block?.type === 'code') {
      if (FENCE.test(line)) {
        block = null;
      } else {
        block.lines.push(line);
      }
      continue;
    }
    if (FENCE.test(line)) {
      block = {
        type: 'code',
        lines: []
      };
      blocks.push(block);
      continue;
    }
    const type = QUOTE.test(line) ? 'quote' : 'text';
    if (block?.type !== type) {
      block = {
        type,
        lines: []
      };
      blocks.push(block);
    }
    block.lines.push((type === 'quote') ? line.replace(QUOTE, '') : line);
  }
  return blocks
    .map(({ type, lines }) => ({
      type,
      // A block's spacing comes from the panel, not from blank lines
      // around it
      text: (type === 'code') ? lines.join('\n') : lines.join('\n').replace(/^\n+|\n+$/g, '')
    }))
    .filter(each => (each.type === 'code') || each.text);
}

function unescapeTitle(title) {
  return title.replace(/\\(.)/g, '$1');
}
