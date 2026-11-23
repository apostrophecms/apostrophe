// What `read_attachment` makes of a file's text: HTML and SVG trimmed of
// noise only (scripts, path data, base64 data URLs, comments, extra
// whitespace), CSS trimmed, token files checked by shape, long text and
// long token lists read in parts, and the main colors of an image measured.
//
// A file is attached by anyone who may upload, and is read on the thread
// that serves the site, so nothing here takes more than one pass over it:
// no pattern that can be matched in more than one way, no search that
// starts over from each match, and markup parsed as written, by a parser
// whose one costly case, nesting, is refused past `MAX_DEPTH`.

const {
  Parser, DomHandler, DomUtils
} = require('htmlparser2');

// Elements inside one another in markup: far past any real page
const MAX_DEPTH = 512;
// About 20,000 tokens of markup
const PART_CHARS = 40000;
// Where a part may end early to end on whitespace
const PART_SLACK = 2000;
const TOKENS_PER_PART = 300;
const COLORS_MAX = 8;
// The least share of the pixels a main color covers
const COLOR_MIN_SHARE = 0.02;
// A parameter's name and value are told apart by its `=` alone, so a
// header with no comma is given up in one pass
const DATA_URL = /data:([\w.+-]+\/[\w.+-]+)?((?:;[\w.+-]+(?:=[\w.+-]*)?)*),[^"'()\s]+/g;
// Attributes holding shapes as numbers, by element
const SHAPE_ATTRIBUTES = {
  path: 'd',
  polygon: 'points',
  polyline: 'points'
};

module.exports = {
  PART_CHARS,
  prepare,
  trimHtml,
  trimSvg,
  trimCss,
  readTokens,
  getPart,
  getTokensPart,
  measureColors
};

/**
 * What the part reads of a file work from: its text trimmed by its kind,
 * or the tokens of a token file.
 *
 * @param {string} kind `html`, `svg`, `css`, `tokens` or `markdown`.
 * @param {string} text The file as stored.
 * @returns {{ text: string, format?: string }|{ format: string, tokens:
 *   object[] }} `format` for a token file: its shape, or `json` with the
 *   file's text when it has none. Throws a `SyntaxError` for a token file
 *   that is not JSON, and an error named `nesting` for markup nested too
 *   deeply to read.
 */
function prepare(kind, text) {
  if (kind === 'html') {
    return { text: trimHtml(text) };
  }
  if (kind === 'svg') {
    return { text: trimSvg(text) };
  }
  if (kind === 'css') {
    return { text: trimCss(text) };
  }
  if (kind === 'tokens') {
    const parsed = JSON.parse(text);
    return readTokens(parsed) || {
      format: 'json',
      text: JSON.stringify(parsed)
    };
  }
  return { text };
}

// A page as markup without what only a browser needs
function trimHtml(text) {
  return trimMarkup(text, { xmlMode: false });
}

function trimSvg(text) {
  return trimMarkup(text, { xmlMode: true });
}

// Scripts, comments, the XML declaration and shape data out, data URLs
// shortened and whitespace collapsed, of markup kept as it is written:
// nothing is repaired or decoded. One walk of the tree, each node met
// once. Throws an error named `nesting` for markup nested past `MAX_DEPTH`
function trimMarkup(text, { xmlMode }) {
  const options = {
    xmlMode,
    decodeEntities: false
  };
  const handler = new BoundedHandler();
  const parser = new Parser(handler, options);
  parser.write(text);
  parser.end();
  const open = [ handler.root ];
  while (open.length) {
    const node = open.pop();
    if (!node.children?.length) {
      continue;
    }
    const kept = node.children.filter(child => (child.type !== 'comment') &&
      (child.name !== 'script') && !child.name?.startsWith('?'));
    if (kept.length !== node.children.length) {
      kept.forEach((child, index) => {
        child.prev = kept[index - 1] || null;
        child.next = kept[index + 1] || null;
      });
      node.children = kept;
    }
    for (const child of kept) {
      const attribute = SHAPE_ATTRIBUTES[child.name];
      if (attribute && (child.attribs?.[attribute] !== undefined)) {
        child.attribs[attribute] = '…';
      }
      open.push(child);
    }
  }
  return collapse(shortenDataUrls(DomUtils.getInnerHTML(handler.root, options)));
}

// The parser keeps every open element in a list it searches, and the
// markup is written back by recursion: both are bounded by the depth
class BoundedHandler extends DomHandler {
  depth = 0;

  onopentag(name, attribs) {
    if (++this.depth > MAX_DEPTH) {
      throw Object.assign(new Error('markup nested too deeply'), { name: 'nesting' });
    }
    super.onopentag(name, attribs);
  }

  onclosetag() {
    this.depth--;
    super.onclosetag();
  }
}

function trimCss(text) {
  return shortenDataUrls(dropCssComments(text))
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .trim();
}

// A comment never closed runs to the end of the stylesheet
function dropCssComments(text) {
  const kept = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf('/*', from);
    if (start === -1) {
      kept.push(text.slice(from));
      break;
    }
    kept.push(text.slice(from, start));
    const end = text.indexOf('*/', start + 2);
    if (end === -1) {
      break;
    }
    from = end + 2;
  }
  return kept.join('');
}

/**
 * The tokens of a token file in one of the shapes design tools write:
 * Design Tokens (`$value`), Style Dictionary (`value`), or a list of `{
 * name, value }` with usage notes. `null` for any other JSON.
 *
 * @param {any} value The parsed file.
 * @returns {{ format: string, tokens: object[] }|null} Each token `{
 *   path, value, type?, description? }`.
 */
function readTokens(value) {
  if (Array.isArray(value)) {
    const listed = value.length && value.every(item => isObject(item) &&
      (typeof item.name === 'string') && ('value' in item));
    return listed
      ? {
        format: 'list',
        tokens: value.map(item => token(item.name, item.value, item.type,
          item.usage ?? item.description ?? item.note))
      }
      : null;
  }
  if (!isObject(value)) {
    return null;
  }
  const designTokens = [];
  walk(value, [], null, '$value', designTokens);
  if (designTokens.length) {
    return {
      format: 'design-tokens',
      tokens: designTokens
    };
  }
  const styleDictionary = [];
  walk(value, [], null, 'value', styleDictionary);
  return styleDictionary.length
    ? {
      format: 'style-dictionary',
      tokens: styleDictionary
    }
    : null;

  // A group's `$type` holds for the tokens under it
  function walk(node, path, inherited, key, found) {
    const type = node.$type ?? inherited;
    if (key in node) {
      found.push(token(path.join('.'), node[key], node.$type ?? node.type ?? type,
        node.$description ?? node.description ?? node.comment));
      return;
    }
    for (const [ name, child ] of Object.entries(node)) {
      if (isObject(child) && !name.startsWith('$')) {
        walk(child, [ ...path, name ], type, key, found);
      }
    }
  }
}

function token(path, value, type, description) {
  return {
    path,
    value,
    ...(typeof type === 'string' && { type }),
    ...(typeof description === 'string' && description && { description })
  };
}

/**
 * One part of a long text, `part` from 1: parts end just after the first
 * of `breaks` found near the end, else wherever the size ends them.
 *
 * @param {string} text
 * @param {number} part
 * @param {string[]} [breaks] For a stylesheet, a whole rule, else a whole
 *   declaration.
 * @returns {{ content: string, part?: number, parts?: number }|null} `null`
 *   past the last part.
 */
function getPart(text, part = 1, breaks = [ ' ' ]) {
  if (text.length <= PART_CHARS) {
    return (part === 1) ? { content: text } : null;
  }
  const parts = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + PART_CHARS, text.length);
    if (end < text.length) {
      const tail = text.slice(end - PART_SLACK, end);
      const found = breaks
        .map(char => tail.lastIndexOf(char))
        .find(index => index !== -1);
      if (found !== undefined) {
        end = end - PART_SLACK + found + 1;
      }
    }
    parts.push(text.slice(start, end));
    start = end;
  }
  return pickPart(parts, part, content => ({ content }));
}

/**
 * One part of a token list, `part` from 1: at most `TOKENS_PER_PART`
 * tokens and about `PART_CHARS` characters, so long usage notes never make
 * a part too large.
 *
 * @param {object[]} tokens
 * @param {number} part
 * @returns {{ tokens: object[], part?: number, parts?: number }|null}
 */
function getTokensPart(tokens, part = 1) {
  const parts = [ [] ];
  let chars = 0;
  for (const item of tokens) {
    const size = JSON.stringify(item).length + 1;
    const current = parts.at(-1);
    const full = (current.length >= TOKENS_PER_PART) || (chars + size > PART_CHARS);
    if (current.length && full) {
      parts.push([ item ]);
      chars = size;
    } else {
      current.push(item);
      chars += size;
    }
  }
  return pickPart(parts, part, found => ({ tokens: found }));
}

function pickPart(parts, part, shape) {
  if (part > parts.length) {
    return null;
  }
  return {
    ...shape(parts[part - 1]),
    ...((parts.length > 1) && {
      part,
      parts: parts.length
    })
  };
}

/**
 * The main colors of an image, most of it first: each `{ hex, share }`,
 * `share` the part of the image it covers, transparency on white.
 *
 * @param {Function} sharp
 * @param {Buffer} data
 * @returns {Promise<Array<{ hex: string, share: number }>>}
 */
async function measureColors(sharp, data) {
  const { data: pixels, info } = await sharp(data)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(64, 64, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { channels } = info;
  const total = pixels.length / channels;
  const buckets = new Map();
  for (let i = 0; i < pixels.length; i += channels) {
    const [ r, g, b ] = (channels < 3)
      ? [ pixels[i], pixels[i], pixels[i] ]
      : [ pixels[i], pixels[i + 1], pixels[i + 2] ];
    // 4 bits a channel: near shades count as one color
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) || {
      count: 0,
      r: 0,
      g: 0,
      b: 0
    };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  return [ ...buckets.values() ]
    .sort((one, two) => two.count - one.count)
    .filter(bucket => (bucket.count / total) >= COLOR_MIN_SHARE)
    .slice(0, COLORS_MAX)
    .map(bucket => ({
      hex: `#${[ bucket.r, bucket.g, bucket.b ]
        .map(sum => Math.round(sum / bucket.count).toString(16).padStart(2, '0'))
        .join('')}`,
      share: Math.round((bucket.count / total) * 100) / 100
    }));
}

function shortenDataUrls(text) {
  return text.replace(DATA_URL, (url, type) => `data:${type || ''},… (${
    Math.max(1, Math.round(url.length / 1024))} KB left out)`);
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function isObject(value) {
  return Boolean(value) && (typeof value === 'object') && !Array.isArray(value);
}
