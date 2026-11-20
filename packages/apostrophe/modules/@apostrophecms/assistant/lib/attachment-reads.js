// What `read_attachment` makes of a file's text: HTML and SVG trimmed of
// noise only (scripts, path data, base64 data URLs, comments, extra
// whitespace), CSS trimmed and searched when it is too large to read whole,
// token files checked by shape, long text read in parts, and the main
// colors of an image measured.

const cheerio = require('cheerio');

// About 20,000 tokens of markup
const PART_CHARS = 40000;
// Where a part may end early to end on whitespace
const PART_SLACK = 2000;
const TOKENS_PER_PART = 300;
const SEARCH_MAX = 40;
const COLORS_MAX = 8;
// The least share of the pixels a main color covers
const COLOR_MIN_SHARE = 0.02;
const DATA_URL = /data:([\w.+-]+\/[\w.+-]+)?((?:;[\w.+-]+=?[\w.+-]*)*),[^"'()\s]+/g;
// Attributes holding shapes as numbers
const SHAPE_ATTRIBUTES = [ [ 'path', 'd' ], [ 'polygon', 'points' ], [ 'polyline', 'points' ] ];

module.exports = {
  PART_CHARS,
  trimHtml,
  trimSvg,
  trimCss,
  searchCss,
  readTokens,
  getPart,
  getTokensPart,
  measureColors
};

// A page as markup without what only a browser needs
function trimHtml(text) {
  const isDocument = /<!doctype|<html[\s>]/i.test(text);
  const $ = cheerio.load(text, null, isDocument);
  $('script').remove();
  return collapse(trimMarkup($, $.html()));
}

function trimSvg(text) {
  const $ = cheerio.load(text, {
    xml: {
      xmlMode: true,
      decodeEntities: false
    }
  });
  $('script').remove();
  return collapse(trimMarkup($, $.xml()));
}

// Comments and shape data out, data URLs shortened, of markup loaded in `$`
function trimMarkup($, fallback) {
  $('*').contents().filter((index, node) => node.type === 'comment').remove();
  $.root().contents().filter((index, node) => node.type === 'comment').remove();
  for (const [ element, attribute ] of SHAPE_ATTRIBUTES) {
    $(`${element}[${attribute}]`).attr(attribute, '…');
  }
  return shortenDataUrls(($.root().html() ?? fallback));
}

function trimCss(text) {
  return shortenDataUrls(text.replace(/\/\*[\s\S]*?\*\//g, ''))
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .trim();
}

/**
 * The rules of a stylesheet that mention `term`, case aside: whole
 * top-level rules, an at-rule with everything inside it.
 *
 * @param {string} css Trimmed (`trimCss`).
 * @param {string} term
 * @returns {{ matches: string[], total: number }}
 */
function searchCss(css, term) {
  const wanted = term.toLowerCase();
  const found = splitRules(css).filter(rule => rule.toLowerCase().includes(wanted));
  return {
    matches: found.slice(0, SEARCH_MAX),
    total: found.length
  };
}

function splitRules(css) {
  const rules = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth = Math.max(depth - 1, 0);
      if (!depth) {
        rules.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    } else if ((char === ';') && !depth) {
      // @import, @charset
      rules.push(css.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return rules.filter(Boolean);
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
 * One part of a long text, `part` from 1: parts end on whitespace where
 * they can.
 *
 * @param {string} text
 * @param {number} part
 * @returns {{ content: string, part?: number, parts?: number }|null} `null`
 *   past the last part.
 */
function getPart(text, part = 1) {
  if (text.length <= PART_CHARS) {
    return (part === 1) ? { content: text } : null;
  }
  const parts = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + PART_CHARS, text.length);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > end - PART_SLACK) {
        end = space + 1;
      }
    }
    parts.push(text.slice(start, end));
    start = end;
  }
  return (part <= parts.length)
    ? {
      content: parts[part - 1],
      part,
      parts: parts.length
    }
    : null;
}

function getTokensPart(tokens, part = 1) {
  const parts = Math.max(Math.ceil(tokens.length / TOKENS_PER_PART), 1);
  if (part > parts) {
    return null;
  }
  return {
    tokens: tokens.slice((part - 1) * TOKENS_PER_PART, part * TOKENS_PER_PART),
    ...((parts > 1) && {
      part,
      parts
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
