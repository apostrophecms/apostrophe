/* global describe, it */
const assert = require('assert');
const path = require('path');
const createLogger = require('../lib/logger.js');

describe('UploadFS logger', function () {
  this.timeout(10000);

  it('should fall back to console when no logger is injected', function () {
    const logger = createLogger();
    for (const method of [ 'error', 'warn', 'info', 'debug' ]) {
      assert.strictEqual(typeof logger[method], 'function');
    }
  });

  it('should fill in the methods a partial logger does not provide', function () {
    const calls = [];
    const logger = createLogger({
      error: (...args) => calls.push(args)
    });
    logger.error('one', 'two');
    assert.deepStrictEqual(calls, [ [ 'one', 'two' ] ]);
    assert.strictEqual(typeof logger.warn, 'function');
  });

  it('should deliver uploadfs diagnostics to the injected logger', function (done) {
    const calls = [];
    const logger = {
      error: (...args) => calls.push([ 'error', ...args ]),
      warn: (...args) => calls.push([ 'warn', ...args ])
    };
    const uploadfs = require('../uploadfs.js')();
    uploadfs.init({
      storage: 'local',
      // A retired image processor: uploadfs warns and falls back to sharp
      image: 'jimp',
      logger,
      uploadsPath: path.join(__dirname, '/files/'),
      uploadsUrl: 'http://localhost:3000/test/',
      tempPath: path.join(__dirname, '/temp')
    }, function (err) {
      assert.ifError(err);
      assert.strictEqual(calls.length, 1);
      const [ severity, message ] = calls[0];
      assert.strictEqual(severity, 'warn');
      assert.ok(message.includes('no longer supported'));
      return done();
    });
  });
});
