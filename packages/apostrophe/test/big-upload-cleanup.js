const assert = require('assert');
const fs = require('node:fs/promises');
const { readdirSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bigUploadMethods = require('../modules/@apostrophecms/http/lib/big-upload-middleware');

describe('Big Upload assembly cleanup', function() {
  let temp;
  let self;
  let req;
  let upload;
  let ufs;
  let handedOff;
  let responseFiles;
  let cleaned;

  const file = (chunks = 1) => ({
    name: 'fixture.txt',
    type: 'text/plain',
    chunks
  });

  beforeEach(async function() {
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'apos-big-upload-cleanup-'));
    handedOff = false;
    responseFiles = undefined;
    cleaned = undefined;
    upload = {
      _id: 'cleanup-fixture',
      files: { file: file(2) }
    };
    ufs = {
      getTempPath: () => temp,
      async copyOut(source, destination) {
        await fs.writeFile(destination, 'chunk');
      }
    };
    self = {};
    Object.assign(self, bigUploadMethods(self), {
      getBigUploadFs: () => ufs,
      bigUploadFor: async () => upload,
      async bigUploadCleanupOne(record) {
        cleaned = record;
      },
      logError() {}
    });
    req = {
      res: {
        status(code) {
          this.statusCode = code;
          return this;
        },
        send(body) {
          this.body = body;
          responseFiles = readdirSync(temp);
        }
      }
    };
  });

  afterEach(async function() {
    await fs.rm(temp, {
      recursive: true,
      force: true
    });
  });

  const end = async () => self.bigUploadEnd(req, upload._id, () => {
    handedOff = true;
  });

  const failCopy = (call) => {
    const copyOut = ufs.copyOut;
    let calls = 0;
    ufs.copyOut = async (source, destination) => {
      // A storage error can leave a partially copied chunk, too.
      await copyOut(source, destination);
      if (++calls === call) {
        throw new Error('Simulated storage read failure');
      }
    };
  };

  const assertCleanFailure = async () => {
    assert.strictEqual(req.res.statusCode, 500);
    assert.strictEqual(req.res.body.name, 'error');
    assert.strictEqual(handedOff, false);
    assert.strictEqual(cleaned, upload);
    assert.deepStrictEqual(responseFiles, [], 'cleanup must finish before the error response');
    assert.deepStrictEqual(await fs.readdir(temp), []);
    assert.deepStrictEqual(req.files, {});
  };

  it('removes a partially assembled output and chunk when storage fails', async function() {
    failCopy(2);
    await end();
    await assertCleanFailure();
  });

  it('also removes completed outputs when a later file fails', async function() {
    upload.files = {
      first: file(),
      second: file(2)
    };
    failCopy(3);
    await end();
    await assertCleanFailure();
  });

  it('also removes completed zero-byte outputs when a later file fails', async function() {
    upload.files = {
      empty: file(0),
      second: file(2)
    };
    failCopy(2);
    await end();
    await assertCleanFailure();
  });

  it('removes completed outputs when opening a later output fails', async function() {
    upload.files = {
      first: file(),
      second: file()
    };
    let calls = 0;
    ufs.getTempPath = () => (++calls === 1) ? temp : path.join(temp, 'missing');
    await end();
    await assertCleanFailure();
  });

  it('preserves successful outputs, including zero-byte files, for the route', async function() {
    upload.files = {
      first: file(2),
      empty: file(0)
    };
    await end();
    assert.strictEqual(handedOff, true);
    assert.strictEqual(responseFiles, undefined);
    assert.strictEqual(cleaned, upload);
    assert.strictEqual(await fs.readFile(req.files.first.path, 'utf8'), 'chunkchunk');
    assert.strictEqual((await fs.stat(req.files.empty.path)).size, 0);
    assert.strictEqual((await fs.readdir(temp)).length, 2);
  });
});
