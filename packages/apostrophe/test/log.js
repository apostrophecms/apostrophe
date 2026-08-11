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

// What a logger is handed: the event data alone when the call had no message
// of its own, the message and the data when it had one. The module name and
// the event type are fields, never a prefix on the message.
function assertEntry(args, message, data) {
  assert.deepEqual(args, message === undefined ? [ data ] : [ message, data ]);
}

// The renderer writes to the streams, not through the console. Restoring them
// in a finally block matters: an assertion throws, and a patched stdout would
// swallow every report that follows.
async function captured(fn) {
  const out = [];
  const err = [];
  const stdout = process.stdout.write;
  const stderr = process.stderr.write;
  const collect = (lines) => (chunk) => {
    lines.push(chunk.replace(/\n$/, ''));
    return true;
  };
  process.stdout.write = collect(out);
  process.stderr.write = collect(err);
  let result;
  try {
    result = await fn();
  } finally {
    process.stdout.write = stdout;
    process.stderr.write = stderr;
  }
  return {
    result,
    out,
    err
  };
}

function parsed(lines) {
  return lines.map((line) => JSON.parse(line));
}

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

    it('should render entries for readability', async function () {
      // id spy
      const id = apos.util.generateId;
      apos.util.generateId = () => 'test-id';

      // ### DEBUG
      const debug = await captured(() => apos.testModule.logDebug('event-type'));
      assert.deepEqual(debug.out, [ '[test-module] event-type' ]);
      assert.deepEqual(debug.err, []);

      // The developer's message, never a composed prefix
      assert.deepEqual(
        (await captured(() => apos.testModule.logDebug('event-type', 'some message'))).out,
        [ '[test-module] event-type: some message' ]
      );

      // Event data below the line
      assert.deepEqual(
        (await captured(() => apos.testModule.logDebug('event-type', { foo: 'bar' }))).out,
        [
`[test-module] event-type
{
  "foo": "bar"
}`
        ]
      );

      // Message as
      apos.structuredLog.options.messageAs = 'msg';
      assert.deepEqual(
        (await captured(() => apos.testModule.logDebug('event-type', 'some message'))).out,
        [ '[test-module] event-type: some message' ]
      );
      delete apos.structuredLog.options.messageAs;

      // ### INFO
      assert.deepEqual(
        (await captured(() => apos.testModule.logInfo('event-type'))).out,
        [ '[test-module] event-type' ]
      );

      // ### WARN - to stderr, with a badge
      const warn = await captured(() => apos.testModule.logWarn('event-type'));
      assert.deepEqual(warn.out, []);
      assert.deepEqual(warn.err, [ '[WARN] [test-module] event-type' ]);

      // ### ERROR
      const error = await captured(() => apos.testModule.logError('event-type'));
      assert.deepEqual(error.out, []);
      assert.deepEqual(error.err, [ '[ERROR] [test-module] event-type' ]);

      // With req
      const req = () => apos.task.getReq({
        originalUrl: '/module/test',
        path: '/test',
        method: 'GET',
        ip: '1.2.3.4',
        query: { foo: 'bar' }
      });
      assert.deepEqual(
        (await captured(() => apos.testModule.logError(req(), 'event-type'))).err,
        [
`[ERROR] [test-module] event-type
{
  "url": "/module/test",
  "path": "/test",
  "method": "GET",
  "ip": "1.2.3.4",
  "query": {
    "foo": "bar"
  },
  "requestId": "test-id"
}`
        ]
      );

      apos.util.generateId = id;
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
      assertEntry(savedArgs, undefined, {
        type: 'event-type',
        severity: 'debug',
        module: 'test-module'
      });

      apos.testModule.logDebug('event-type', 'a message');
      assertEntry(savedArgs, 'a message', {
        type: 'event-type',
        severity: 'debug',
        module: 'test-module'
      });

      apos.testModule.logDebug('event-type', 'a message', { foo: 'bar' });
      assertEntry(savedArgs, 'a message', {
        type: 'event-type',
        severity: 'debug',
        module: 'test-module',
        foo: 'bar'
      });

      apos.testModule.logDebug('event-type', { foo: 'bar' });
      assertEntry(savedArgs, undefined, {
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
      assertEntry(savedArgs, undefined, {
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
      assertEntry(savedArgs, 'some message', {
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
      assertEntry(savedArgs, 'some message', {
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
      assertEntry(savedArgs, undefined, {
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
      assertEntry(savedArgs, 'a message', {
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
      assertEntry(savedArgs, 'some message', {
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
      assertEntry(savedArgs, 'a message', {
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
      assertEntry(savedArgs, 'some message', {
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
      assertEntry(savedArgs, 'a message', {
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
      assertEntry(savedArgs, 'some message', {
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
      assert.equal(savedArgs.length, 1);
      savedArgs = [];
      apos.global.logError('type2');
      assert.equal(savedArgs.length, 1);

      // Matches the module type only
      savedArgs = [];
      apos.testModule.logDebug('type1');
      assert.equal(savedArgs.length, 1);

      // Matches the global severity and module type
      savedArgs = [];
      apos.testModule.logError('type1');
      assert.equal(savedArgs.length, 1);

      // Matches the global severity only
      savedArgs = [];
      apos.testModule.logError('type2');
      assert.equal(savedArgs.length, 1);

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
      assert.equal(savedArgs.length, 1);
      savedArgs = [];
      apos.testModule.logInfo('type1');
      assert.equal(savedArgs.length, 1);
      apos.testModule.logWarn('type1');
      assert.equal(savedArgs.length, 1);
      apos.testModule.logError('type1');
      assert.equal(savedArgs.length, 1);

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
      assert.equal(savedArgs.length, 1);

      savedArgs = [];
      // No match
      apos.global.logDebug('type2');
      assert.equal(savedArgs.length, 0);

      // Always match because of the event type wildcard
      savedArgs = [];
      apos.testModule.logDebug('any-type');
      assert.equal(savedArgs.length, 1);
      savedArgs = [];
      apos.testModule.logInfo('any-type');
      assert.equal(savedArgs.length, 1);
      apos.testModule.logWarn('any-type');
      assert.equal(savedArgs.length, 1);
      apos.testModule.logError('any-type');
      assert.equal(savedArgs.length, 1);

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
      assert.equal(savedArgs.length, 1);

      // Matches the type and severity
      savedArgs = [];
      apos.global.logError('type1');
      assert.equal(savedArgs.length, 1);

      // Matches the global type and module severity
      savedArgs = [];
      apos.testModule.logDebug('type1');
      assert.equal(savedArgs.length, 1);

      // Matches the global type and severity
      savedArgs = [];
      apos.testModule.logError('type1');
      assert.equal(savedArgs.length, 1);

      // Matches the global type only
      savedArgs = [];
      apos.testModule.logInfo('type1');
      assert.equal(savedArgs.length, 1);

      // Matches the module type only
      savedArgs = [];
      apos.testModule.logInfo('type2');
      assert.equal(savedArgs.length, 1);

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
        modules: { ...testModule },
        // What `auto` resolves to in production; test mode would otherwise
        // pick the readable format.
        log: { format: 'legacy' }
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

    it('should filter and render entries in the shape of past releases', async function () {
      // Below the production severity floor
      const debug = await captured(() => apos.testModule.logDebug('event-type'));
      assert.deepEqual(debug.out, []);
      assert.deepEqual(debug.err, []);

      apos.structuredLog.options.messageAs = 'msg';
      const withMessageAs = await captured(
        () => apos.testModule.logDebug('event-type', 'some message')
      );
      assert.deepEqual(withMessageAs.out, []);
      assert.deepEqual(withMessageAs.err, []);
      delete apos.structuredLog.options.messageAs;

      const info = await captured(() => apos.testModule.logInfo('event-type'));
      assert.deepEqual(info.out, []);
      assert.deepEqual(info.err, []);

      // Kept, and rendered as the message followed by the event data
      assert.deepEqual(
        (await captured(() => apos.testModule.logWarn('event-type'))).err,
        [ 'test-module: event-type {"module":"test-module","type":"event-type","severity":"warn"}' ]
      );
      assert.deepEqual(
        (await captured(() => apos.testModule.logError('event-type', 'a message'))).err,
        [
          'test-module: event-type: a message ' +
          '{"module":"test-module","type":"event-type","severity":"error"}'
        ]
      );
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
    });

    beforeEach(async function () {
      apos.util.logger.error = aposError;
      apos.util.generateId = generateId;
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
      assert.equal(savedArgs[0], 'invalid');
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
      assert.deepEqual(Object.keys(savedArgs[1]), [
        'module',
        'type',
        'severity',
        'url',
        'path',
        'method',
        'ip',
        'query',
        'requestId',
        'name',
        'status',
        'stack',
        'cause',
        'errorPath',
        'data'
      ]);
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
      assert.equal(savedArgs[0], 'Conflict error');
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

      assert(savedArgs[0].ip);
      assert(savedArgs[0].requestId);
      delete savedArgs[0].ip;
      delete savedArgs[0].requestId;
      assert.deepEqual(savedArgs[0], {
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
      assert.equal(savedArgs[0].attempts, 2);
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
      assert(savedArgs[0].ip);
      assert(savedArgs[0].requestId);
      delete savedArgs[0].ip;
      delete savedArgs[0].requestId;
      assert.deepEqual(savedArgs[0], {
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
      assert.equal(savedArgs[0].attempts, 2);
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
      assert(savedArgs[0].ip);
      assert(savedArgs[0].requestId);
      delete savedArgs[0].ip;
      delete savedArgs[0].requestId;
      assert.deepEqual(savedArgs[0], {
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
  describe('the top-level log option', function () {
    afterEach(async function () {
      await t.destroy(apos);
      apos = null;
    });

    function fakeLogger(calls) {
      const logger = { calls };
      for (const severity of [ 'debug', 'info', 'warn', 'error' ]) {
        logger[severity] = (...args) => calls.push([ severity, ...args ]);
      }
      return logger;
    }

    it('should make every line one JSON object in structured format', async function () {
      apos = await t.create({
        modules: { ...testModule },
        log: { format: 'structured' }
      });
      assert.equal(apos.logger.format, 'structured');

      // A legacy string call, in an envelope like everything else
      assert.deepEqual(
        parsed((await captured(() => apos.util.info('Listening at http://localhost:3000'))).out),
        [ {
          severity: 'info',
          msg: 'Listening at http://localhost:3000'
        } ]
      );

      // A structured event, with the message unprefixed
      assert.deepEqual(
        parsed(
          (await captured(
            () => apos.testModule.logInfo('event-type', 'a message', { foo: 'bar' })
          )).out
        ),
        [ {
          severity: 'info',
          module: 'test-module',
          type: 'event-type',
          msg: 'a message',
          foo: 'bar'
        } ]
      );

      // Severity still decides the stream
      const error = await captured(() => apos.util.error('failed'));
      assert.deepEqual(error.out, []);
      assert.deepEqual(parsed(error.err), [ {
        severity: 'error',
        msg: 'failed'
      } ]);
    });

    it('should be the whole configuration, warning about what it displaced', async function () {
      let legacyCalled = false;
      const calls = [];
      const created = await captured(() => t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: {
              messageAs: 'msg',
              logger: fakeLogger(calls),
              filter: { '*': { severity: [ 'debug' ] } }
            }
          },
          '@apostrophecms/util': {
            options: {
              logger() {
                legacyCalled = true;
                return fakeLogger(calls);
              }
            }
          }
        },
        log: {
          filter: { '*': { severity: [ 'warn', 'error' ] } }
        }
      }));
      apos = created.result;

      assert.equal(legacyCalled, false);
      assert.equal(apos.structuredLog.options.messageAs, undefined);
      assert.equal(apos.structuredLog.options.logger, undefined);
      assert.deepEqual(apos.structuredLog.filters, {
        '*': { severity: [ 'warn', 'error' ] }
      });
      // The default logger, not either of the legacy ones
      assert.equal(apos.util.logger.calls, undefined);
      assert.equal(calls.length, 0);

      const warning = created.err.join('\n');
      assert(warning.includes('ignored-log-options'));
      for (const key of [
        '"@apostrophecms/log: logger"',
        '"@apostrophecms/log: messageAs"',
        '"@apostrophecms/log: filter"',
        '"@apostrophecms/util: logger"'
      ]) {
        assert(warning.includes(key), key);
      }
    });

    it('should leave the legacy surfaces in charge when absent', async function () {
      const moduleCalls = [];
      const legacyCalls = [];
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: { logger: fakeLogger(moduleCalls) }
          }
        }
      });
      moduleCalls.length = 0;
      apos.util.info('a legacy message');
      assert.deepEqual(moduleCalls, [ [ 'info', 'a legacy message' ] ]);
      await t.destroy(apos);

      // The legacy option of @apostrophecms/util still outranks it
      apos = await t.create({
        modules: {
          ...testModule,
          '@apostrophecms/log': {
            options: { logger: fakeLogger(moduleCalls) }
          },
          '@apostrophecms/util': {
            options: {
              logger: () => fakeLogger(legacyCalls)
            }
          }
        }
      });
      moduleCalls.length = 0;
      legacyCalls.length = 0;
      apos.util.info('a legacy message');
      assert.deepEqual(moduleCalls, []);
      assert.deepEqual(legacyCalls, [ [ 'info', 'a legacy message' ] ]);
    });

    it('should accept a custom logger as an object only', async function () {
      await assert.rejects(
        t.create({ log: { logger: () => fakeLogger([]) } }),
        (e) => {
          assert(e.message.includes('must be an object'));
          return true;
        }
      );
      await assert.rejects(
        t.create({ log: { logger: { info() {} } } }),
        (e) => {
          assert(e.message.includes('Missing: debug, warn, error'));
          return true;
        }
      );
    });

    it('should deliver to a custom logger as before, minus the prefix', async function () {
      const calls = [];
      const logger = fakeLogger(calls);
      apos = await t.create({
        modules: { ...testModule },
        log: { logger }
      });
      assert.equal(apos.util.logger, logger);
      assert.equal(apos.logger.format, null);

      calls.length = 0;
      apos.testModule.logInfo('event-type', 'a message', { foo: 'bar' });
      assert.deepEqual(calls, [ [
        'info',
        'a message',
        {
          module: 'test-module',
          type: 'event-type',
          severity: 'info',
          foo: 'bar'
        }
      ] ]);

      // Nothing to pass separately when the call had no message
      calls.length = 0;
      apos.testModule.logWarn('event-type');
      assert.deepEqual(calls, [ [
        'warn',
        {
          module: 'test-module',
          type: 'event-type',
          severity: 'warn'
        }
      ] ]);

      // Legacy calls reach it exactly as they always did
      calls.length = 0;
      apos.util.error('failed', { code: 1 });
      assert.deepEqual(calls, [ [ 'error', 'failed', { code: 1 } ] ]);
    });

    it('should honor messageAs on the way to a custom logger', async function () {
      const calls = [];
      apos = await t.create({
        modules: { ...testModule },
        log: {
          logger: fakeLogger(calls),
          messageAs: 'msg'
        }
      });

      calls.length = 0;
      apos.testModule.logInfo('event-type', 'a message', { foo: 'bar' });
      assert.deepEqual(calls, [ [
        'info',
        {
          msg: 'a message',
          module: 'test-module',
          type: 'event-type',
          severity: 'info',
          foo: 'bar'
        }
      ] ]);

      calls.length = 0;
      apos.util.info('a legacy message', { foo: 'bar' });
      assert.deepEqual(calls, [ [
        'info',
        {
          foo: 'bar',
          msg: 'a legacy message'
        }
      ] ]);
    });
  });
});
