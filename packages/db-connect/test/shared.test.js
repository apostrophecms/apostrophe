/* global describe, it */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const {
  extractAnchoredLiteralPrefix,
  prefixUpperBound
} = require('../lib/shared');

describe('shared: extractAnchoredLiteralPrefix', function() {
  it('extracts a plain anchored literal', function() {
    const r = extractAnchoredLiteralPrefix(/^hello/);
    expect(r).to.deep.equal({
      prefix: 'hello',
      anchored: true
    });
  });

  it('handles escaped slashes and dots (the ApostropheCMS page path pattern)', function() {
    const r = extractAnchoredLiteralPrefix(/^\/parent\/child\/./);
    expect(r.prefix).to.equal('/parent/child/');
    expect(r.anchored).to.equal(true);
  });

  it('stops at the first unescaped metacharacter', function() {
    expect(extractAnchoredLiteralPrefix(/^foo.*bar/).prefix).to.equal('foo');
    expect(extractAnchoredLiteralPrefix(/^foo(bar|baz)/).prefix).to.equal('foo');
    expect(extractAnchoredLiteralPrefix(/^foo\d+/).prefix).to.equal('foo');
    expect(extractAnchoredLiteralPrefix(/^foo[abc]/).prefix).to.equal('foo');
    expect(extractAnchoredLiteralPrefix(/^foo?/).prefix).to.equal('fo');
  });

  it('keeps the preceding char before + (one-or-more, guaranteed once)', function() {
    expect(extractAnchoredLiteralPrefix(/^foo+/).prefix).to.equal('foo');
  });

  it('drops the preceding char before * (zero-or-more)', function() {
    expect(extractAnchoredLiteralPrefix(/^foo*/).prefix).to.equal('fo');
  });

  it('drops the preceding char before {0,...} quantifier', function() {
    expect(extractAnchoredLiteralPrefix(/^foo{2,3}/).prefix).to.equal('fo');
  });

  it('treats escaped metacharacters as literals', function() {
    expect(extractAnchoredLiteralPrefix(/^a\.b\+c\*d/).prefix).to.equal('a.b+c*d');
    expect(extractAnchoredLiteralPrefix(/^a\(b\)c/).prefix).to.equal('a(b)c');
  });

  it('returns empty prefix when not anchored', function() {
    expect(extractAnchoredLiteralPrefix(/hello/)).to.deep.equal({
      prefix: '',
      anchored: false
    });
  });

  it('returns empty prefix for case-insensitive regex', function() {
    expect(extractAnchoredLiteralPrefix(/^hello/i)).to.deep.equal({
      prefix: '',
      anchored: false
    });
  });

  it('returns empty prefix when the regex starts with a metacharacter', function() {
    expect(extractAnchoredLiteralPrefix(/^.foo/).prefix).to.equal('');
    expect(extractAnchoredLiteralPrefix(/^(foo|bar)/).prefix).to.equal('');
  });

  it('returns empty prefix for non-RegExp input', function() {
    expect(extractAnchoredLiteralPrefix('hello').prefix).to.equal('');
    expect(extractAnchoredLiteralPrefix(null).prefix).to.equal('');
  });

  it('stops at character-class escapes like \\d, \\w, \\s', function() {
    expect(extractAnchoredLiteralPrefix(/^abc\d/).prefix).to.equal('abc');
    expect(extractAnchoredLiteralPrefix(/^abc\w/).prefix).to.equal('abc');
    expect(extractAnchoredLiteralPrefix(/^abc\s/).prefix).to.equal('abc');
  });

  it('returns empty prefix for just ^', function() {
    expect(extractAnchoredLiteralPrefix(/^/).prefix).to.equal('');
  });
});

describe('shared: prefixUpperBound', function() {
  it('increments the last character code point', function() {
    expect(prefixUpperBound('foo')).to.equal('fop');
    expect(prefixUpperBound('/parent/')).to.equal('/parent0'); // '/' (0x2F) -> '0' (0x30)
    expect(prefixUpperBound('a')).to.equal('b');
  });

  it('orders such that all P-prefixed strings fall in [P, upper)', function() {
    const P = '/parent/';
    const U = prefixUpperBound(P);
    // A few descendants
    for (const s of [ '/parent/', '/parent/a', '/parent/child/foo', '/parent/~~~', '/parent/' + '\uFFFE' ]) {
      expect(s >= P).to.equal(true);
      expect(s < U).to.equal(true);
    }
    // Non-descendants must fall outside
    for (const s of [ '/parent', '/parentx', '/parenu', '0', '/' ]) {
      const inRange = s >= P && s < U;
      expect(inRange).to.equal(false);
    }
  });

  it('returns null for empty prefix', function() {
    expect(prefixUpperBound('')).to.equal(null);
  });

  it('returns null when the last character is the max BMP code point', function() {
    expect(prefixUpperBound('foo\uFFFF')).to.equal(null);
  });
});
