// Differential tests for lib/beneath.js: each function is checked against the
// real lodash equivalent across curated cases and thousands of fuzzed inputs,
// so the slim replacements provably match lodash for the JSON-shaped data
// Apostrophe uses. lodash is a dependency of this package; beneath.js is an ES
// module loaded here via Node's require(esm) support (Node 22+).
const assert = require('node:assert/strict');
const _ = require('lodash');
const {
  createId, isEqual, get, merge, isPlainObject, deburr, debounce, throttle
} = require('../lib/beneath.js');

// Deterministic pseudo-random nested-structure generator for fuzzing.
function gen(depth, seed, allowUndefined) {
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  function make(d) {
    const r = rand();
    if (d <= 0 || r < 0.35) {
      const p = rand();
      if (p < 0.2) {
        return null;
      }
      if (p < 0.4) {
        return Math.floor(rand() * 5);
      }
      if (p < 0.6) {
        return [ 'a', 'b', 'foo', '' ][Math.floor(rand() * 4)];
      }
      if (p < 0.8) {
        return rand() < 0.5;
      }
      return allowUndefined ? undefined : 0;
    }
    if (r < 0.68) {
      const n = Math.floor(rand() * 3);
      return Array.from({ length: n }, () => make(d - 1));
    }
    const o = {};
    const n = Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      o[[ 'x', 'y', 'z', 'k' ][Math.floor(rand() * 4)]] = make(d - 1);
    }
    return o;
  }
  return make(depth);
}

describe('lib/beneath.js matches lodash', function () {
  it('isEqual: curated cases', function () {
    const cases = [
      [ 1, 1 ], [ 1, 2 ], [ NaN, NaN ], [ 0, -0 ], [ -0, -0 ],
      [ 'a', 'a' ], [ 'a', 'b' ], [ null, null ], [ null, undefined ],
      [ {}, {} ], [ { a: 1 }, { a: 1 } ], [ { a: 1 }, { a: 2 } ],
      [ {
        a: 1,
        b: 2
      }, {
        b: 2,
        a: 1
      } ], [ { a: undefined }, {} ],
      [ [ 1, 2, 3 ], [ 1, 2, 3 ] ], [ [ 1, 2 ], [ 1, 2, 3 ] ],
      [ { a: [ { b: 1 } ] }, { a: [ { b: 1 } ] } ],
      [ new Date(0), new Date(0) ], [ new Date(0), new Date(1) ],
      [ /x/g, /x/g ], [ /x/g, /x/i ],
      [ { a: { b: { c: [ 1, { d: 2 } ] } } }, { a: { b: { c: [ 1, { d: 2 } ] } } } ]
    ];
    for (const [ a, b ] of cases) {
      assert.equal(isEqual(a, b), _.isEqual(a, b), `isEqual(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
    }
  });

  it('isEqual: 5000 fuzzed pairs match lodash', function () {
    for (let i = 0; i < 5000; i++) {
      const a = gen(4, i * 2 + 1, true);
      const b = (i % 3 === 0) ? _.cloneDeep(a) : gen(4, i * 2 + 2, false);
      assert.equal(isEqual(a, b), _.isEqual(a, b), `mismatch at ${i}`);
    }
  });

  it('get: curated paths', function () {
    const obj = {
      a: { b: { c: 42 } },
      arr: [ { x: 1 }, { x: 2 } ],
      'd.e': 5
    };
    const paths = [ 'a.b.c', 'a.b', 'a.b.z', 'arr[0].x', 'arr[1].x', 'arr[2].x', 'nope', 'a[b][c]', [ 'a', 'b', 'c' ] ];
    for (const p of paths) {
      assert.deepEqual(get(obj, p), _.get(obj, p), `get(${JSON.stringify(p)})`);
      assert.deepEqual(get(obj, p, 'DEF'), _.get(obj, p, 'DEF'), `get(${JSON.stringify(p)}, DEF)`);
    }
    assert.equal(get(null, 'a.b'), _.get(null, 'a.b'));
    assert.equal(get(undefined, 'a', 'x'), _.get(undefined, 'a', 'x'));
  });

  it('isPlainObject matches lodash', function () {
    const values = [
      {}, { a: 1 }, Object.create(null), [], null, undefined, 1, 'x', true,
      new Date(), /x/, new Map(), function () {}, Math, Object.create({})
    ];
    values.forEach((v, i) => {
      assert.equal(isPlainObject(v), _.isPlainObject(v), `isPlainObject value #${i}`);
    });
  });

  it('deburr matches lodash on Latin-1 + Extended-A and real words', function () {
    let s = '';
    for (let cp = 0x00c0; cp <= 0x017f; cp++) {
      s += String.fromCodePoint(cp);
    }
    const words = [ 'déjà', 'naïve', 'Zürich', 'Œuvre', 'æther', 'Straße', 'Łódź', 'Đorđe', 'Køge', 'Ægir' ];
    for (const str of [ s, ...words ]) {
      assert.equal(deburr(str), _.deburr(str), `deburr(${JSON.stringify(str)})`);
    }
    // Intentional superset: NFD also folds Latin Extended-B / Vietnamese for slugs.
    assert.equal(deburr('Nguyễn'), 'Nguyen');
  });

  it('merge: curated + 3000 fuzzed cases match lodash', function () {
    const curated = [
      [ { a: 1 }, { b: 2 } ],
      [ { a: { x: 1 } }, { a: { y: 2 } } ],
      [ { a: [ 1, 2, 3 ] }, { a: [ 4 ] } ],
      [ { a: [ { x: 1 } ] }, { a: [ { y: 2 } ] } ],
      [ { a: 1 }, { a: undefined } ],
      [ { a: 1 }, { a: null } ],
      [ {}, { a: { b: { c: 1 } } } ],
      [ { a: { b: 1 } }, { a: { b: { c: 2 } } } ]
    ];
    for (const [ t, s ] of curated) {
      assert.deepEqual(merge(_.cloneDeep(t), _.cloneDeep(s)), _.merge(_.cloneDeep(t), _.cloneDeep(s)), `merge ${JSON.stringify(t)} <- ${JSON.stringify(s)}`);
    }
    for (let i = 0; i < 3000; i++) {
      // JSON-safe (no undefined), matching real doc/context data.
      const t = gen(4, i * 4 + 2, false);
      const s = gen(4, i * 4 + 4, false);
      if (!_.isObject(t) || !_.isObject(s)) {
        continue;
      }
      const mine = merge(_.cloneDeep(t), _.cloneDeep(s));
      const theirs = _.merge(_.cloneDeep(t), _.cloneDeep(s));
      assert.deepEqual(mine, theirs, `merge mismatch at ${i}`);
    }
  });

  it('merge: does not allow prototype pollution', function () {
    // `__proto__` etc. must never reach Object.prototype, at the top level or
    // nested. JSON.parse produces an OWN `__proto__` key (the vector).
    merge({}, JSON.parse('{"__proto__": {"polluted": "yes"}}'));
    merge({ a: {} }, JSON.parse('{"a": {"__proto__": {"polluted": "yes"}}}'));
    merge({}, JSON.parse('{"constructor": {"prototype": {"polluted": "yes"}}}'));
    assert.equal({}.polluted, undefined, 'Object.prototype was not polluted');
    // A dangerous key sitting next to a normal one must not block the normal one.
    assert.deepEqual(
      merge({ keep: 1 }, JSON.parse('{"keep": 2, "__proto__": {"x": 1}}')),
      { keep: 2 }
    );
  });

  it('debounce: trailing invoke once with last args + cancel', async function () {
    let calls = 0;
    let lastArg;
    const d = debounce((x) => {
      calls++;
      lastArg = x;
    }, 30);
    d(1);
    d(2);
    d(3);
    assert.equal(calls, 0, 'not called synchronously');
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(calls, 1, 'called once');
    assert.equal(lastArg, 3, 'last args win');
    let calls2 = 0;
    const d2 = debounce(() => {
      calls2++;
    }, 30);
    d2();
    d2.cancel();
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(calls2, 0, 'cancel prevents invocation');
  });

  it('throttle: leading + trailing + cancel', async function () {
    let calls = 0;
    const t = throttle(() => {
      calls++;
    }, 40, {
      leading: true,
      trailing: true
    });
    t();
    assert.equal(calls, 1, 'leading invocation is immediate');
    t();
    t();
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(calls, 2, 'one trailing invocation');
    let calls2 = 0;
    const t2 = throttle(() => {
      calls2++;
    }, 40, { leading: false });
    t2();
    t2.cancel();
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(calls2, 0, 'cancel prevents trailing when no leading');
  });

  it('createId: cuid2-shaped, unique, and uniformly distributed (no modulo bias)', function () {
    const n = 100000;
    const ids = Array.from({ length: n }, () => createId());
    assert.ok(
      ids.every((id) => /^[a-z][a-z0-9]{23}$/.test(id)),
      '24 lowercase base36 chars, first is a letter'
    );
    assert.equal(new Set(ids).size, n, 'no collisions');
    // Chi-square over the 36-symbol alphabet at an alphanumeric position. The
    // naive `byte % 36` mapping is biased (256 is not a multiple of 36), which
    // pushes this statistic to ~195; the rejection-sampled version stays near
    // the degrees of freedom (35). 100 is a comfortable, non-flaky boundary.
    const counts = {};
    for (const id of ids) {
      counts[id[5]] = (counts[id[5]] || 0) + 1;
    }
    assert.equal(Object.keys(counts).length, 36, 'all 36 symbols occur');
    const expected = n / 36;
    let chiSquare = 0;
    for (const symbol of Object.keys(counts)) {
      chiSquare += ((counts[symbol] - expected) ** 2) / expected;
    }
    assert.ok(chiSquare < 100, `distribution uniform (chi-square ${chiSquare.toFixed(1)} < 100)`);
  });
});
