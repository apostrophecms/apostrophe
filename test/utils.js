/* eslint-disable no-console */
const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const _ = require('lodash');

const getUtils = async () => import('../modules/@apostrophecms/ui/ui/apos/utils/index.js');

describe('Utils', async function() {
  this.timeout(t.timeout);

  let apos;

  after(function() {
    return t.destroy(apos);
  });

  it('should exist on the apos object', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.util);
  });

  // UTIL METHODS ------------------------------------------------------- //

  describe('methods', function() {

    it('generateId: should return a string of an number', function(done) {
      const id = apos.util.generateId();

      assert((typeof id) === 'string');
      assert((typeof parseInt(id)) === 'number');
      return done();
    });

    it('globalReplace: should replace multiple instances of a string', function(done) {
      const s = apos.util.globalReplace('apostrophe is for cool kids. therefore apostrophe is cool.', 'apostrophe', 'comma');

      assert(s.indexOf('apostrophe') < 0);
      assert(s.split('comma').length === 3);
      return done();
    });

    it('truncatePlaintext: should tuncate a message without cutting off a word', function(done) {
      const s = apos.util.truncatePlaintext('I want to be cut off here. This is an extra sentance.', 25);

      assert(s.indexOf('here') > 0);
      return done();
    });

    it('escapeHtml: should replace html tags with html string entites', function(done) {
      const s = apos.util.escapeHtml('<div>hello</div>');

      assert(s.indexOf('<') < 0 && s.indexOf('&lt;') >= 0);
      return done();
    });

    it('htmlToPlaintext: should strip all html notation', function(done) {
      const s = apos.util.htmlToPlaintext('<div>hello</div>');

      assert(s.indexOf('<') < 0 && s.indexOf('hello') >= 0);
      return done();
    });

    it('capitalizeFirst: should capitalize the first letter', function(done) {
      const s = apos.util.capitalizeFirst('hello');

      assert(s.indexOf('hello') < 0 && s.indexOf('H' === 0));
      return done();
    });

    it('cssName: should covert camelCase or underscore name formats to hyphenated css-style', function(done) {
      const s = apos.util.cssName('camelCase and under_score');

      assert(s.indexOf('C') < 0 && s.indexOf('_') < 0);
      assert(s.indexOf('camel-case') >= 0);
      return done();
    });

    it('cssName: should preserve double dash', function() {
      const s = apos.util.cssName('this-is--doubled');
      assert(s === 'this-is--doubled');
    });

    it('cssName: should not preserve triple dash', function() {
      const s = apos.util.cssName('this-is---tripled');
      assert(s === 'this-is--tripled');
    });

    it('camelName: should convert non digits or ASII characters to a capitalized version of the next character', function(done) {
      const s = apos.util.camelName('hello apostrophe');

      assert(s.indexOf(' ') < 0 && s.indexOf('A') === 5);
      return done();
    });

    it('addSlashIfNeeded: should add a slash "/" to the end of a path if necessary', function(done) {
      const s = apos.util.addSlashIfNeeded('/my/path');

      assert(s === '/my/path/');
      return done();
    });

    it('clonePermanent: should discard properties beginning with _ other than _id', function() {
      assert(_.isEqual(
        apos.util.clonePermanent({
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true,
          _blee: {
            bloo: true
          }
        }),
        {
          tree: {
            branch: {
              leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          }
        }
      ));
    });

    it('clonePermanent with keepScalars: should discard properties beginning with _ other than _id unless they are scalars (non-objects)', function() {
      assert(_.isEqual(
        apos.util.clonePermanent({
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true,
          _blee: {
            bloo: true
          }
        }, true),
        {
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true
        }
      ));
    });

    it('clonePermanent should not behave bizarrely with a test case from the punkave site', function() {
      const input = {
        attachment: {
          _id: 'a205filea1media97',
          title: 'http-window-punkave-com-wp-content-uploads-2009-01-n56601994_30790014_5081-225x300-jpg',
          width: 225,
          height: 300,
          length: 22014,
          md5: 22014,
          extension: 'jpg',
          group: 'images',
          name: 'http-window-punkave-com-wp-content-uploads-2009-01-n56601994_30790014_5081-225x300-jpg',
          landscape: false,
          portrait: true,
          a15Export: true,
          tags: [
            'p\'window',
            '2009'
          ],
          searchText: 'http window punkave com wp content uploads 2009 01 n56601994 30790014 5081 225x300 jpg http window punkave com wp content uploads 2009 01 n56601994 30790014 5081 225x300 jpg jpg',
          type: 'attachment'
        }
      };
      const clone = apos.util.clonePermanent(input);
      assert(clone.attachment._id === 'a205filea1media97');
    });

    it('gives sensible results for insensitiveSort', function() {
      const input = [
        'Fred',
        'dog',
        5,
        10,
        'jane'
      ];
      apos.util.insensitiveSort(input);
      assert(input.length === 5);
      assert(input[0] === 5);
      assert(input[1] === 10);
      assert(input[2] === 'dog');
      assert(input[3] === 'Fred');
      assert(input[4] === 'jane');
    });

    it('does not crash when apos.util.profile is called with two arguments', function() {
      apos.util.profile(apos.task.getReq(), 'this.is.a.path')();
      assert(true);
    });

    it('does not crash when apos.util.profile is called with three arguments', function() {
      apos.util.profile(apos.task.getReq(), 'this.is.a.path', 100);
      assert(true);
    });

    it('does not crash when apos.util.profile is called with one argument (no req arg)', function() {
      apos.util.profile('this.is.a.path')();
      assert(true);
    });

    it('does not crash when apos.util.profile is called with two arguments (no req arg)', function() {
      apos.util.profile('this.is.a.path', 100);
      assert(true);
    });

    it('can get a top level property with utils.get', function() {
      const data = {
        age: 5
      };
      assert(apos.util.get(data, 'age') === 5);
    });

    it('can set a top level property with utils.set', function() {
      const data = {
        age: 5
      };
      apos.util.set(data, 'age', 7);
      assert(data.age === 7);
    });

    it('can get a nested property with utils.get', function() {
      const data = {
        shoe: {
          size: 5
        }
      };
      assert(apos.util.get(data, 'shoe.size') === 5);
    });

    it('can set a nested property with utils.set', function() {
      const data = {
        shoe: {
          size: 5
        }
      };
      apos.util.set(data, 'shoe.size', 7);
      assert(data.shoe.size === 7);
    });

    it('can get a nested property with utils.get (2)', function() {
      const data = {
        shoe: {
          size: 5
        }
      };
      assert(apos.util.get(data, 'shoe.size') === 5);
    });

    it('can get a nested array property with utils.get', function() {
      const data = {
        shoe: {
          laces: [
            'intact',
            'busted'
          ]
        }
      };
      assert(apos.util.get(data, 'shoe.laces.0', 'intact'));
    });

    it('can set a nested array property with utils.set', function() {
      const data = {
        shoe: {
          laces: [
            'intact',
            'busted'
          ]
        }
      };
      apos.util.set(data, 'shoe.laces.0', 'gnarly');
      assert(data.shoe.laces[0] === 'gnarly');
    });

    it('can get a subobject with @ syntax', function() {
      const data = {
        shoes: [
          {
            _id: 'stylin'
          },
          {
            _id: 'busted'
          }
        ]
      };
      assert(apos.util.get(data, '@stylin')._id === 'stylin');
    });

    it('can update a subobject property with @ syntax', function() {
      const data = {
        shoes: [
          {
            _id: 'stylin',
            size: 5
          },
          {
            _id: 'busted',
            size: 6
          }
        ]
      };
      apos.util.set(data, '@stylin.size', 7);
      assert(data.shoes[0]._id === 'stylin');
      assert.strictEqual(data.shoes[0].size, 7);
    });

    it('can get a subobject property with @ syntax', function() {
      const data = {
        shoes: [
          {
            _id: 'stylin',
            size: 5
          },
          {
            _id: 'busted',
            size: 6
          }
        ]
      };
      assert(apos.util.get(data, '@stylin.size') === 5);
    });

    it('can replace a subobject with @ syntax', function() {
      const data = {
        shoes: [
          {
            _id: 'stylin',
            size: 5
          },
          {
            _id: 'busted',
            size: 6
          }
        ]
      };
      apos.util.set(data, '@stylin', {
        _id: 'stylin',
        size: 8
      });
      assert(data.shoes[0].size === 8);
    });

    it('can debounce functions and should be be awaitable with promises', async function () {
      const calledNormal = [];
      const calledAsync = [];
      const calledAsyncSlow = [];
      let asyncErrCatched = false;

      const { debounceAsync } = await getUtils();
      const debouncedNormal = debounceAsync(normalFn, 50);
      const debouncedAsync = debounceAsync(asyncFn, 50);
      const debouncedAsyncSlow = debounceAsync(asyncSlowFn, 50);
      const debouncedAsyncErr = debounceAsync(AsyncErrFn, 50);

      debouncedNormal(1);
      debouncedNormal(2);
      await debouncedNormal(3);

      debouncedAsync(1);
      await wait(100);
      debouncedAsync(2);
      await debouncedAsync(3);

      debouncedAsyncSlow(1);
      await wait(100);
      debouncedAsyncSlow(2);
      debouncedAsyncSlow(3);
      await wait(60);
      await debouncedAsyncSlow(4);

      try {
        await debouncedAsyncErr(1);
      } catch (err) {
        asyncErrCatched = true;
      }

      const actual = {
        calledNormal,
        calledAsync,
        calledAsyncSlow,
        asyncErrCatched
      };

      const expected = {
        calledNormal: [ 3, 3 ],
        calledAsync: [ 1, 1, 3, 3 ],
        calledAsyncSlow: [ 1, 1, 3, 3, 4, 4 ],
        asyncErrCatched: true
      };

      assert.deepEqual(actual, expected);

      function normalFn(num) {
        calledNormal.push(num);
        calledNormal.push(num);
        return 'test';
      };

      async function asyncFn(num) {
        calledAsync.push(num);
        await wait(50);
        calledAsync.push(num);
        return 'async';
      }

      async function asyncSlowFn(num) {
        calledAsyncSlow.push(num);
        await wait(75);
        calledAsyncSlow.push(num);
        return 'asyncSlow';
      }

    });

    it('should cancel debounced calls (sync)', async function () {
      let calledSync = [];

      function syncFn(num) {
        calledSync.push(num);
        return 'test';
      };

      const { debounceAsync } = await getUtils();
      const debouncedSync = debounceAsync(syncFn, 50);

      debouncedSync(1);
      await wait(200);
      debouncedSync(2);
      debouncedSync(3);
      debouncedSync.cancel();
      assert.deepEqual(calledSync, [ 1 ], 'should cancel all calls after the first call');
      calledSync = [];

      debouncedSync(1);
      debouncedSync(2);
      debouncedSync(3);
      debouncedSync.cancel();
      await wait(200);
      assert.deepEqual(calledSync, [], 'should cancel all calls when canceled after the 3rd call');
      calledSync = [];

      debouncedSync(1);
      debouncedSync(2);
      debouncedSync.cancel();
      debouncedSync(3);
      await wait(100);
      assert.deepEqual(calledSync, [], 'should cancel all calls when canceled after the 2nd call');
      calledSync = [];

      debouncedSync(1);
      debouncedSync(2);
      debouncedSync.cancel();
      await wait(100);
      debouncedSync(3);
      await wait(100);
      assert.deepEqual(
        calledSync,
        [],
        'should cancel all calls when canceled and called again after some time'
      );
    });

    it('should cancel debounced calls (async)', async function () {
      let calledAsync = [];

      async function asyncFn(num) {
        await wait(50);
        calledAsync.push(num);
        // Keep all console.debug around to easy debug - ensure
        // all promises are awaited before the test ends.
        console.debug('calledAsync', num);
        return 'async';
      }

      const { debounceAsync } = await getUtils();
      const debouncedAsync = debounceAsync(asyncFn, 50);

      debouncedAsync(1);
      await wait(100);
      debouncedAsync(2);
      debouncedAsync(3);
      debouncedAsync.cancel();
      await wait(200);
      assert.deepEqual(calledAsync, [ 1 ], 'should cancel all calls after the first call');
      calledAsync = [];

      debouncedAsync(1);
      debouncedAsync(2);
      debouncedAsync(3);
      debouncedAsync.cancel();
      await wait(200);
      assert.deepEqual(calledAsync, [], 'should cancel all calls when canceled after the 3rd call');
      calledAsync = [];

      debouncedAsync(1);
      debouncedAsync(2);
      debouncedAsync.cancel();
      debouncedAsync(3);
      await wait(200);
      assert.deepEqual(calledAsync, [], 'should cancel all calls when canceled after the 2nd call');
      calledAsync = [];

      debouncedAsync(1);
      debouncedAsync(2);
      debouncedAsync.cancel();
      await wait(200);
      debouncedAsync(3);
      await wait(100);
      assert.deepEqual(
        calledAsync,
        [],
        'should cancel all calls when canceled and called again after some time'
      );
    });

    it('should reject ongoing promises after debounce cancel', async function () {
      const calledAsync = [];
      async function asyncFn(num, time = 50) {
        await wait(time);
        calledAsync.push(num);
        console.debug('unstoppable async call', num);
        return 'async';
      }

      const { debounceAsync } = await getUtils();
      const debouncedAsync = debounceAsync(asyncFn, 50);
      const promise = debouncedAsync(1, 300);
      await wait(100);
      debouncedAsync.cancel();

      await assert.rejects(promise, {
        name: 'debounce.canceled',
        message: 'debounce:canceled'
      });

      assert.deepEqual(calledAsync, [ 1 ], 'the original promise should always resolve');
    });

    it('should NOT INVOKE onSuccess callback and not reject when canceled', async function () {
      const calledAsync = [];
      async function asyncStatelessFn(num, time = 50) {
        await wait(time);
        console.debug('asyncStatelessFn:', num);
        return `async ${num}`;
      }
      async function asyncSideEffectFn(result) {
        await wait(50);
        console.debug('asyncSideEffectFn:', result);
        calledAsync.push(result + ' side effect');
      }

      const { debounceAsync } = await getUtils();
      const debouncedAsync = debounceAsync(asyncStatelessFn, 50, {
        onSuccess: asyncSideEffectFn
      });
      const promise = debouncedAsync(1, 300);
      await wait(100);
      debouncedAsync.cancel();

      const result = await promise;

      assert.strictEqual(result, null);
      assert.deepEqual(
        calledAsync,
        [],
        'the side effect should not be called'
      );
    });

    it('should invoke onSuccess callback when not canceled', async function () {
      const calledAsync = [];
      async function asyncStatelessFn(num, time = 50) {
        await wait(time);
        console.debug('asyncStatelessFn:', num);
        return `async ${num}`;
      }
      async function asyncSideEffectFn(result) {
        await wait(50);
        console.debug('asyncSideEffectFn:', result);
        calledAsync.push(result + ' side effect');
      }

      const { debounceAsync } = await getUtils();
      const debouncedAsync = debounceAsync(asyncStatelessFn, 50, {
        onSuccess: asyncSideEffectFn
      });
      const result = await debouncedAsync(1);
      await wait(300);

      assert.deepEqual(
        calledAsync,
        [ 'async 1 side effect' ],
        'the side effect should be called'
      );
      assert.strictEqual(result, null);
    });

    it('should skip the next delay when invoked via skipDelay', async function () {
      const invoked = [];
      const calledAsync = [];
      async function asyncStatelessFn(num, time = 50) {
        invoked.push(num);
        await wait(time);
        console.debug('asyncStatelessFn:', num);
        return `async ${num}`;
      }
      async function asyncSideEffectFn(result) {
        await wait(50);
        console.debug('asyncSideEffectFn:', result);
        calledAsync.push(result + ' side effect');
      }

      const { debounceAsync } = await getUtils();
      const debouncedAsync = debounceAsync(asyncStatelessFn, 300, {
        onSuccess: asyncSideEffectFn
      });
      debouncedAsync.skipDelay(1, 20);
      await wait(100);
      debouncedAsync(2);

      assert.deepEqual(
        calledAsync,
        [ 'async 1 side effect' ],
        'the side effect should be called'
      );
      assert.deepEqual(
        invoked,
        [ 1 ],
        'bad invokation of the original function'
      );

      // Wait for the entire delay time to pass.
      await wait(500);
      assert.deepEqual(
        calledAsync,
        [ 'async 1 side effect', 'async 2 side effect' ],
        'the side effect should be called'
      );
      assert.deepEqual(
        invoked,
        [ 1, 2 ],
        'bad invokation of the original function after the end of the delay'
      );
    });

    it('should bounce skipDelay as well', async function () {
      const invoked = [];
      const calledAsync = [];

      async function asyncStatelessFn(num, time = 50) {
        invoked.push(num);
        await wait(time);
        console.debug('asyncStatelessFn:', num);
        return `async ${num}`;
      }
      async function asyncSideEffectFn(result) {
        await wait(50);
        console.debug('asyncSideEffectFn:', result);
        calledAsync.push(result + ' side effect');
      }

      const { debounceAsync } = await getUtils();
      const debouncedAsync = debounceAsync(asyncStatelessFn, 100, {
        onSuccess: asyncSideEffectFn
      });
      debouncedAsync(1);
      debouncedAsync.skipDelay(2);
      debouncedAsync(3);
      await wait(500);

      assert.deepEqual(
        calledAsync,
        [ 'async 1 side effect', 'async 3 side effect' ],
        'the side effect should be called'
      );
      assert.deepEqual(
        invoked,
        [ 1, 3 ],
        'bad invokation of the original function'
      );
    });

    it('can throttle functions', async function () {
      const calledNormal = [];
      const calledAsync = [];
      let asyncErrCatched = false;

      const { throttle } = await getUtils();
      const throttledNormal = throttle(normalFn, 50);
      const throttledAsync = throttle(asyncFn, 50);
      const throttledAsyncErr = throttle(AsyncErrFn, 100);

      throttledNormal(1);
      await wait(100);
      throttledNormal(2);
      throttledNormal(3);
      throttledNormal(4);

      await wait(100);
      await throttledNormal(5);

      throttledAsync(1);
      throttledAsync(2);
      await wait(100);
      await throttledAsync(3);

      try {
        await throttledAsyncErr(1);
      } catch (err) {
        asyncErrCatched = true;
      }

      const actual = {
        calledNormal,
        calledAsync,
        asyncErrCatched
      };

      const expected = {
        calledNormal: [ 1, 2, 5 ],
        calledAsync: [ 1, 3 ],
        asyncErrCatched: true
      };

      assert.deepEqual(actual, expected);

      function normalFn(num) {
        calledNormal.push(num);
        return 'test';
      };

      async function asyncFn(num, time = 50) {
        await wait(time);
        calledAsync.push(num);
        return 'async';
      }
    });

    it('should execute a queue of async tasks serially', async function () {
      const { asyncTaskQueue } = await getUtils();
      const results = [];
      const resolved = [];
      const task1 = async () => {
        await wait(100);
        results.push('task1');
        return 'task1';
      };
      const task2 = async () => {
        await wait(50);
        results.push('task2');
        return 'task2';
      };
      const task3 = async () => {
        await wait(0);
        results.push('task3');
        return 'task3';
      };

      const queue = asyncTaskQueue();
      queue.add(task1).then((result) => resolved.push(result));
      queue.add(task2).then((result) => resolved.push(result));
      queue.add(task3).then((result) => resolved.push(result));

      await wait(200);

      assert.deepEqual(results, [ 'task1', 'task2', 'task3' ]);
      assert.deepEqual(resolved, [ 'task1', 'task2', 'task3' ]);
    });
  });
});

function wait(delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('done');
    }, delay);
  });
};

async function AsyncErrFn(num, time = 50) {
  await wait();
  throw new Error('async error');
}
