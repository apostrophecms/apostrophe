const assert = require('node:assert/strict');
const t = require('apostrophe/test-lib/util.js');

const { getAppConfig } = require('./util/index.js');

// Every export schedules its download for removal from uploadfs once it
// expires. By the time that timer fires the file has often already gone —
// another process cleaned it up, the site was restarted and `apostrophe:destroy`
// flushed the pending timers, or a test suite emptied its uploads directory.
// The removal was still logged as an error, so a perfectly healthy run printed
// a stack trace per export and a real failure had to be picked out of the noise.
describe('export download expiration', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig()
    });

    importExportManager = apos.modules['@apostrophecms/import-export'];
  });

  after(async function() {
    await t.destroy(apos);
    apos = null;
  });

  it('does not report an error when the download is already gone', async function() {
    const errors = await runExpiration(apos, importExportManager, '/exports/never-written.tar.gz');

    assert.deepEqual(errors, []);
  });

  it('still reports an error when the removal fails for any other reason', async function() {
    const uploadfs = apos.attachment.uploadfs;
    const original = uploadfs.remove;
    uploadfs.remove = (path, callback) => {
      callback(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }));
    };

    let errors;
    try {
      errors = await runExpiration(apos, importExportManager, '/exports/unreadable.tar.gz');
    } finally {
      uploadfs.remove = original;
    }

    assert.equal(errors.length, 1);
    assert.match(errors[0], /EACCES/);
  });
});

// Schedules an expiration, then runs its handler directly rather than waiting
// for the timer — the same thing `apostrophe:destroy` does with any expiration
// still pending at shutdown. Returns whatever was logged as an error.
async function runExpiration(apos, importExportManager, downloadPath) {
  const errors = [];
  const original = apos.util.error;
  apos.util.error = (...args) => {
    errors.push(args.map(arg => (arg && arg.message) || String(arg)).join(' '));
  };

  try {
    // An hour out: the timer must never be what fires the handler here.
    importExportManager.removeFromUploadFs(downloadPath, 1000 * 60 * 60);

    const ids = Object.keys(importExportManager.timeoutIds);
    assert.equal(ids.length, 1, 'the expiration should have been scheduled');

    const { handler, timeoutId } = importExportManager.timeoutIds[ids[0]];
    clearTimeout(timeoutId);
    await handler();
  } finally {
    apos.util.error = original;
  }

  return errors;
}
