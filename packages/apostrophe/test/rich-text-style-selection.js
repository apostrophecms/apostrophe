const assert = require('node:assert/strict');
const findActiveStyleIndex = require(
  '../modules/@apostrophecms/rich-text-widget/ui/apos/lib/findActiveStyleIndex.js'
).default;

describe('findActiveStyleIndex', () => {
  it('prefers the most specific style when several styles share the same tag', () => {
    const nodes = [
      { type: 'paragraph', class: null, level: null },
      { type: 'paragraph', class: 'small', level: null }
    ];
    const activeEl = { name: 'paragraph', class: 'small', level: null };
    assert.strictEqual(findActiveStyleIndex(nodes, activeEl), 1);
  });

  it('does not depend on the order of the configured styles', () => {
    const nodes = [
      { type: 'paragraph', class: 'small', level: null },
      { type: 'paragraph', class: null, level: null }
    ];
    const activeEl = { name: 'paragraph', class: 'small', level: null };
    assert.strictEqual(findActiveStyleIndex(nodes, activeEl), 0);
  });

  it('matches the plain style when no specific style applies', () => {
    const nodes = [
      { type: 'paragraph', class: 'small', level: null },
      { type: 'paragraph', class: null, level: null }
    ];
    const activeEl = { name: 'paragraph', class: null, level: null };
    assert.strictEqual(findActiveStyleIndex(nodes, activeEl), 1);
  });

  it('counts multiple classes toward specificity', () => {
    const nodes = [
      { type: 'paragraph', class: null, level: null },
      { type: 'paragraph', class: 'highlight', level: null },
      { type: 'paragraph', class: 'highlight small', level: null }
    ];
    const activeEl = { name: 'paragraph', class: 'highlight small', level: null };
    assert.strictEqual(findActiveStyleIndex(nodes, activeEl), 2);
  });

  it('returns -1 when no style matches', () => {
    const nodes = [
      { type: 'paragraph', class: null, level: null }
    ];
    const activeEl = { name: 'heading', class: null, level: 2 };
    assert.strictEqual(findActiveStyleIndex(nodes, activeEl), -1);
  });
});