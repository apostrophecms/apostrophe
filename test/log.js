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

  after(function () {
    return t.destroy(apos);
  });

  describe('defaults', function () {

    before(async function () {
      apos = await t.create({
        modules: { ...testModule }
      });
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should register structured log and module log handlers', function () {
      assert(apos.structuredLog);
      assert(apos.testModule);
      assert.equal(typeof apos.testModule.logDebug, 'function');
      assert.equal(typeof apos.testModule.logInfo, 'function');
      assert.equal(typeof apos.testModule.logWarn, 'function');
      assert.equal(typeof apos.testModule.logError, 'function');
      assert.deepEqual(apos.structuredLog.filters, {
        '*': { severity: [ 'debug', 'info', 'warn', 'error' ] }
      });
    });

    it('should format entries for readability', function () {
      // id spy
      const id = apos.util.generateId;
      apos.util.generateId = () => 'test-id';
      let savedArgs = [];

      // ### DEBUG
      const debug = console.debug;
      console.debug = (...args) => {
        savedArgs = args;
      };

      // Validate formatting
      savedArgs = [];
      apos.testModule.logDebug('event-type');
      assert.equal(savedArgs[0], 'test-module: event-type\n');
      assert.equal(
        savedArgs[1],
`{
  "module": "test-module",
  "type": "event-type",
  "severity": "debug"
}`
      );

      // Message as
      savedArgs = [];
      apos.structuredLog.options.messageAs = 'msg';
      apos.testModule.logDebug('event-type', 'some message');
      assert.equal(
        savedArgs[0],
`{
  "msg": "test-module: event-type: some message",
  "module": "test-module",
  "type": "event-type",
  "severity": "debug"
}`
      );
      assert.equal(typeof savedArgs[1], 'undefined');
      delete apos.structuredLog.options.messageAs;

      // ### INFO
      const info = console.info;
      console.info = (...args) => {
        savedArgs = args;
      };

      // Validate formatting
      savedArgs = [];
      apos.testModule.logInfo('event-type');
      assert.equal(savedArgs[0], 'test-module: event-type\n');
      assert.equal(
        savedArgs[1],
`{
  "module": "test-module",
  "type": "event-type",
  "severity": "info"
}`
      );

      // ### WARN
      const warn = console.warn;
      console.warn = (...args) => {
        savedArgs = args;
      };

      // Validate formatting
      savedArgs = [];
      apos.testModule.logWarn('event-type');
      assert.equal(savedArgs[0], 'test-module: event-type\n');
      assert.equal(
        savedArgs[1],
`{
  "module": "test-module",
  "type": "event-type",
  "severity": "warn"
}`
      );

      // ### ERROR
      const error = console.error;
      console.error = (...args) => {
        savedArgs = args;
      };

      // Validate formatting
      savedArgs = [];
      apos.testModule.logError('event-type');
      assert.equal(savedArgs[0], 'test-module: event-type\n');
      assert.equal(
        savedArgs[1],
`{
  "module": "test-module",
  "type": "event-type",
  "severity": "error"
}`
      );

      // With req
      savedArgs = [];
      apos.testModule.logError(
        apos.task.getReq({
          originalUrl: '/module/test',
          path: '/test',
          method: 'GET',
          ip: '1.2.3.4',
          query: { foo: 'bar' }
        }),
        'event-type'
      );
      assert.equal(savedArgs[0], 'test-module: event-type\n');
      assert.equal(
        savedArgs[1],
`{
  "module": "test-module",
  "type": "event-type",
  "severity": "error",
  "url": "/module/test",
  "path": "/test",
  "method": "GET",
  "ip": "1.2.3.4",
  "query": {
    "foo": "bar"
  },
  "requestId": "test-id"
}`
      );

      // With req and message as
      savedArgs = [];
      apos.structuredLog.options.messageAs = 'message';
      apos.testModule.logError(
        apos.task.getReq({
          originalUrl: '/module/test',
          path: '/test',
          method: 'GET',
          ip: '1.2.3.4',
          query: { foo: 'bar' }
        }),
        'event-type'
      );
      assert.equal(savedArgs.length, 1);
      assert.equal(
        savedArgs[0],
`{
  "message": "test-module: event-type",
  "module": "test-module",
  "type": "event-type",
  "severity": "error",
  "url": "/module/test",
  "path": "/test",
  "method": "GET",
  "ip": "1.2.3.4",
  "query": {
    "foo": "bar"
  },
  "requestId": "test-id"
}`
      );
      delete apos.structuredLog.options.messageAs;

      apos.util.generateId = id;
      console.debug = debug;
      console.info = info;
      console.warn = warn;
      console.error = error;
    });

    it('should log formatted entry: logDebug', function () {
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
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type');
      assert.equal(savedArgs[0], 'test-module: event-type');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        method: 'GET',
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
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', 'some message');
      assert.equal(savedArgs[0], 'test-module: event-type: some message');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        method: 'GET',
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
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', 'some message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: some message');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        method: 'GET',
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
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        method: 'GET',
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

    it('should log formatted entry: logInfo', function () {
      // id spy
      const id = apos.util.generateId;
      apos.util.generateId = () => 'test-id';

      // debug spy
      const info = apos.util.logger.info;
      let savedArgs = [];
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };

      // Validate
      assert.throws(() => {
        apos.testModule.logInfo();
      }, function (err) {
        assert.equal(err.message, 'Event type must be a string');
        return true;
      });

      // Format
      apos.testModule.logInfo('event-type', 'a message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: a message');
      assert.deepEqual(savedArgs[1], {
        type: 'event-type',
        severity: 'info',
        module: 'test-module',
        foo: 'bar'
      });

      apos.testModule.logInfo(apos.task.getReq({
        originalUrl: '/module/test',
        path: '/test',
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', 'some message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: some message');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' },
        requestId: 'test-id',
        type: 'event-type',
        severity: 'info',
        module: 'test-module',
        foo: 'bar'
      });

      apos.util.logger.info = info;
      apos.util.generateId = id;
    });

    it('should log formatted entry: logWarn', function () {
      // id spy
      const id = apos.util.generateId;
      apos.util.generateId = () => 'test-id';

      // debug spy
      const warn = apos.util.logger.warn;
      let savedArgs = [];
      apos.util.logger.warn = (...args) => {
        savedArgs = args;
      };

      // Validate
      assert.throws(() => {
        apos.testModule.logWarn();
      }, function (err) {
        assert.equal(err.message, 'Event type must be a string');
        return true;
      });

      // Format
      apos.testModule.logWarn('event-type', 'a message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: a message');
      assert.deepEqual(savedArgs[1], {
        type: 'event-type',
        severity: 'warn',
        module: 'test-module',
        foo: 'bar'
      });

      apos.testModule.logWarn(apos.task.getReq({
        originalUrl: '/module/test',
        path: '/test',
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', 'some message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: some message');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' },
        requestId: 'test-id',
        type: 'event-type',
        severity: 'warn',
        module: 'test-module',
        foo: 'bar'
      });

      apos.util.logger.warn = warn;
      apos.util.generateId = id;
    });

    it('should log formatted entry: logError', function () {
      // id spy
      const id = apos.util.generateId;
      apos.util.generateId = () => 'test-id';

      // debug spy
      const error = apos.util.logger.error;
      let savedArgs = [];
      apos.util.logger.error = (...args) => {
        savedArgs = args;
      };

      // Validate
      assert.throws(() => {
        apos.testModule.logError();
      }, function (err) {
        assert.equal(err.message, 'Event type must be a string');
        return true;
      });

      // Format
      apos.testModule.logError('event-type', 'a message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: a message');
      assert.deepEqual(savedArgs[1], {
        type: 'event-type',
        severity: 'error',
        module: 'test-module',
        foo: 'bar'
      });

      apos.testModule.logError(apos.task.getReq({
        originalUrl: '/module/test',
        path: '/test',
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      }), 'event-type', 'some message', { foo: 'bar' });
      assert.equal(savedArgs[0], 'test-module: event-type: some message');
      assert.deepEqual(savedArgs[1], {
        url: '/module/test',
        path: '/test',
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' },
        requestId: 'test-id',
        type: 'event-type',
        severity: 'error',
        module: 'test-module',
        foo: 'bar'
      });

      apos.util.logger.error = error;
      apos.util.generateId = id;
    });

    it('should filter entries with minimal config', async function () {
      await t.destroy(apos);
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: {
              filter: {
                '*': {
                  severity: [ 'error' ]
                },
                'test-module': {
                  events: [ 'type1' ]
                }
              }
            }
          }
        }
      });

      assert.deepEqual(apos.structuredLog.filters, {
        '*': {
          severity: [ 'error' ]
        },
        'test-module': {
          events: [ 'type1' ]
        }
      });

      let savedArgs = [];
      const debug = apos.util.logger.debug;
      apos.util.logger.debug = (...args) => {
        savedArgs = args;
      };
      const info = apos.util.logger.info;
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };
      const warn = apos.util.logger.warn;
      apos.util.logger.warn = (...args) => {
        savedArgs = args;
      };
      const error = apos.util.logger.error;
      apos.util.logger.error = (...args) => {
        savedArgs = args;
      };

      // ### DEBUG
      // No match
      apos.global.logDebug('type2');
      assert.equal(savedArgs.length, 0);

      // No match - type from another module
      savedArgs = [];
      apos.global.logDebug('type1');
      assert.equal(savedArgs.length, 0);

      // Matches the global severity
      savedArgs = [];
      apos.global.logError('type1');
      assert.equal(savedArgs.length, 2);
      savedArgs = [];
      apos.global.logError('type2');
      assert.equal(savedArgs.length, 2);

      // Matches the module type only
      savedArgs = [];
      apos.testModule.logDebug('type1');
      assert.equal(savedArgs.length, 2);

      // Matches the global severity and module type
      savedArgs = [];
      apos.testModule.logError('type1');
      assert.equal(savedArgs.length, 2);

      // Matches the global severity only
      savedArgs = [];
      apos.testModule.logError('type2');
      assert.equal(savedArgs.length, 2);

      // No match
      savedArgs = [];
      apos.testModule.logWarn('type3');
      assert.equal(savedArgs.length, 0);

      apos.util.logger.debug = debug;
      apos.util.logger.info = info;
      apos.util.logger.warn = warn;
      apos.util.logger.error = error;
    });

    it('should match all with wildcard global config', async function () {
      await t.destroy(apos);
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: {
              filter: {
                '*': true
              }
            }
          }
        }
      });

      assert.deepEqual(apos.structuredLog.filters, {
        '*': {
          severity: [ 'debug', 'info', 'warn', 'error' ]
        }
      });

      let savedArgs = [];
      const debug = apos.util.logger.debug;
      apos.util.logger.debug = (...args) => {
        savedArgs = args;
      };
      const info = apos.util.logger.info;
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };
      const warn = apos.util.logger.warn;
      apos.util.logger.warn = (...args) => {
        savedArgs = args;
      };
      const error = apos.util.logger.error;
      apos.util.logger.error = (...args) => {
        savedArgs = args;
      };

      // ### DEBUG
      savedArgs = [];
      apos.testModule.logDebug('type1');
      assert.equal(savedArgs.length, 2);
      savedArgs = [];
      apos.testModule.logInfo('type1');
      assert.equal(savedArgs.length, 2);
      apos.testModule.logWarn('type1');
      assert.equal(savedArgs.length, 2);
      apos.testModule.logError('type1');
      assert.equal(savedArgs.length, 2);

      apos.util.logger.debug = debug;
      apos.util.logger.info = info;
      apos.util.logger.warn = warn;
      apos.util.logger.error = error;
    });

    it('should filter entries with wildcard module events config', async function () {
      await t.destroy(apos);
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: {
              filter: {
                '*': {
                  severity: [ 'error' ],
                  events: [ 'type1' ]
                },
                'test-module': {
                  events: '*'
                }
              }
            }
          }
        }
      });

      assert.deepEqual(apos.structuredLog.filters, {
        '*': {
          severity: [ 'error' ],
          events: [ 'type1' ]
        },
        'test-module': {
          events: [ '*' ]
        }
      });

      let savedArgs = [];
      const debug = apos.util.logger.debug;
      apos.util.logger.debug = (...args) => {
        savedArgs = args;
      };
      const info = apos.util.logger.info;
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };
      const warn = apos.util.logger.warn;
      apos.util.logger.warn = (...args) => {
        savedArgs = args;
      };
      const error = apos.util.logger.error;
      apos.util.logger.error = (...args) => {
        savedArgs = args;
      };

      // ### DEBUG
      savedArgs = [];
      // Match the global type only
      apos.global.logDebug('type1');
      assert.equal(savedArgs.length, 2);

      savedArgs = [];
      // No match
      apos.global.logDebug('type2');
      assert.equal(savedArgs.length, 0);

      // Always match because of the event type wildcard
      savedArgs = [];
      apos.testModule.logDebug('any-type');
      assert.equal(savedArgs.length, 2);
      savedArgs = [];
      apos.testModule.logInfo('any-type');
      assert.equal(savedArgs.length, 2);
      apos.testModule.logWarn('any-type');
      assert.equal(savedArgs.length, 2);
      apos.testModule.logError('any-type');
      assert.equal(savedArgs.length, 2);

      apos.util.logger.debug = debug;
      apos.util.logger.info = info;
      apos.util.logger.warn = warn;
      apos.util.logger.error = error;
    });

    it('should filter entries with verbose config', async function () {
      await t.destroy(apos);
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: {
              filter: {
                '*': {
                  severity: [ 'error' ],
                  events: [ 'type1' ]
                },
                'test-module': {
                  severity: [ 'debug' ],
                  events: [ 'type2' ]
                }
              }
            }
          }
        }
      });

      assert.deepEqual(apos.structuredLog.filters, {
        '*': {
          severity: [ 'error' ],
          events: [ 'type1' ]
        },
        'test-module': {
          severity: [ 'debug' ],
          events: [ 'type2' ]
        }
      });

      let savedArgs = [];
      const debug = apos.util.logger.debug;
      apos.util.logger.debug = (...args) => {
        savedArgs = args;
      };
      const info = apos.util.logger.info;
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };
      const warn = apos.util.logger.warn;
      apos.util.logger.warn = (...args) => {
        savedArgs = args;
      };
      const error = apos.util.logger.error;
      apos.util.logger.error = (...args) => {
        savedArgs = args;
      };

      // ### DEBUG
      // No match
      apos.global.logDebug('type2');
      assert.equal(savedArgs.length, 0);

      // Matches the type only
      savedArgs = [];
      apos.global.logDebug('type1');
      assert.equal(savedArgs.length, 2);

      // Matches the type and severity
      savedArgs = [];
      apos.global.logError('type1');
      assert.equal(savedArgs.length, 2);

      // Matches the global type and module severity
      savedArgs = [];
      apos.testModule.logDebug('type1');
      assert.equal(savedArgs.length, 2);

      // Matches the global type and severity
      savedArgs = [];
      apos.testModule.logError('type1');
      assert.equal(savedArgs.length, 2);

      // Matches the global type only
      savedArgs = [];
      apos.testModule.logInfo('type1');
      assert.equal(savedArgs.length, 2);

      // Matches the module type only
      savedArgs = [];
      apos.testModule.logInfo('type2');
      assert.equal(savedArgs.length, 2);

      // No match
      savedArgs = [];
      apos.testModule.logWarn('type3');
      assert.equal(savedArgs.length, 0);

      apos.util.logger.debug = debug;
      apos.util.logger.info = info;
      apos.util.logger.warn = warn;
      apos.util.logger.error = error;
    });

    it('it should shutdown logger', async function () {
      await t.destroy(apos);
      apos = await t.create({});

      let called = false;
      apos.util.logger.destroy = async () => {
        called = true;
      };
      await t.destroy(apos);
      apos = null;

      assert.equal(called, true);
    });
  });

  describe('production', function () {
    before(async function () {
      process.env.NODE_ENV = 'production';
      apos = await t.create({
        modules: { ...testModule }
      });
    });

    after(async function () {
      delete process.env.NODE_ENV;
      await t.destroy(apos);
      apos = null;
    });

    it('should set filter configuration', function () {
      assert.deepEqual(apos.structuredLog.filters, {
        '*': { severity: [ 'warn', 'error' ] }
      });
    });

    it('should filter and format entries', function () {
      // id spy
      const id = apos.util.generateId;
      apos.util.generateId = () => 'test-id';
      let savedArgs = [];

      // ### DEBUG
      const debug = console.debug;
      console.debug = (...args) => {
        savedArgs = args;
      };

      // Validate formatting
      savedArgs = [];
      apos.testModule.logDebug('event-type');
      assert.equal(typeof savedArgs[0], 'undefined');
      assert.equal(typeof savedArgs[1], 'undefined');

      // Message as
      savedArgs = [];
      apos.structuredLog.options.messageAs = 'msg';
      apos.testModule.logDebug('event-type', 'some message');
      assert.equal(typeof savedArgs[0], 'undefined');
      assert.equal(typeof savedArgs[1], 'undefined');
      delete apos.structuredLog.options.messageAs;

      // ### INFO
      const info = console.info;
      console.info = (...args) => {
        savedArgs = args;
      };

      // Validate formatting
      savedArgs = [];
      apos.testModule.logInfo('event-type');
      assert.equal(typeof savedArgs[0], 'undefined');
      assert.equal(typeof savedArgs[1], 'undefined');

      // ### WARN
      const warn = console.warn;
      console.warn = (...args) => {
        savedArgs = args;
      };

      // Validate formatting
      savedArgs = [];
      apos.testModule.logWarn('event-type');
      assert.equal(savedArgs[0], 'test-module: event-type');
      assert.equal(
        savedArgs[1],
        '{"module":"test-module","type":"event-type","severity":"warn"}'
      );

      // ### ERROR
      const error = console.error;
      console.error = (...args) => {
        savedArgs = args;
      };

      // Validate formatting
      savedArgs = [];
      apos.testModule.logError('event-type');
      assert.equal(savedArgs[0], 'test-module: event-type');
      assert.equal(
        savedArgs[1],
        '{"module":"test-module","type":"event-type","severity":"error"}'
      );

      apos.util.generateId = id;
      console.debug = debug;
      console.info = info;
      console.warn = warn;
      console.error = error;
    });

    it('should override default filter configuration', async function () {
      await t.destroy(apos);
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: {
              filter: {
                '*': { severity: [ 'info', 'warn', 'error' ] }
              }
            }
          }
        }
      });

      assert.deepEqual(apos.structuredLog.filters, {
        '*': { severity: [ 'info', 'warn', 'error' ] }
      });
    });
  });

  describe('APOS_FILTER_LOGS', function () {
    beforeEach(async function () {
      await t.destroy(apos);
      apos = null;
    });

    after(async function () {
      delete process.env.APOS_FILTER_LOGS;
      await t.destroy(apos);
      apos = null;
    });

    it('should override default filter configuration (wildcard)', async function () {
      process.env.APOS_FILTER_LOGS = '*';
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: {
              filter: {
                '*': { severity: [ 'info', 'warn', 'error' ] },
                'test-module': { events: [ 'type1' ] }
              }
            }
          }
        }
      });

      assert.deepEqual(apos.structuredLog.filters, {
        '*': {
          severity: [ 'debug', 'info', 'warn', 'error' ]
        }
      });
    });

    it('should override filter configuration via env', async function () {
      process.env.APOS_FILTER_LOGS = '*:severity:warn,error;test-module:events:type1,type2:severity:info';
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: {
              filter: {
                '*': { severity: [ 'info', 'warn', 'error' ] },
                'test-module': { events: [ 'type3' ] }
              }
            }
          }
        }
      });

      assert.deepEqual(apos.structuredLog.filters, {
        '*': {
          severity: [ 'warn', 'error' ]
        },
        'test-module': {
          severity: [ 'info' ],
          events: [ 'type1', 'type2' ]
        }
      });
    });
  });

  describe('legacy logging with :messageAs"', function () {
    before(async function () {
      await t.destroy(apos);
      apos = await t.create({
        modules: {
          '@apostrophecms/log': {
            options: {
              messageAs: 'msg'
            }
          }
        }
      });
    });

    after(async function () {
      delete process.env.APOS_FILTER_LOGS;
      await t.destroy(apos);
      apos = null;
    });

    it('should log object: debug', function () {
      let savedArgs = [];
      const saved = apos.util.logger.debug;
      apos.util.logger.debug = (...args) => {
        savedArgs = args;
      };

      savedArgs = [];
      apos.util.debug('some message');
      assert.deepEqual(savedArgs, [ { msg: 'some message' } ]);

      savedArgs = [];
      apos.util.debug({ foo: 'bar' });
      assert.deepEqual(savedArgs, [ { foo: 'bar' } ]);

      savedArgs = [];
      apos.util.debug('some message', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message'
      } ]);

      savedArgs = [];
      apos.util.debug('some message', 'more', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      savedArgs = [];
      apos.util.debug({ foo: 'bar' }, 'some message', 'more');
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      apos.util.logger.debug = saved;
    });

    it('should log object: log', function () {
      let savedArgs = [];
      const saved = apos.util.logger.log;
      apos.util.logger.log = (...args) => {
        savedArgs = args;
      };

      savedArgs = [];
      apos.util.log('some message');
      assert.deepEqual(savedArgs, [ { msg: 'some message' } ]);

      savedArgs = [];
      apos.util.log({ foo: 'bar' });
      assert.deepEqual(savedArgs, [ { foo: 'bar' } ]);

      savedArgs = [];
      apos.util.log('some message', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message'
      } ]);

      savedArgs = [];
      apos.util.log('some message', 'more', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      savedArgs = [];
      apos.util.log({ foo: 'bar' }, 'some message', 'more');
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      apos.util.logger.log = saved;
    });

    it('should log object: info', function () {
      let savedArgs = [];
      const saved = apos.util.logger.info;
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };

      savedArgs = [];
      apos.util.info('some message');
      assert.deepEqual(savedArgs, [ { msg: 'some message' } ]);

      savedArgs = [];
      apos.util.info({ foo: 'bar' });
      assert.deepEqual(savedArgs, [ { foo: 'bar' } ]);

      savedArgs = [];
      apos.util.info('some message', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message'
      } ]);

      savedArgs = [];
      apos.util.info('some message', 'more', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      savedArgs = [];
      apos.util.info({ foo: 'bar' }, 'some message', 'more');
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      apos.util.logger.info = saved;
    });

    it('should log object: warn', function () {
      let savedArgs = [];
      const saved = apos.util.logger.warn;
      apos.util.logger.warn = (...args) => {
        savedArgs = args;
      };

      savedArgs = [];
      apos.util.warn('some message');
      assert.deepEqual(savedArgs, [ { msg: 'some message' } ]);

      savedArgs = [];
      apos.util.warn({ foo: 'bar' });
      assert.deepEqual(savedArgs, [ { foo: 'bar' } ]);

      savedArgs = [];
      apos.util.warn('some message', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message'
      } ]);

      savedArgs = [];
      apos.util.warn('some message', 'more', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      savedArgs = [];
      apos.util.warn({ foo: 'bar' }, 'some message', 'more');
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      apos.util.logger.warn = saved;
    });

    it('should log object: error', function () {
      let savedArgs = [];
      const saved = apos.util.logger.error;
      apos.util.logger.error = (...args) => {
        savedArgs = args;
      };

      savedArgs = [];
      apos.util.error('some message');
      assert.deepEqual(savedArgs, [ { msg: 'some message' } ]);

      savedArgs = [];
      apos.util.error({ foo: 'bar' });
      assert.deepEqual(savedArgs, [ { foo: 'bar' } ]);

      savedArgs = [];
      apos.util.error('some message', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message'
      } ]);

      savedArgs = [];
      apos.util.error('some message', 'more', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      savedArgs = [];
      apos.util.error({ foo: 'bar' }, 'some message', 'more');
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      apos.util.logger.error = saved;
    });

    it('should log object: warnDev', function () {
      let savedArgs = [];
      const saved = apos.util.logger.warn;
      apos.util.logger.warn = (...args) => {
        savedArgs = args;
      };

      savedArgs = [];
      apos.util.warnDev('some message');
      assert.deepEqual(savedArgs, [ {
        msg: '⚠️  some message'
      } ]);

      savedArgs = [];
      apos.util.warnDev({ foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar'
      }
      ]);

      savedArgs = [];
      apos.util.warnDev('some message', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: '⚠️  some message'
      } ]);

      savedArgs = [];
      apos.util.warnDev('some message', 'more', { foo: 'bar' });
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: '⚠️  some message',
        args: [ 'more' ]
      } ]);

      savedArgs = [];
      apos.util.warnDev({ foo: 'bar' }, 'some message', 'more');
      assert.deepEqual(savedArgs, [ {
        foo: 'bar',
        msg: 'some message',
        args: [ 'more' ]
      } ]);

      apos.util.logger.warn = saved;
    });
  });

  describe('route error', function () {
    let user;
    let jar;
    let aposError;
    let consoleError;
    let generateId;

    async function login() {
      // Create user and initialize session.
      if (!user) {
        user = await t.createAdmin(apos, {
          username: 'admin',
          password: 'admin'
        });
      }
      jar = await t.getUserJar(apos, user);
      await apos.http.get('/', { jar });
    }

    before(async function () {
      await t.destroy(apos);
      apos = await t.create({
        modules: {
          'test-piece': {
            extend: '@apostrophecms/piece-type',
            fields: {
              add: {
                field1: {
                  type: 'string',
                  label: 'Field1',
                  required: true
                },
                field2: {
                  type: 'string',
                  label: 'Field2',
                  required: true
                }
              }
            }
          },
          'test-module': {
            apiRoutes(self) {
              return {
                post: {
                  async conflict(req) {
                    const err = self.apos.error(
                      'conflict',
                      'Conflict error',
                      { some: 'data' }
                    );
                    err.path = 'some.field';
                    throw err;
                  }
                }
              };
            }
          }
        }
      });
      await login();
      aposError = apos.util.logger.error;
      generateId = apos.util.generateId;
      consoleError = console.error;
    });

    beforeEach(async function () {
      apos.util.logger.error = aposError;
      apos.util.generateId = generateId;
      console.error = consoleError;
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should log invalid error', async function () {
      apos.util.generateId = () => 'test-id';
      let savedArgs = [];
      apos.util.logger.error = (...args) => {
        savedArgs = args;
      };
      try {
        await apos.http.post('/api/v1/test-piece', {
          body: {},
          jar
        });
      } catch (e) {
        //
      }
      assert.equal(savedArgs[0], 'test-piece: api-error-invalid: invalid');
      assert.equal(savedArgs[1].module, 'test-piece');
      assert.equal(savedArgs[1].type, 'api-error-invalid');
      assert.equal(savedArgs[1].severity, 'error');
      assert.equal(savedArgs[1].url, '/api/v1/test-piece');
      assert.equal(savedArgs[1].path, '/api/v1/test-piece');
      assert.equal(savedArgs[1].method, 'POST');
      assert(savedArgs[1].ip);
      assert.deepEqual(savedArgs[1].query, {});
      assert.equal(savedArgs[1].requestId, 'test-id');
      assert.equal(savedArgs[1].name, 'invalid');
      assert.equal(Array.isArray(savedArgs[1].stack), true);
      assert.equal(savedArgs[1].errorPath, undefined);
      assert.deepEqual(savedArgs[1].data.errors, [
        {
          name: 'required',
          code: 422,
          message: 'required',
          data: {},
          path: 'title'
        },
        {
          name: 'required',
          code: 422,
          message: 'required',
          data: {},
          path: 'field1'
        },
        {
          name: 'required',
          code: 422,
          message: 'required',
          data: {},
          path: 'field2'
        }
      ]);

      // Test the property order
      savedArgs = [];
      apos.util.logger.error = aposError;
      console.error = (...args) => {
        savedArgs = args;
      };

      try {
        await apos.http.post('/api/v1/test-piece', {
          body: {},
          jar
        });
      } catch (e) {
        //
      }
      // Skip IP as it might get changed in CI
      assert.equal(savedArgs[0], 'test-piece: api-error-invalid: invalid\n');
      assert.equal(
        savedArgs[1].startsWith(
`{
  "module": "test-piece",
  "type": "api-error-invalid",
  "severity": "error",
  "url": "/api/v1/test-piece",
  "path": "/api/v1/test-piece",
  "method": "POST",
`
        ),
        true
      );
      assert.equal(
        savedArgs[1].includes(
`
  "query": {},
  "requestId": "test-id",
  "name": "invalid",
  "status": 400,
  "stack": [
`
        ),
        true
      );
      assert.equal(
        savedArgs[1].endsWith(
`
  ],
  "data": {
    "errors": [
      {
        "name": "required",
        "code": 422,
        "message": "required",
        "data": {},
        "path": "title"
      },
      {
        "name": "required",
        "code": 422,
        "message": "required",
        "data": {},
        "path": "field1"
      },
      {
        "name": "required",
        "code": 422,
        "message": "required",
        "data": {},
        "path": "field2"
      }
    ]
  }
}`
        ),
        true
      );

    });

    it('should log conflict error with data and custom message', async function () {
      apos.util.generateId = () => 'test-id';
      let savedArgs = [];
      apos.util.logger.error = (...args) => {
        savedArgs = args;
      };
      try {
        await apos.http.post('/api/v1/test-module/conflict', {
          qs: { foo: 'bar' },
          jar
        });
      } catch (e) {
        //
      }
      assert.equal(savedArgs[0], 'test-module: api-error-conflict: Conflict error');
      assert.equal(savedArgs[1].module, 'test-module');
      assert.equal(savedArgs[1].type, 'api-error-conflict');
      assert.equal(savedArgs[1].severity, 'error');
      assert.equal(savedArgs[1].url, '/api/v1/test-module/conflict?foo=bar');
      assert.equal(savedArgs[1].path, '/api/v1/test-module/conflict');
      assert.equal(savedArgs[1].method, 'POST');
      assert(savedArgs[1].ip);
      assert.deepEqual(savedArgs[1].query, { foo: 'bar' });
      assert.equal(savedArgs[1].requestId, 'test-id');
      assert.equal(savedArgs[1].name, 'conflict');
      assert.equal(Array.isArray(savedArgs[1].stack), true);
      assert.equal(savedArgs[1].errorPath, 'some.field');
      assert.deepEqual(savedArgs[1].data, { some: 'data' });
    });
  });

  describe('login', function () {
    let user;
    let aposInfo;

    async function createInstance() {
      apos = await t.create({
        modules: {
          '@apostrophecms/log': {
            options: {
              filter: {
                '*': {
                  severity: [ 'info' ]
                },
                '@apostrophecms/login': {
                  events: [
                    'incorrect-username',
                    'incorrect-password',
                    'correct-password',
                    'complete'
                  ]
                }
              }
            }
          }
        }
      });
      aposInfo = apos.util.logger.info;
      user = await t.createAdmin(apos, {
        username: 'admin',
        password: 'admin'
      });
      user.password = 'admin';
    }

    before(async function () {
      await t.destroy(apos);
      await createInstance();
    });

    beforeEach(async function () {
      apos.util.logger.info = aposInfo;
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should log incorrect username', async function () {
      let savedArgs = [];
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };
      const jar = apos.http.jar();
      try {
        await apos.http.post('/api/v1/@apostrophecms/login/login', {
          body: {
            username: 'incorrect',
            password: user.password,
            session: true
          },
          jar
        });
      } catch (e) {
        //
      }

      assert.equal(savedArgs[0], '@apostrophecms/login: incorrect-username');
      assert(savedArgs[1].ip);
      assert(savedArgs[1].requestId);
      delete savedArgs[1].ip;
      delete savedArgs[1].requestId;
      assert.deepEqual(savedArgs[1], {
        module: '@apostrophecms/login',
        type: 'incorrect-username',
        severity: 'info',
        username: 'incorrect',
        attempts: 1
      });

      savedArgs = [];
      try {
        await apos.http.post('/api/v1/@apostrophecms/login/login', {
          body: {
            username: 'incorrect',
            password: user.password,
            session: true
          },
          jar
        });
      } catch (e) {
        //
      }
      assert.equal(savedArgs[1].attempts, 2);
    });

    it('should log incorrect password', async function () {
      await t.destroy(apos);
      await createInstance();
      let savedArgs = [];
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };
      const jar = apos.http.jar();
      try {
        await apos.http.post('/api/v1/@apostrophecms/login/login', {
          body: {
            username: user.password,
            password: 'incorrect',
            session: true
          },
          jar
        });
      } catch (e) {
        //
      }
      assert.equal(savedArgs[0], '@apostrophecms/login: incorrect-password');
      assert(savedArgs[1].ip);
      assert(savedArgs[1].requestId);
      delete savedArgs[1].ip;
      delete savedArgs[1].requestId;
      assert.deepEqual(savedArgs[1], {
        module: '@apostrophecms/login',
        type: 'incorrect-password',
        severity: 'info',
        username: user.username,
        attempts: 1
      });

      savedArgs = [];
      try {
        await apos.http.post('/api/v1/@apostrophecms/login/login', {
          body: {
            username: user.password,
            password: 'incorrect',
            session: true
          },
          jar
        });
      } catch (e) {
        //
      }
      assert.equal(savedArgs[1].attempts, 2);
    });

    it('should log login complete', async function () {
      await t.destroy(apos);
      await createInstance();

      const jar = apos.http.jar();
      try {
        await apos.http.post('/api/v1/@apostrophecms/login/login', {
          body: {
            username: user.password,
            password: 'incorrect',
            session: true
          },
          jar
        });
      } catch (e) {
        //
      }

      let savedArgs = [];
      apos.util.logger.info = (...args) => {
        savedArgs = args;
      };
      savedArgs = [];
      try {
        await apos.http.post('/api/v1/@apostrophecms/login/login', {
          body: {
            username: user.password,
            password: user.password,
            session: true
          },
          jar
        });
      } catch (e) {
        //
      }
      assert.equal(savedArgs[0], '@apostrophecms/login: complete');
      assert(savedArgs[1].ip);
      assert(savedArgs[1].requestId);
      delete savedArgs[1].ip;
      delete savedArgs[1].requestId;
      assert.deepEqual(savedArgs[1], {
        module: '@apostrophecms/login',
        type: 'complete',
        severity: 'info',
        url: '/api/v1/@apostrophecms/login/login',
        path: '/api/v1/@apostrophecms/login/login',
        method: 'POST',
        query: {},
        username: 'admin',
        attempts: 1
      });
    });
  });
});
