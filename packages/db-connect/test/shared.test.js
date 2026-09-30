/* global describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const {
  extractAnchoredLiteralPrefix,
  prefixUpperBound,
  getNestedField,
  setNestedField,
  unsetNestedField,
  applyProjection,
  applyUpdate
} = require('../lib/shared');
const prototypeGuard = require('./prototype-guard');

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

  it('returns empty prefix for top-level alternation', function() {
    // Top-level alternation means the other branch may match a completely
    // different string, so no prefix is safe for range predicates.
    expect(extractAnchoredLiteralPrefix(/^en:|^fr:/).prefix).to.equal('');
    expect(extractAnchoredLiteralPrefix(/^foo|^bar|^baz/).prefix).to.equal('');
    expect(extractAnchoredLiteralPrefix(/^abc|xyz/).prefix).to.equal('');
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

describe('shared: field paths cannot reach built-in prototypes', function() {
  const marker = '__dbConnectPrototypeMarker';
  let snap;

  beforeEach(function() {
    // A harmless, configurable property we can watch being deleted
    // without breaking the process
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, marker, {
      value: 'marker',
      configurable: true,
      writable: true,
      enumerable: false
    });
    snap = prototypeGuard.snapshot();
  });

  // Always put the built-ins back, even if the test failed, so that a
  // vulnerable implementation cannot wreck the rest of the test run
  afterEach(function() {
    prototypeGuard.restore(snap);
    delete Object.prototype[marker];
  });

  function expectBuiltinsUnchanged() {
    expect(prototypeGuard.changes(snap), 'built-in objects were modified').to.deep.equal([]);
  }

  it('exclusion projection does not delete Object.prototype.hasOwnProperty', function() {
    const result = applyProjection({
      _id: 'd1',
      title: 't'
    }, { 'constructor.prototype.hasOwnProperty': 0 });
    expect(Object.prototype.hasOwnProperty).to.be.a('function');
    expect(result).to.deep.equal({
      _id: 'd1',
      title: 't'
    });
    expectBuiltinsUnchanged();
  });

  it('exclusion projection does not delete Object.prototype members', function() {
    applyProjection({ _id: 'd1' }, { [`constructor.prototype.${marker}`]: 0 });
    expect(({})[marker]).to.equal('marker');
    applyProjection({ _id: 'd1' }, { [`__proto__.${marker}`]: 0 });
    expect(({})[marker]).to.equal('marker');
    expectBuiltinsUnchanged();
  });

  it('exclusion projection does not delete static methods of Object', function() {
    applyProjection({ _id: 'd1' }, { 'constructor.keys': 0 });
    expect(Object.keys).to.be.a('function');
    expectBuiltinsUnchanged();
  });

  it('exclusion projection does not delete Array.prototype members', function() {
    applyProjection({
      _id: 'd1',
      list: [ 1 ]
    }, { 'list.constructor.prototype.map': 0 });
    expect([].map).to.be.a('function');
    expectBuiltinsUnchanged();
  });

  it('inclusion projection does not copy built-ins into the result', function() {
    const result = applyProjection({
      _id: 'd1',
      title: 't'
    }, {
      title: 1,
      'constructor.name': 1,
      'constructor.prototype': 1
    });
    expect(result).to.deep.equal({
      _id: 'd1',
      title: 't'
    });
    expect(Object.getOwnPropertyNames(result)).to.not.include('constructor');
    expectBuiltinsUnchanged();
  });

  it('getNestedField does not resolve unsafe path segments', function() {
    expect(getNestedField({}, 'constructor')).to.equal(undefined);
    expect(getNestedField({}, 'constructor.prototype')).to.equal(undefined);
    expect(getNestedField({}, '__proto__')).to.equal(undefined);
    expect(getNestedField({ a: [] }, 'a.constructor.prototype')).to.equal(undefined);
    expectBuiltinsUnchanged();
  });

  it('setNestedField does not write to built-ins', function() {
    setNestedField({}, 'constructor.prototype.polluted', 'yes');
    setNestedField({}, 'constructor.polluted', 'yes');
    setNestedField({ a: [] }, 'a.constructor.prototype.polluted', 'yes');
    setNestedField({}, 'x.__proto__.polluted', 'yes');
    expect(({}).polluted).to.equal(undefined);
    expect([].polluted).to.equal(undefined);
    expect(Object.polluted).to.equal(undefined);
    expectBuiltinsUnchanged();
  });

  it('unsetNestedField does not delete from built-ins', function() {
    unsetNestedField({}, `constructor.prototype.${marker}`);
    unsetNestedField({}, `__proto__.${marker}`);
    unsetNestedField({}, 'constructor.keys');
    expect(({})[marker]).to.equal('marker');
    expect(Object.keys).to.be.a('function');
    expectBuiltinsUnchanged();
  });

  it('paths cannot reach built-ins through inherited properties', function() {
    const doc = {
      _id: 'd1',
      list: [ 1 ]
    };
    expect(getNestedField(doc, 'toString')).to.equal(undefined);
    expect(getNestedField(doc, 'hasOwnProperty.call')).to.equal(undefined);
    setNestedField({}, 'hasOwnProperty.call', 'polluted');
    setNestedField({}, 'toString.polluted', 'yes');
    setNestedField({ list: [] }, 'list.map.polluted', 'yes');
    unsetNestedField({}, 'toString.name');
    applyUpdate(doc, { $set: { 'valueOf.polluted': 'yes' } });
    applyProjection(doc, { 'hasOwnProperty.name': 0 });
    expect(Object.prototype.hasOwnProperty.call).to.equal(Function.prototype.call);
    expect(Object.prototype.toString.name).to.equal('toString');
    expect(Object.prototype.toString.polluted).to.equal(undefined);
    expect(Object.prototype.valueOf.polluted).to.equal(undefined);
    expect([].map.polluted).to.equal(undefined);
    expectBuiltinsUnchanged();
  });

  it('update operators do not modify built-ins', function() {
    const doc = {
      _id: 'd1',
      list: [ 1 ]
    };
    applyUpdate(doc, { $set: { 'constructor.prototype.polluted': 'yes' } });
    applyUpdate(doc, { $set: { 'list.constructor.prototype.polluted': 'yes' } });
    applyUpdate(doc, { $unset: { [`constructor.prototype.${marker}`]: '' } });
    applyUpdate(doc, [ { $unset: [ `constructor.prototype.${marker}` ] } ]);
    applyUpdate(doc, { $inc: { 'constructor.prototype.counter': 1 } });
    applyUpdate(doc, { $push: { 'constructor.prototype.pushed': 1 } });
    applyUpdate(doc, { $addToSet: { 'constructor.prototype.added': 1 } });
    applyUpdate(doc, { $pull: { 'constructor.prototype.pulled': 1 } });
    applyUpdate(doc, { $currentDate: { 'constructor.prototype.date': true } });
    applyUpdate(doc, { $rename: { title: 'constructor.prototype.renamed' } });
    const renamed = applyUpdate(doc, { $rename: { [`constructor.prototype.${marker}`]: 'stolen' } });
    expect(renamed.stolen).to.equal(undefined);
    expect(({})[marker]).to.equal('marker');
    for (const name of [ 'polluted', 'counter', 'pushed', 'added', 'pulled', 'date', 'renamed' ]) {
      expect(({})[name]).to.equal(undefined);
      expect([][name]).to.equal(undefined);
    }
    expectBuiltinsUnchanged();
  });

  it('ordinary nested paths still work', function() {
    const makeDoc = () => ({
      _id: 'd1',
      a: {
        b: 1,
        c: 2
      }
    });
    expect(getNestedField(makeDoc(), 'a.b')).to.equal(1);
    const updated = applyUpdate(makeDoc(), {
      $set: { 'x.y': 3 },
      $unset: { 'a.c': '' },
      $inc: { 'a.b': 1 }
    });
    expect(updated).to.deep.equal({
      _id: 'd1',
      a: { b: 2 },
      x: { y: 3 }
    });
    expect(applyProjection(makeDoc(), { 'a.c': 0 })).to.deep.equal({
      _id: 'd1',
      a: { b: 1 }
    });
    expect(applyProjection(makeDoc(), { 'a.b': 1 })).to.deep.equal({
      _id: 'd1',
      a: { b: 1 }
    });
  });
});
