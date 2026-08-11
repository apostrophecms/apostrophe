const assert = require('assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const createLogger = require('../logger.js');
const { supportsColor } = require('../lib/logger/style.js');

const ESC = '\u001b';

const ENV_KEYS = [
  'APOS_LOG_FORMAT',
  'NODE_ENV',
  'NO_COLOR',
  'FORCE_COLOR',
  'CI',
  'TERM'
];

// Streams that collect what would have been written, standing in for
// stdout/stderr. `isTTY` drives auto detection.
function capture(isTTY = false) {
  const out = [];
  const err = [];
  return {
    out,
    err,
    streams: {
      out: {
        isTTY,
        write: (chunk) => out.push(chunk)
      },
      err: {
        write: (chunk) => err.push(chunk)
      }
    }
  };
}

function lines(chunks) {
  return chunks.map((chunk) => chunk.replace(/\n$/, ''));
}

function escaped(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('standalone logger', function () {
  const savedEnv = {};
  const savedArgv = process.argv;

  beforeEach(function () {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Never let the ambient terminal decide what a test asserts.
    process.env.NO_COLOR = '1';
  });

  afterEach(function () {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    process.argv = savedArgv;
  });

  describe('entry point', function () {
    it('should be reachable as apostrophe/logger', function () {
      assert.equal(typeof createLogger, 'function');
      assert.equal(createLogger, require('../lib/logger/index.js'));
    });

    it('should work in a bare node script with no framework init', function () {
      const entry = path.join(__dirname, '..', 'logger');
      const script = `
        const createLogger = require(${JSON.stringify(entry)});
        const logger = createLogger({ format: 'structured' });
        logger.info('bare-script', { ok: true });
      `;
      const result = spawnSync(process.execPath, [ '-e', script ], {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH
        }
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        severity: 'info',
        type: 'bare-script',
        ok: true
      });
    });

    it('should expose the log methods, child and the resolved format', function () {
      const logger = createLogger({
        format: 'plain',
        ...capture()
      });
      for (const method of [ 'debug', 'info', 'warn', 'error', 'child', 'destroy' ]) {
        assert.equal(typeof logger[method], 'function', method);
      }
      assert.equal(logger.format, 'plain');
      assert.equal(logger.child({}).format, 'plain');
    });
  });

  describe('mode selection', function () {
    it('should resolve auto to pretty on a color capable TTY', function () {
      process.env.NO_COLOR = '';
      process.env.FORCE_COLOR = '1';
      assert.equal(createLogger(capture(true)).format, 'pretty');
    });

    it('should resolve auto to plain without color', function () {
      assert.equal(createLogger(capture(true)).format, 'plain');
      assert.equal(createLogger(capture(false)).format, 'plain');
    });

    it('should resolve auto to the legacy shape in production', function () {
      process.env.NODE_ENV = 'production';
      assert.equal(createLogger(capture(true)).format, 'legacy');
    });

    it('should resolve auto to plain in test mode', function () {
      process.env.NODE_ENV = 'production';
      assert.equal(createLogger({
        test: true,
        ...capture(true)
      }).format, 'plain');
    });

    it('should prefer the configured format over auto detection', function () {
      process.env.NODE_ENV = 'production';
      assert.equal(createLogger({
        format: 'structured',
        ...capture()
      }).format, 'structured');
    });

    it('should prefer APOS_LOG_FORMAT over the configured format', function () {
      process.env.APOS_LOG_FORMAT = 'pretty';
      assert.equal(createLogger({
        format: 'structured',
        ...capture()
      }).format, 'pretty');
    });

    it('should force auto detection with APOS_LOG_FORMAT=auto', function () {
      process.env.APOS_LOG_FORMAT = 'auto';
      process.env.NODE_ENV = 'production';
      assert.equal(createLogger({
        format: 'pretty',
        ...capture()
      }).format, 'legacy');
    });

    it('should reject an invalid format', function () {
      assert.throws(() => createLogger({ format: 'fancy' }), /Invalid log format "fancy"/);
      process.env.APOS_LOG_FORMAT = 'fancy';
      assert.throws(() => createLogger({}), /APOS_LOG_FORMAT/);
    });

    it('should report no format when a custom logger owns the output', function () {
      const logger = createLogger({
        format: 'pretty',
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {}
        }
      });
      assert.equal(logger.format, null);
    });
  });

  describe('the envelope', function () {
    function envelopes(options = {}) {
      const captured = capture();
      const logger = createLogger({
        format: 'structured',
        ...captured,
        ...options
      });
      return {
        logger,
        out: () => captured.out.map((chunk) => JSON.parse(chunk)),
        err: () => captured.err.map((chunk) => JSON.parse(chunk))
      };
    }

    it('should carry severity and type, and no time field', function () {
      const { logger, out } = envelopes();
      logger.info('event-type');
      assert.deepEqual(out(), [ {
        severity: 'info',
        type: 'event-type'
      } ]);
      assert.equal('time' in out()[0], false);
    });

    it('should keep msg free of the module and type prefix', function () {
      const { logger, out } = envelopes({ context: { module: 'test-module' } });
      logger.info('event-type', 'some message', { key: 'value' });
      assert.deepEqual(out(), [ {
        severity: 'info',
        module: 'test-module',
        type: 'event-type',
        msg: 'some message',
        key: 'value'
      } ]);
    });

    it('should order severity, module, type and msg first', function () {
      const { logger, err } = envelopes({
        context: {
          key: 'value',
          module: 'test-module'
        }
      });
      logger.warn('event-type', 'some message');
      assert.deepEqual(Object.keys(err()[0]), [
        'severity',
        'module',
        'type',
        'msg',
        'key'
      ]);
    });

    it('should support the (type, data) signature', function () {
      const { logger, out } = envelopes();
      logger.info('event-type', { port: 3000 });
      assert.deepEqual(out(), [ {
        severity: 'info',
        type: 'event-type',
        port: 3000
      } ]);
    });

    it('should omit the type of output that has none', function () {
      const { logger, out } = envelopes();
      logger.info(null, 'Listening at http://localhost:3000');
      assert.deepEqual(out(), [ {
        severity: 'info',
        msg: 'Listening at http://localhost:3000'
      } ]);
    });

    it('should reject a non string type or message', function () {
      const { logger } = envelopes();
      assert.throws(() => logger.info(42), /Log event type must be a string/);
      assert.throws(() => logger.info('event-type', 42), /Log message must be a string/);
    });

    it('should merge context, overridden by event data', function () {
      const { logger, out } = envelopes({
        context: {
          scope: 'multisite',
          site: 'site-a'
        }
      });
      logger.info('event-type', { site: 'site-b' });
      assert.deepEqual(out(), [ {
        severity: 'info',
        type: 'event-type',
        scope: 'multisite',
        site: 'site-b'
      } ]);
    });

    it('should merge child context over parent context', function () {
      const { logger, out } = envelopes({
        context: {
          scope: 'multisite',
          site: 'site-a'
        }
      });
      const child = logger.child({ site: 'site-b' });
      child.info('event-type');
      child.child({ locale: 'en' }).info('deeper');
      logger.info('parent-still-intact');
      assert.deepEqual(out(), [
        {
          severity: 'info',
          type: 'event-type',
          scope: 'multisite',
          site: 'site-b'
        },
        {
          severity: 'info',
          type: 'deeper',
          scope: 'multisite',
          site: 'site-b',
          locale: 'en'
        },
        {
          severity: 'info',
          type: 'parent-still-intact',
          scope: 'multisite',
          site: 'site-a'
        }
      ]);
    });

    it('should never let event data override the severity', function () {
      const { logger, err } = envelopes();
      logger.error('event-type', { severity: 'info' });
      assert.equal(err()[0].severity, 'error');
    });
  });

  describe('structured rendering', function () {
    it('should emit one parseable JSON object per line', function () {
      const captured = capture();
      const logger = createLogger({
        format: 'structured',
        ...captured
      });
      logger.info('multi-line', 'first\nsecond', { note: 'third\nfourth' });
      logger.error('boom', 'it broke', { stack: 'Error: it broke\n    at foo (bar.js:1)' });
      const all = [ ...captured.out, ...captured.err ];
      assert.equal(all.length, 2);
      for (const chunk of all) {
        assert.equal(chunk.endsWith('\n'), true);
        assert.equal(chunk.split('\n').length, 2);
        assert.doesNotThrow(() => JSON.parse(chunk));
      }
    });

    it('should escape stacks inside the JSON', function () {
      const captured = capture();
      const logger = createLogger({
        format: 'structured',
        ...captured
      });
      const error = new Error('it broke');
      logger.error('startup-failed', error.message, { stack: error.stack });
      const envelope = JSON.parse(captured.err[0]);
      assert.equal(envelope.msg, 'it broke');
      assert.equal(envelope.stack, error.stack);
      assert.equal(captured.err[0].includes('\\n'), true);
    });

    it('should survive circular data rather than throw', function () {
      const captured = capture();
      const logger = createLogger({
        format: 'structured',
        ...captured
      });
      const data = { name: 'loop' };
      data.self = data;
      logger.info('event-type', data);
      assert.equal(captured.out[0].split('\n').length, 2);
      assert.deepEqual(JSON.parse(captured.out[0]), {
        severity: 'info',
        type: 'event-type',
        name: 'loop',
        self: {
          name: 'loop',
          self: '[Circular]'
        }
      });
    });

    it('should never color structured output', function () {
      process.env.NO_COLOR = '';
      process.env.FORCE_COLOR = '1';
      const captured = capture(true);
      const logger = createLogger({
        format: 'structured',
        ...captured
      });
      logger.warn('event-type', 'careful');
      assert.equal(captured.err[0].includes(ESC), false);
    });
  });

  describe('human readable rendering', function () {
    function render(options, log) {
      const captured = capture(true);
      const logger = createLogger({
        ...captured,
        ...options
      });
      log(logger);
      return {
        out: lines(captured.out),
        err: lines(captured.err)
      };
    }

    it('should compose time, labels, type and message in plain mode', function () {
      const { out } = render({ format: 'plain' }, (logger) => {
        logger.child({ module: '@apostrophecms/asset' }).info('building', 'ui/src');
      });
      assert.match(out[0], /^\d{2}:\d{2}:\d{2} \[@apostrophecms\/asset] building: ui\/src$/);
    });

    it('should badge warnings and errors only', function () {
      const { out, err } = render({ format: 'plain' }, (logger) => {
        logger.debug('quiet');
        logger.info('normal');
        logger.warn('careful');
        logger.error('broken');
      });
      assert.match(out[0], /^\d{2}:\d{2}:\d{2} quiet$/);
      assert.match(out[1], /^\d{2}:\d{2}:\d{2} normal$/);
      assert.match(err[0], /^\d{2}:\d{2}:\d{2} \[WARN] careful$/);
      assert.match(err[1], /^\d{2}:\d{2}:\d{2} \[ERROR] broken$/);
    });

    it('should label the site and the scope of an envelope', function () {
      const { out } = render({
        format: 'plain',
        context: { scope: 'multisite' }
      }, (logger) => {
        logger.child({ site: 'site-a' }).info('apos-listening');
      });
      assert.match(out[0], /\[site-a] \[multisite] apos-listening$/);
    });

    it('should label the module instead of the scope, and never both', function () {
      const { out } = render({
        format: 'plain',
        context: { scope: 'multisite' }
      }, (logger) => {
        logger
          .child({ site: 'site-a' })
          .child({ module: '@apostrophecms/asset' })
          .info('building');
      });
      assert.match(out[0], /\[site-a] \[@apostrophecms\/asset] building$/);
    });

    it('should render small data inline and large data indented', function () {
      const { out } = render({ format: 'plain' }, (logger) => {
        logger.info('incorrect-username', {
          username: 'admin',
          ip: '127.0.0.1'
        });
        logger.info('big', {
          nested: { deep: [ 1, 2, 3 ] }
        });
      });
      assert.match(out[0], /incorrect-username {2}username=admin ip=127\.0\.0\.1$/);
      assert.equal(out[1].split('\n').length > 1, true);
      assert.match(out[1], /\n {2}\{/);
    });

    it('should quote data values that are not simple', function () {
      const { out } = render({ format: 'plain' }, (logger) => {
        logger.info('event-type', { note: 'two words' });
      });
      assert.match(out[0], /note="two words"$/);
    });

    it('should indent the stack below the event line', function () {
      const { err } = render({ format: 'plain' }, (logger) => {
        logger.error('apiError', 'conflict', {
          status: 409,
          stack: 'Error: conflict\n    at foo (bar.js:1)'
        });
      });
      const [ first, ...stack ] = err[0].split('\n');
      assert.match(first, /\[ERROR] apiError: conflict {2}status=409$/);
      assert.deepEqual(stack, [
        '    Error: conflict',
        '        at foo (bar.js:1)'
      ]);
    });

    it('should color pretty output and only pretty output', function () {
      process.env.NO_COLOR = '';
      process.env.FORCE_COLOR = '1';
      const pretty = render({ format: 'pretty' }, (logger) => {
        logger.warn('careful');
      });
      const plain = render({ format: 'plain' }, (logger) => {
        logger.warn('careful');
      });
      assert.equal(pretty.err[0].includes(ESC), true);
      assert.equal(plain.err[0].includes(ESC), false);
      assert.match(pretty.err[0], /careful/);
    });

    it('should drop the timestamp and indent JSON data in test mode', function () {
      const { out } = render({
        format: 'plain',
        test: true
      }, (logger) => {
        logger.info('event-type', { key: 'value' });
      });
      assert.equal(out[0], 'event-type\n{\n  "key": "value"\n}');
    });
  });

  describe('startup banner', function () {
    const { version } = require('../package.json');

    function render(options, data) {
      const captured = capture(true);
      const logger = createLogger({
        ...captured,
        ...options
      });
      logger.child({ module: '@apostrophecms/express' }).info('apos-listening', data);
      return lines(captured.out)[0];
    }

    const urls = {
      url: 'http://localhost:3000',
      adminUrl: 'http://localhost:3000/login'
    };

    it('should render the listening event as a block in pretty mode', function () {
      const banner = render({ format: 'pretty' }, urls).split('\n');
      assert.deepEqual([ banner[0], banner[2], banner.at(-1) ], [ '', '', '' ]);
      assert.match(
        banner[1],
        new RegExp(`^ {2}apostrophe v${escaped(version)}  ready in (\\d+ms|\\d+\\.\\d{2}s)$`)
      );
      assert.deepEqual(banner.slice(3, 6), [
        '  ┃ Local     http://localhost:3000',
        '  ┃ Admin     http://localhost:3000/login',
        `  ┃ Node      ${process.version} · development`
      ]);
    });

    it('should omit the admin line when there is no login URL to point at',
      function () {
        const banner = render({ format: 'pretty' }, { url: urls.url });
        assert.match(banner, /┃ Local {5}http:\/\/localhost:3000\n/);
        assert.equal(banner.includes('Admin'), false);
      });

    it('should color the banner when the terminal takes color', function () {
      process.env.NO_COLOR = '';
      process.env.FORCE_COLOR = '1';
      assert.equal(render({ format: 'pretty' }, urls).includes(ESC), true);
    });

    it('should stay an ordinary event line in every other format', function () {
      assert.match(
        render({ format: 'plain' }, urls),
        /^\d{2}:\d{2}:\d{2} \[@apostrophecms\/express] apos-listening {2}url=\S+ adminUrl=\S+$/
      );
      assert.deepEqual(JSON.parse(render({ format: 'structured' }, urls)), {
        severity: 'info',
        module: '@apostrophecms/express',
        type: 'apos-listening',
        ...urls
      });
    });

    it('should stay a line for one site of many', function () {
      const banner = render({
        format: 'pretty',
        context: { site: 'site-a' }
      }, urls);
      assert.match(banner, /\[site-a] \[@apostrophecms\/express] apos-listening/);
    });
  });

  describe('legacy rendering', function () {
    function render(log) {
      const captured = capture();
      const logger = createLogger({
        format: 'legacy',
        ...captured
      });
      log(logger);
      return {
        out: lines(captured.out),
        err: lines(captured.err)
      };
    }

    it('should keep the message plus JSON shape of previous releases', function () {
      const { out } = render((logger) => {
        logger.child({ module: 'test-module' }).info('event-type', 'some message');
      });
      assert.equal(
        out[0],
        'test-module: event-type: some message ' +
        '{"module":"test-module","type":"event-type","severity":"info"}'
      );
    });

    it('should print a bare string call as the message alone', function () {
      const { out } = render((logger) => {
        logger.info(null, 'Listening at http://localhost:3000');
      });
      assert.equal(out[0], 'Listening at http://localhost:3000');
    });
  });

  describe('severity stream split', function () {
    for (const format of [ 'structured', 'pretty', 'plain', 'legacy' ]) {
      it(`should send debug and info to stdout, warn and error to stderr (${format})`,
        function () {
          const captured = capture(true);
          const logger = createLogger({
            format,
            ...captured
          });
          logger.debug('a');
          logger.info('b');
          logger.warn('c');
          logger.error('d');
          assert.equal(captured.out.length, 2);
          assert.equal(captured.err.length, 2);
          assert.match(captured.out.join(''), /a[\s\S]*b/);
          assert.match(captured.err.join(''), /c[\s\S]*d/);
        });
    }
  });

  describe('custom logger', function () {
    function spy() {
      const calls = [];
      const logger = {};
      for (const severity of [ 'debug', 'info', 'warn', 'error' ]) {
        logger[severity] = (envelope) => calls.push([ severity, envelope ]);
      }
      return {
        calls,
        logger
      };
    }

    it('should receive envelopes and render nothing', function () {
      const captured = capture();
      const { calls, logger } = spy();
      const instance = createLogger({
        format: 'pretty',
        logger,
        context: { scope: 'multisite' },
        ...captured
      });
      instance.warn('event-type', 'careful', { key: 'value' });
      assert.deepEqual(calls, [ [ 'warn', {
        severity: 'warn',
        type: 'event-type',
        msg: 'careful',
        scope: 'multisite',
        key: 'value'
      } ] ]);
      assert.equal(captured.out.length, 0);
      assert.equal(captured.err.length, 0);
    });

    it('should merge child context before handing the envelope over', function () {
      const { calls, logger } = spy();
      createLogger({ logger }).child({ site: 'site-a' }).info('apos-listening');
      assert.deepEqual(calls[0][1], {
        severity: 'info',
        type: 'apos-listening',
        site: 'site-a'
      });
    });

    it('should require the four severity methods', function () {
      assert.throws(
        () => createLogger({ logger: { info() {} } }),
        /Missing: debug, warn, error/
      );
    });
  });

  describe('destroy ownership', function () {
    it('should forward destroy to a custom logger', async function () {
      let destroyed = 0;
      const logger = createLogger({
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
          destroy: async () => {
            destroyed++;
          }
        }
      });
      await logger.destroy();
      assert.equal(destroyed, 1);
    });

    it('should withhold destroy from children unless it is granted', function () {
      const logger = createLogger(capture());
      assert.equal(typeof logger.destroy, 'function');
      assert.equal(logger.child({ site: 'site-a' }).destroy, undefined);
      assert.equal(
        typeof logger.child({ site: 'site-a' }, { destroy: true }).destroy,
        'function'
      );
    });

    it('should resolve destroy without a custom logger', async function () {
      await createLogger(capture()).destroy();
    });
  });

  describe('color capability', function () {
    const tty = { isTTY: true };
    const pipe = { isTTY: false };

    it('should disable color for NO_COLOR', function () {
      process.env.NO_COLOR = '1';
      process.env.FORCE_COLOR = '1';
      assert.equal(supportsColor(tty), false);
    });

    it('should enable color for FORCE_COLOR, disable it for FORCE_COLOR=0', function () {
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = '1';
      assert.equal(supportsColor(pipe), true);
      process.env.FORCE_COLOR = '0';
      assert.equal(supportsColor(tty), false);
    });

    it('should enable color for --color', function () {
      delete process.env.NO_COLOR;
      process.argv = [ ...process.argv, '--color' ];
      assert.equal(supportsColor(pipe), true);
    });

    it('should enable color in CI', function () {
      delete process.env.NO_COLOR;
      process.env.CI = 'true';
      assert.equal(supportsColor(pipe), true);
    });

    it('should require a TTY that is not dumb otherwise', function () {
      delete process.env.NO_COLOR;
      assert.equal(supportsColor(tty), true);
      assert.equal(supportsColor(pipe), false);
      process.env.TERM = 'dumb';
      assert.equal(supportsColor(tty), false);
    });
  });
});
