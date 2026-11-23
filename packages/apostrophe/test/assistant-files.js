const assert = require('assert').strict;
const fs = require('fs/promises');
const path = require('path');
const t = require('../test-lib/test.js');

// The assistant's file store on local storage, with and without
// `disabledFileKey`: a chat file is written under a path holding its own
// random secret, read back as written, and removed with its image sizes.
// The backend's errors never carry a path out.

const FIXTURES = path.join(__dirname, 'data/upload_tests');
const UPLOADS = path.join(__dirname, 'public/uploads');
const SECRET = /^\/apos-ai\/([0-9a-f]{64})\./;

for (const key of [ null, 'testkey' ]) {
  describe(`Assistant: file store, local storage ${key ? 'with' : 'without'} a key`, function () {
    this.timeout(t.timeout);

    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          ...(key && {
            '@apostrophecms/uploadfs': {
              options: {
                uploadfs: { disabledFileKey: key }
              }
            }
          })
        }
      });
    });

    after(async function () {
      await fs.rm(path.join(UPLOADS, 'apos-ai'), {
        recursive: true,
        force: true
      });
      await t.destroy(apos);
    });

    it('reads a file back as written, under a neutral extension', async function () {
      const local = path.join(FIXTURES, 'clone.txt');
      const prepared = await apos.aposAssistant.prepareChatFile(local, 'md');
      assert.equal(prepared.extension, 'md');
      assert.equal(prepared.storage.sizes, null);
      assert.match(prepared.storage.path, SECRET);
      assert(prepared.storage.path.endsWith('.bin'));
      await apos.aposAssistant.writeChatFile(local, prepared.storage);
      const read = await apos.aposAssistant.readChatFile(prepared.storage);
      assert.deepEqual(read, await fs.readFile(local));
      await apos.aposAssistant.removeChatFile(prepared.storage);
    });

    it('writes an image as given with its own sizes, under its true extension', async function () {
      const local = path.join(FIXTURES, 'crop_image.jpeg');
      const prepared = await apos.aposAssistant.prepareChatFile(local, 'jpeg');
      assert.equal(prepared.extension, 'jpg');
      assert(prepared.width > 0 && prepared.height > 0);
      const { storage } = prepared;
      assert.match(storage.path, SECRET);
      assert(storage.path.endsWith('.jpg'));
      assert.deepEqual(Object.keys(storage.sizes), [ 'thumbnail', 'preview' ]);
      await apos.aposAssistant.writeChatFile(local, storage);
      for (const stored of getPaths(storage)) {
        await fs.access(path.join(UPLOADS, stored));
      }
      const original = await apos.aposAssistant.readChatFile(storage);
      const small = await apos.aposAssistant.readChatFile(storage, { size: 'thumbnail' });
      assert(small.length > 0);
      assert(small.length < original.length);
      assert.deepEqual(original, await fs.readFile(local));
      await apos.aposAssistant.removeChatFile(storage);
    });

    it('gives each file its own secret, unrelated to the file', async function () {
      const local = path.join(FIXTURES, 'upload_image.png');
      const one = await apos.aposAssistant.prepareChatFile(local, 'png');
      const two = await apos.aposAssistant.prepareChatFile(local, 'png');
      const secrets = [ one, two ].map(({ storage }) => storage.path.match(SECRET)[1]);
      assert.notEqual(secrets[0], secrets[1]);
      for (const secret of secrets) {
        assert(!secret.includes('upload'));
      }
    });

    it('leaves nothing after a remove, which may run again', async function () {
      const local = path.join(FIXTURES, 'upload_image.png');
      const { storage } = await apos.aposAssistant.prepareChatFile(local, 'png');
      await apos.aposAssistant.writeChatFile(local, storage);
      assert.equal(await apos.aposAssistant.removeChatFile(storage), true);
      for (const stored of getPaths(storage)) {
        await assert.rejects(fs.access(path.join(UPLOADS, stored)), { code: 'ENOENT' });
      }
      // An interrupted removal is finished by the next one
      assert.equal(await apos.aposAssistant.removeChatFile(storage), true);
      const error = await getError(apos.aposAssistant.readChatFile(storage));
      assert.equal(error.name, 'notfound');
      assertNoPath(error, storage);
    });

    it('keeps the path out of a failed write', async function () {
      const local = path.join(FIXTURES, 'clone.txt');
      const { storage } = await apos.aposAssistant.prepareChatFile(local, 'md');
      const { uploadfs } = apos.attachment;
      const { copyIn } = uploadfs;
      uploadfs.copyIn = (from, to, callback) => callback(failure(to));
      try {
        const error = await getError(apos.aposAssistant.writeChatFile(local, storage));
        assert.equal(error.name, 'error');
        assert.deepEqual(error.data, { code: 'EACCES' });
        assertNoPath(error, storage);
      } finally {
        uploadfs.copyIn = copyIn;
      }
    });

    it('never fails a remove, and logs a failure without the path', async function () {
      const local = path.join(FIXTURES, 'clone.txt');
      const { storage } = await apos.aposAssistant.prepareChatFile(local, 'md');
      const { uploadfs } = apos.attachment;
      const { remove } = uploadfs;
      const { logError } = apos.aposAssistant;
      const tried = [];
      const logged = [];
      uploadfs.remove = (stored, callback) => {
        tried.push(stored);
        return callback(failure(stored));
      };
      apos.aposAssistant.logError = (...args) => logged.push(args);
      try {
        assert.equal(await apos.aposAssistant.removeChatFile({
          ...storage,
          sizes: { thumbnail: '/apos-ai/other.thumbnail.jpg' }
        }), false);
        assert.deepEqual(tried, [ storage.path, '/apos-ai/other.thumbnail.jpg' ]);
        assert.equal(logged.length, 2);
        for (const [ type, message, data ] of logged) {
          assert.equal(type, 'chat-file-remove');
          assertNoPath({
            message,
            data
          }, storage);
          assert.deepEqual(data, { code: 'EACCES' });
        }
      } finally {
        uploadfs.remove = remove;
        apos.aposAssistant.logError = logError;
      }
    });
  });
}

function getPaths(storage) {
  return [ storage.path, ...Object.values(storage.sizes || {}) ];
}

function failure(stored) {
  const error = new Error(`EACCES: permission denied, open '${stored}'`);
  error.code = 'EACCES';
  return error;
}

async function getError(promise) {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  throw new Error('expected an error');
}

function assertNoPath(error, storage) {
  const secret = storage.path.match(SECRET)[1];
  assert(!JSON.stringify({
    message: error.message,
    data: error.data
  }).includes(secret));
}
