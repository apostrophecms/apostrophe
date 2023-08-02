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

    it('should format entries', function () {
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
  "type": "event-type",
  "severity": "debug",
  "module": "test-module"
}`
      );

      // Message as
      savedArgs = [];
      apos.structuredLog.options.messageAs = 'msg';
      apos.testModule.logDebug('event-type', 'some message');
      assert.equal(
        savedArgs[0],
`{
  "type": "event-type",
  "severity": "debug",
  "module": "test-module",
  "msg": "test-module: event-type: some message"
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
  "type": "event-type",
  "severity": "info",
  "module": "test-module"
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
  "type": "event-type",
  "severity": "warn",
  "module": "test-module"
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
  "type": "event-type",
  "severity": "error",
  "module": "test-module"
}`
      );

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
        '{"type":"event-type","severity":"warn","module":"test-module"}'
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
        '{"type":"event-type","severity":"error","module":"test-module"}'
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
});
