// The browser-side `apos.http.parseQuery` helper, exercised without a
// browser: the admin UI parses `window.location.search` with it on every
// page load, so an attacker-supplied query string must never be able to
// modify `Object.prototype` or other built-ins.

const assert = require('node:assert/strict');

describe('apos.http.parseQuery (browser)', function() {
  let parseQuery;
  let previousWindow;

  before(async function() {
    previousWindow = global.window;
    global.window = { apos: {} };
    const { default: http } = await import(
      '../modules/@apostrophecms/util/ui/src/http.js'
    );
    http();
    parseQuery = global.window.apos.http.parseQuery;
  });

  after(function() {
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
  });

  afterEach(function() {
    // Undo any pollution so that a failure here cannot affect other tests
    for (const target of [
      Object.prototype,
      Array.prototype,
      Object,
      Object.prototype.toString
    ]) {
      delete target.polluted;
    }
  });

  function assertNotPolluted() {
    assert.equal({}.polluted, undefined);
    assert.equal([].polluted, undefined);
    assert.equal(Object.polluted, undefined);
    assert.equal(Object.prototype.toString.polluted, undefined);
  }

  it('parses flat, nested, array and valueless keys', function() {
    assert.deepEqual(
      parseQuery('?a=1&b[c]=2&b[d][e]=3&f[]=4&f[]=5&g[0]=6&g[1]=7&h&i=x%20y&j=1&j=2'),
      {
        a: '1',
        b: {
          c: '2',
          d: { e: '3' }
        },
        f: [ '4', '5' ],
        g: [ '6', '7' ],
        h: null,
        i: 'x y',
        j: [ '1', '2' ]
      }
    );
  });

  it('does not pollute Object.prototype via __proto__', function() {
    parseQuery('?__proto__[polluted]=yes');
    assertNotPolluted();
  });

  it('does not pollute Object.prototype via an encoded __proto__', function() {
    parseQuery('?%5F%5Fproto%5F%5F%5Bpolluted%5D=yes');
    assertNotPolluted();
  });

  it('does not pollute Object.prototype via constructor.prototype', function() {
    parseQuery('?constructor[prototype][polluted]=yes');
    assertNotPolluted();
  });

  it('does not pollute Object.prototype via a nested __proto__', function() {
    parseQuery('?a[__proto__][polluted]=yes');
    parseQuery('?a[b][__proto__][polluted]=yes');
    assertNotPolluted();
  });

  it('does not pollute Array.prototype via __proto__', function() {
    parseQuery('?a[]=1&a[__proto__][polluted]=yes');
    assertNotPolluted();
  });

  it('does not modify inherited built-ins', function() {
    parseQuery('?toString[polluted]=yes&constructor[polluted]=yes');
    assertNotPolluted();
  });

  it('does not change the prototype of the result', function() {
    const result = parseQuery('?__proto__=yes&a[__proto__]=yes');
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(
      Object.getPrototypeOf(result.a || {}),
      Object.prototype
    );
  });

  it('keeps the harmless parameters of a query with a dangerous one', function() {
    assert.deepEqual(
      parseQuery('?a=1&__proto__[polluted]=yes&b[c]=2'),
      {
        a: '1',
        b: { c: '2' }
      }
    );
  });

  it('treats keys named like inherited properties as ordinary keys', function() {
    const result = parseQuery('?toString=a&valueOf[x]=b&hasOwnProperty[]=c');
    assert.equal(Object.hasOwn(result, 'toString'), true);
    assert.equal(result.toString, 'a');
    assert.deepEqual(result.valueOf, { x: 'b' });
    assert.deepEqual(result.hasOwnProperty, [ 'c' ]);
  });
});
