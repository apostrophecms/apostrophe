/* global describe, it, before, after */
// Paths passed to uploadfs must never be able to escape the storage area,
// whatever backend is in use. Runs entirely offline, in a temporary folder.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

describe('UploadFS path traversal', function () {
  this.timeout(10000);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uploadfs-traversal-'));
  const uploadsPath = path.join(root, 'uploads');
  const outsidePath = path.join(root, 'outside');
  const secretFile = path.join(outsidePath, 'secret.txt');
  const localFile = path.join(root, 'local.txt');
  fs.mkdirSync(uploadsPath);
  fs.mkdirSync(outsidePath);

  const fsEscapes = [
    '/../outside/secret.txt',
    '../outside/secret.txt',
    '/sub/../../outside/secret.txt',
    '/sub/../../../../../../../../../../..' + secretFile
  ];
  // Backslashes are separators on Windows, and are treated like slashes
  // when URLs are normalized
  const escapes = [
    ...fsEscapes,
    '/..\\outside\\secret.txt'
  ];

  after(function () {
    fs.rmSync(root, {
      recursive: true,
      force: true
    });
  });

  function resetFixtures() {
    // A successful attack may have left the folder unwritable, etc.
    if (fs.existsSync(secretFile)) {
      fs.chmodSync(secretFile, parseInt('644', 8));
    }
    fs.rmSync(outsidePath, {
      recursive: true,
      force: true
    });
    fs.mkdirSync(outsidePath);
    fs.writeFileSync(secretFile, 'secret');
    fs.chmodSync(secretFile, parseInt('644', 8));
    fs.writeFileSync(localFile, 'attacker');
  }

  function assertSecretIntact() {
    assert(fs.existsSync(secretFile), 'file outside uploadsPath must not be removed');
    assert.strictEqual(fs.readFileSync(secretFile, 'utf8'), 'secret', 'file outside uploadsPath must not be modified');
    assert.strictEqual(fs.statSync(secretFile).mode & parseInt('777', 8), parseInt('644', 8), 'permissions of file outside uploadsPath must not change');
    assert.deepStrictEqual(fs.readdirSync(outsidePath), [ 'secret.txt' ], 'nothing may be created or renamed outside uploadsPath');
  }

  async function assertRejects(fn) {
    let error;
    try {
      await fn();
    } catch (e) {
      error = e;
    }
    assert(error, 'operation should have been refused');
  }

  function readStream(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }

  // Exercise every filesystem-touching method of `api` (either the uploadfs
  // instance or a raw backend) with each escaping path
  function describeAttacks(getApi, list = escapes) {
    for (const bad of list) {
      describe(JSON.stringify(bad), function () {
        it('copyIn refuses to write outside uploadsPath', async function () {
          resetFixtures();
          const api = getApi();
          await assertRejects(() => promisify(api.copyIn)(localFile, bad, {}));
          assertSecretIntact();
        });

        it('copyOut refuses to read from outside uploadsPath', async function () {
          resetFixtures();
          const api = getApi();
          const target = path.join(root, 'copied-out.txt');
          await assertRejects(() => promisify(api.copyOut)(bad, target, {}));
          assert(!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== 'secret');
          assertSecretIntact();
        });

        it('streamOut refuses to read from outside uploadsPath', async function () {
          resetFixtures();
          const api = getApi();
          let data;
          await assertRejects(async () => {
            data = await readStream(api.streamOut(bad, {}));
          });
          assert.notStrictEqual(data, 'secret');
        });

        it('remove refuses to delete outside uploadsPath', async function () {
          resetFixtures();
          const api = getApi();
          await assertRejects(() => promisify(api.remove)(bad));
          assertSecretIntact();
        });

        it('disable refuses to act outside uploadsPath', async function () {
          resetFixtures();
          const api = getApi();
          await assertRejects(() => promisify(api.disable)(bad));
          assertSecretIntact();
        });

        it('enable refuses to act outside uploadsPath', async function () {
          resetFixtures();
          const api = getApi();
          await assertRejects(() => promisify(api.enable)(bad));
          assertSecretIntact();
        });
      });
    }
  }

  async function assertLegitimateUseWorks(api) {
    for (const good of [ '/ok.txt', '/nested/folder/ok..txt', '/nested/..dots../ok.txt', 'no-leading-slash.txt' ]) {
      await promisify(api.copyIn)(localFile, good, {});
      const stored = path.join(uploadsPath, good);
      assert.strictEqual(fs.readFileSync(stored, 'utf8'), 'attacker');
      assert.strictEqual(await readStream(api.streamOut(good, {})), 'attacker');
      const out = path.join(root, 'legit-out.txt');
      await promisify(api.copyOut)(good, out, {});
      assert.strictEqual(fs.readFileSync(out, 'utf8'), 'attacker');
      await promisify(api.disable)(good);
      await promisify(api.enable)(good);
      await promisify(api.remove)(good);
      assert(!fs.existsSync(stored));
    }
  }

  describe('uploadfs API with the local backend', function () {
    let uploadfs;
    before(async function () {
      uploadfs = require('../uploadfs.js')();
      await promisify(uploadfs.init)({
        storage: 'local',
        uploadsPath: uploadsPath + '/',
        uploadsUrl: 'http://localhost:3000/uploads',
        tempPath: path.join(root, 'temp')
      });
    });
    after(async function () {
      await promisify(uploadfs.destroy)();
    });
    describeAttacks(() => uploadfs);
    it('legitimate paths still work', async function () {
      resetFixtures();
      await assertLegitimateUseWorks(uploadfs);
    });
  });

  describe('uploadfs API with the local backend and disabledFileKey', function () {
    let uploadfs;
    before(async function () {
      uploadfs = require('../uploadfs.js')();
      await promisify(uploadfs.init)({
        storage: 'local',
        uploadsPath,
        uploadsUrl: 'http://localhost:3000/uploads',
        tempPath: path.join(root, 'temp'),
        disabledFileKey: 'test-disabled-file-key'
      });
    });
    after(async function () {
      await promisify(uploadfs.destroy)();
    });
    describeAttacks(() => uploadfs);
    it('legitimate paths still work', async function () {
      resetFixtures();
      await assertLegitimateUseWorks(uploadfs);
    });
  });

  // Defense in depth: the local backend must contain paths on its own,
  // even when called directly rather than through uploadfs
  describe('local backend called directly', function () {
    let backend;
    before(async function () {
      backend = require('../lib/storage/local.js')();
      await promisify(backend.init)({
        uploadsPath,
        uploadsUrl: 'http://localhost:3000/uploads'
      });
    });
    after(async function () {
      await promisify(backend.destroy)();
    });
    describeAttacks(() => backend, (path.sep === '\\') ? escapes : fsEscapes);
    it('legitimate paths still work', async function () {
      resetFixtures();
      await assertLegitimateUseWorks(backend);
    });
  });

  // Cloud backends do not have a local folder to escape, but ".." segments
  // are normalized away when object keys are turned into request URLs by
  // some SDKs (e.g. reaching a different Azure container). uploadfs itself
  // must refuse such paths before they reach any backend.
  describe('uploadfs API with any backend', function () {
    let uploadfs;
    let calls;
    before(async function () {
      calls = [];
      const record = name => function (...args) {
        calls.push(name);
        const callback = args.find(arg => typeof arg === 'function');
        return callback && callback(null);
      };
      const storage = {
        init: (options, callback) => callback(null),
        copyIn: record('copyIn'),
        copyOut: record('copyOut'),
        remove: record('remove'),
        enable: record('enable'),
        disable: record('disable'),
        streamOut: () => {
          calls.push('streamOut');
          const { PassThrough } = require('stream');
          const stream = new PassThrough();
          stream.end('secret');
          return stream;
        },
        getUrl: () => 'https://example.com/bucket',
        destroy: callback => callback(null)
      };
      uploadfs = require('../uploadfs.js')();
      await promisify(uploadfs.init)({
        storage,
        tempPath: path.join(root, 'temp')
      });
    });
    after(async function () {
      await promisify(uploadfs.destroy)();
    });
    for (const bad of escapes) {
      it(`does not pass ${JSON.stringify(bad)} to the backend`, async function () {
        calls.length = 0;
        const target = path.join(root, 'copied-out.txt');
        await assertRejects(() => promisify(uploadfs.copyIn)(localFile, bad));
        await assertRejects(() => promisify(uploadfs.copyOut)(bad, target));
        await assertRejects(() => readStream(uploadfs.streamOut(bad)));
        await assertRejects(() => promisify(uploadfs.remove)(bad));
        await assertRejects(() => promisify(uploadfs.enable)(bad));
        await assertRejects(() => promisify(uploadfs.disable)(bad));
        assert.deepStrictEqual(calls, []);
      });
    }
    it('passes legitimate paths to the backend', async function () {
      calls.length = 0;
      await promisify(uploadfs.copyIn)(localFile, '/a/b..c.txt');
      await promisify(uploadfs.remove)('/a/..b/c.txt');
      assert.deepStrictEqual(calls, [ 'copyIn', 'remove' ]);
    });
  });
});
