// Long text in parts. A field too long to read or write in one go — a terms
// and conditions page, a long article — is handed to the model in parts,
// each a run of whole blocks: top-level HTML elements for rich text, lines
// for plain text. A block too long by itself is split among its own
// children, so a giant list or table splits by item or row.
//
// A part's address is the field's address with a block range after "#":
// "@abc.content#4-9" is blocks 4 to 9, "@abc.content#3/0-40" the children 0
// to 40 of block 3. Ranges count elements and text with something in it,
// never the whitespace between them. Writing to a range replaces just those
// blocks, from the first's start to the last's end, leaving every other
// character of the field exactly as it was.
//
// Ranges are worked out on whichever copy was read, and every write names
// its own range explicitly, so a range read from the source can be written
// into the target as long as the two have the same structure, which keeping
// the markup as it is ensures.

const cheerio = require('cheerio');

// A field longer than this is split; parts aim to stay under it
const PART_MAX_CHARS = 8000;

module.exports = {
  PART_MAX_CHARS,
  splitParts,
  isPartAddress,
  parsePartAddress,
  spliceParts
};

// The parts of a value, in order: [ { range, value } ]. A value short enough
// comes back as one part with a null range
function splitParts(value, format) {
  if (value.length <= PART_MAX_CHARS) {
    return [ {
      range: null,
      value
    } ];
  }
  const root = rootOf(value, format);
  if (!root) {
    return [ {
      range: null,
      value
    } ];
  }
  const parts = [];
  collect(root, []);
  return parts.map(({
    path, from, to, start, end
  }) => ({
    range: rangeString(path, from, to),
    value: value.slice(start, end)
  }));

  function collect(node, path) {
    const blocks = node.blocks;
    let first = null;
    const flush = (last) => {
      if (first !== null) {
        parts.push({
          path,
          from: first,
          to: last,
          start: blocks[first].start,
          end: blocks[last].end
        });
        first = null;
      }
    };
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const length = block.end - block.start;
      if (length > PART_MAX_CHARS && block.children?.blocks.length > 1) {
        flush(i - 1);
        collect(block.children, [ ...path, i ]);
        continue;
      }
      if (first !== null && block.end - blocks[first].start > PART_MAX_CHARS) {
        flush(i - 1);
      }
      if (first === null) {
        first = i;
      }
    }
    flush(blocks.length - 1);
  }
}

function isPartAddress(address) {
  return address.includes('#');
}

// "@abc.content#3/0-40" → { address: '@abc.content', path: [ 3 ], from: 0,
// to: 40 }, or null when the range is malformed
function parsePartAddress(address) {
  const [ base, range, ...rest ] = address.split('#');
  const match = !rest.length && range?.match(/^((?:\d+\/)*)(\d+)-(\d+)$/);
  if (!base || !match) {
    return null;
  }
  const from = Number(match[2]);
  const to = Number(match[3]);
  if (to < from) {
    return null;
  }
  return {
    address: base,
    path: match[1] ? match[1].split('/').filter(Boolean).map(Number) : [],
    from,
    to
  };
}

// Write `writes`, [ { range, text } ] with ranges as parsePartAddress gives
// them, into `value`. Returns { value, notes }, notes telling of a write that
// changed the number of blocks, which moves the ranges after it. Throws a
// plain Error with a message for the model when a range is not there or two
// overlap
function spliceParts(value, format, writes) {
  const root = rootOf(value, format);
  if (!root) {
    throw new Error('this text cannot be written in parts; write it whole');
  }
  const located = writes.map((write) => {
    let node = root;
    for (const index of write.path) {
      node = node.blocks[index]?.children;
      if (!node) {
        throw new Error(`#${rangeString(write.path, write.from, write.to)} is not in the target: ` +
          're-read the field with localize_read_text');
      }
    }
    const first = node.blocks[write.from];
    const last = node.blocks[write.to];
    if (!first || !last) {
      throw new Error(`#${rangeString(write.path, write.from, write.to)} is not in the target, ` +
        `which has ${node.blocks.length} blocks there: re-read the field with localize_read_text`);
    }
    return {
      ...write,
      start: first.start,
      end: last.end
    };
  }).sort((a, b) => b.start - a.start);
  for (let i = 1; i < located.length; i++) {
    if (located[i].end > located[i - 1].start) {
      throw new Error('two of the parts written overlap');
    }
  }
  const notes = [];
  for (const write of located) {
    value = value.slice(0, write.start) + write.text + value.slice(write.end);
    const before = write.to - write.from + 1;
    const after = rootOf(write.text, format)?.blocks.length;
    if (after !== undefined && after !== before) {
      notes.push(
        `#${rangeString(write.path, write.from, write.to)} held ${before} ` +
        `blocks and now holds ${after}: ranges after it in that field have ` +
        'moved, so re-read it before writing them'
      );
    }
  }
  return {
    value,
    notes
  };
}

function rangeString(path, from, to) {
  return `${path.map((index) => `${index}/`).join('')}${from}-${to}`;
}

// The block tree of a value: { blocks: [ { start, end, children? } ] },
// children being the same for the blocks inside a block. Null when the
// value cannot be mapped reliably
function rootOf(value, format) {
  if (format !== 'html') {
    const blocks = [];
    const pattern = /[^\n]*\S[^\n]*/g;
    let match;
    while ((match = pattern.exec(value))) {
      blocks.push({
        start: match.index,
        end: match.index + match[0].length
      });
    }
    return { blocks };
  }
  let $;
  try {
    $ = cheerio.load(value, { sourceCodeLocationInfo: true }, false);
  } catch (e) {
    return null;
  }
  try {
    return nodeBlocks($.root()[0].children);
  } catch (e) {
    return null;
  }

  function nodeBlocks(children) {
    const blocks = [];
    for (const child of children || []) {
      if (child.type === 'comment' || child.type === 'directive') {
        continue;
      }
      if (child.type === 'text' && !child.data.trim()) {
        continue;
      }
      const location = child.sourceCodeLocation;
      // An element the parser implied, like a table's tbody, is not in the
      // source: its children stand in its place
      if (!location && child.type === 'tag') {
        for (const block of nodeBlocks(child.children).blocks) {
          if (blocks.length && block.start < blocks.at(-1).end) {
            throw new Error('unmapped');
          }
          blocks.push(block);
        }
        continue;
      }
      if (
        !location ||
        !Number.isInteger(location.startOffset) ||
        !Number.isInteger(location.endOffset) ||
        location.endOffset <= location.startOffset ||
        (blocks.length && location.startOffset < blocks.at(-1).end)
      ) {
        throw new Error('unmapped');
      }
      blocks.push({
        start: location.startOffset,
        end: location.endOffset,
        ...(child.type === 'tag' && child.children?.length && {
          children: nodeBlocks(child.children)
        })
      });
    }
    return { blocks };
  }
}
