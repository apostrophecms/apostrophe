const t = require('../test-lib/test.js');
const assert = require('assert/strict');

const testModule = {
  'test-module': {
    options: {
      alias: 'testModule'
    },
    init() { }
  }
};

describe('structured logging', function () {
  this.timeout(t.timeout);

  let apos;

  after(async function () {
    return t.destroy(apos);
  });

  describe('defaults', function () {

    before(async function () {
      apos = await t.create({
        modules: { ...testModule }
      });
    });

    it('should register structured log and module log handlers', function () {
      assert(apos.structuredLog);
      assert(apos.testModule);
      assert.equal(typeof apos.testModule.logDebug, 'function');
      assert.equal(typeof apos.testModule.logInfo, 'function');
      assert.equal(typeof apos.testModule.logWarn, 'function');
      assert.equal(typeof apos.testModule.logError, 'function');
    });

    it('should format entries', function () {
      // apos.structuredLog.
    });

    it.only('should log formatted entry: logDebug', function () {
      // id spy
      const id = apos.util.generateId;
      apos.util.generateId = () => 'test-id';

      // debug spy
      const debug = apos.util.logger.debug;
      let savedArgs = [];
      apos.util.logger.debug = (...args) => {
        savedArgs = args;
      };

      // Validate
      assert.throws(() => {
        apos.testModule.logDebug();
      }, function (err) {
        assert.equal(err.message, 'Event type must be a string');
        return true;
      });
      assert.throws(() => {
        apos.testModule.logDebug(apos.task.getReq());
      }, function (err) {
        assert.equal(err.message, 'Event type must be a string');
        return true;
      });
      assert.throws(() => {
        apos.testModule.logDebug(null);
      }, function (err) {
        assert.equal(err.message, 'Event type must be a string');
        return true;
      });
      assert.throws(() => {
        apos.testModule.logDebug(1);
      }, function (err) {
        assert.equal(err.message, 'Event type must be a string');
        return true;
      });

      // Format
      apos.testModule.logDebug('event-type');
      assert.equal(savedArgs[0], 'test-module: event-type');
      assert.deepEqual(savedArgs[1], {
        type: 'event-type',
        severity: 'debug',
        module: 'test-module'
      });

      apos.testModule.logDebug('event-type', 'a message');
      assert.equal(savedArgs[0], 'test-module: event-type: a message');
      assert.deepEqual(savedArgs[1], {
        type: 'event-type',
        severity: 'debug',
        module: 'test-module'
      });

      apos.testModule.logDebug('event-type', 'a message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: a message');
      assert.deepEqual(savedArgs[1], {
        type: 'event-type',
        severity: 'debug',
        module: 'test-module',
        foo: 'bar'
      });

      apos.testModule.logDebug('event-type', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type');
      assert.deepEqual(savedArgs[1], {
        type: 'event-type',
        severity: 'debug',
        module: 'test-module',
        foo: 'bar'
      });

      apos.testModule.logDebug(apos.task.getReq({
        originalUrl: '/module/test',
        path: '/test',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type');
      assert.equal(savedArgs[0], 'test-module: event-type');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        ip: '1.2.3.4',
        query: { foo: 'bar' },
        requestId: 'test-id',
        type: 'event-type',
        severity: 'debug',
        module: 'test-module'
      });

      apos.testModule.logDebug(apos.task.getReq({
        originalUrl: '/module/test',
        path: '/test',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', 'some message');
      assert.equal(savedArgs[0], 'test-module: event-type: some message');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        ip: '1.2.3.4',
        query: { foo: 'bar' },
        requestId: 'test-id',
        type: 'event-type',
        severity: 'debug',
        module: 'test-module'
      });

      apos.testModule.logDebug(apos.task.getReq({
        originalUrl: '/module/test',
        path: '/test',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', 'some message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: some message');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        ip: '1.2.3.4',
        query: { foo: 'bar' },
        requestId: 'test-id',
        type: 'event-type',
        severity: 'debug',
        module: 'test-module',
        foo: 'bar'
      });

      apos.testModule.logDebug(apos.task.getReq({
        originalUrl: '/module/test',
        path: '/test',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        ip: '1.2.3.4',
        query: { foo: 'bar' },
        requestId: 'test-id',
        type: 'event-type',
        severity: 'debug',
        module: 'test-module',
        foo: 'bar'
      });

      apos.util.logger.debug = debug;
      apos.util.generateId = id;
    });
  });
});
