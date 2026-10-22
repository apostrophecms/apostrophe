const assert = require('assert');
const cacheOnDemand = require('../index.js');

describe('cacheOnDemand', () => {
  let didTheWork = 0;
  let fn;

  before(() => {
    fn = cacheOnDemand(

      (a, b, callback) => {
      // Add two numbers, but take 20 ms to do it asynchronously
        setTimeout(() => {
          didTheWork++;

          const result = a + b;
          return callback(result);
        }, 20);
      },
      (a, b) => {
        // hash them by concatenating them, unless "a" is 100, in which case
        // it is marked unsafe to cache
        if (a === 100) {
          return false;
        }
        return a + ',' + b;
      });

  });

  it('returns functions', () => {
    assert(typeof fn === 'function');
  });

  it('delivers result ten times for ten invocations', (done) => {
    let received = 0;

    for (let i = 0; (i < 10); i++) {
      test();
    }

    function test() {
      return fn(5, 5, (result) => {
        assert(result === 10);
        received++;
        if (received === 10) {
          return done();
        }
      });
    }
  });
  it('does the work only once for those ten invocations', () => {
    assert(didTheWork === 1);
  });
  it('does the work for a second series of invocations', (done) => {
    let received = 0;

    for (let i = 0; (i < 10); i++) {
      test();
    }

    function test() {
      return fn(6, 6, (result) => {
        assert(result === 12);
        received++;
        if (received === 10) {
          return done();
        }
      });
    }
  });

  it('now a total of two times work has been done', () => {
    assert(didTheWork === 2);
  });

  it('new block of simultaneous requests generates new data, but only once', (done) => {
    let received = 0;

    for (let i = 0; (i < 10); i++) {
      test();
    }

    function test() {
      return fn(5, 5, (result) => {
        assert(result === 10);
        received++;
        if (received === 10) {
          return done();
        }
      });
    }
  });
  it('now a total of 3 times work has been done', () => {
    assert(didTheWork === 3);
  });

  it('does the work every time for a third series of invocations that should not be cached', (done) => {
    let received = 0;

    for (let i = 0; (i < 10); i++) {
      test();
    }

    function test() {
      return fn(100, 100, (result) => {
        assert(result === 200);
        received++;
        if (received === 10) {
          return done();
        }
      });
    }
  });

  it('now a total of 13 times work has been done', () => {
    assert(didTheWork === 13);
  });
});
