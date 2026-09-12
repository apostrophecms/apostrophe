const assert = require('assert');
const path = require('path');
const fs = require('fs');
const qs = require('qs');

const t = require('../test-lib/test.js');
const getBigUpload = async () => import('../modules/@apostrophecms/http/ui/apos/big-upload-client.js');
const buffer = fs.readFileSync(path.resolve(__dirname, 'data/upload_tests/crop_image.png'));

describe('Big Upload', function() {

  let apos;
  let jar;
  let received = false;
  let publicReceived = false;
  const unhandled = [];

  const onUnhandled = (e) => unhandled.push(e);

  after(async function () {
    process.removeListener('unhandledRejection', onUnhandled);
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  before(async function() {
    // The middleware performs file I/O in the background. A crash there
    // reaches the process, not the request, so watch for it throughout
    process.on('unhandledRejection', onUnhandled);
    apos = await t.create({
      root: module,
      modules: {
        test: {
          apiRoutes: (self) => ({
            post: {
              'big-upload-test': [
                self.apos.http.bigUploadMiddleware(),
                (req) => {
                  try {
                    received = true;
                    assert(req.files);
                    assert(req.files.file);
                    assert.strictEqual(req.files.file.name, 'crop_image.png');
                    const buffer2 = fs.readFileSync(req.files.file.path);
                    assert(buffer.equals(buffer2));
                    return {
                      ok: true
                    };
                  } finally {
                    fs.unlinkSync(req.files.file.path);
                  }
                }
              ],
              // A route that deliberately opts out of the default login
              // requirement
              'big-upload-public-test': [
                self.apos.http.bigUploadMiddleware({ authorize: false }),
                (req) => {
                  try {
                    publicReceived = true;
                    return {
                      ok: true
                    };
                  } finally {
                    fs.unlinkSync(req.files.file.path);
                  }
                }
              ]
            }
          })
        }
      }
    });

    assert(apos.http);
  });

  // Emulate the browser-side apos.http object just barely well enough to test
  // big-upload-client server-side.
  //
  // self.apos.http won't work for this task because it does not have a 100%
  // browser-compatible API for blobs

  const httpFor = (cookieJar) => ({
    async post(url, options) {
      if (options.qs) {
        url += '?' + qs.stringify(options.qs);
      }
      const isFormData = options.body instanceof FormData;
      const body = isFormData ? options.body : JSON.stringify(options.body);
      const base = apos.http.getBase();
      const headers = {
        cookie: [
          `${apos.csrfCookieName}=csrf`,
          ...(cookieJar ? cookieJar.getCookiesSync(`${base}${url}`) : [])
            .map(cookie => cookie.cookieString())
        ].join('; ')
      };
      if (!isFormData) {
        headers['content-type'] = 'application/json';
      }
      const result = await fetch(`${base}${url}`, {
        method: 'POST',
        headers,
        body
      });
      if (result.status >= 400) {
        throw new Error(result.status);
      }
      return result.json();
    }
  });

  // Must have the same shape as a browser-side File object and be sliceable,
  // returning a Blob

  const file = {
    size: buffer.byteLength,
    name: 'crop_image.png',
    slice(from, to) {
      return new Blob([ buffer.subarray(from, to) ]);
    }
  };

  // Send a single aposBigUpload request without the client, so that
  // individual steps of the protocol can be exercised on their own
  const raw = async (aposBigUpload, {
    body, route, cookieJar
  } = {}) => {
    const base = apos.http.getBase();
    const url = `${base}/api/v1/test/${route || 'big-upload-test'}?` +
      qs.stringify({ aposBigUpload });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: [
          `${apos.csrfCookieName}=csrf`,
          ...(cookieJar ? cookieJar.getCookiesSync(url) : [])
            .map(cookie => cookie.cookieString())
        ].join('; ')
      },
      body: JSON.stringify(body || {})
    });
    let parsed;
    const text = await res.text();
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = text;
    }
    return {
      status: res.status,
      body: parsed
    };
  };

  it('should be able to insert a test user', async function() {
    const user = apos.user.newInstance();
    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.role = 'admin';
    return apos.user.insert(apos.task.getReq(), user);
  });

  it('should refuse an anonymous start, leaving no upload behind', async function() {
    const before = await apos.http.bigUploads.countDocuments({});
    const result = await raw({ type: 'start' }, {
      body: {
        files: {
          file: {
            name: 'evil.tar.gz',
            size: 4,
            type: 'application/gzip',
            chunks: 50
          }
        }
      }
    });
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.body.name, 'forbidden');
    assert.strictEqual(await apos.http.bigUploads.countDocuments({}), before);
  });

  it('should refuse an anonymous chunk', async function() {
    const result = await raw({
      type: 'chunk',
      id: 'abcdefghijklmnopqrstuvwx',
      n: 0,
      chunk: 0
    });
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.body.name, 'forbidden');
  });

  it('should refuse an anonymous end', async function() {
    const result = await raw({
      type: 'end',
      id: 'abcdefghijklmnopqrstuvwx'
    });
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.body.name, 'forbidden');
  });

  it('should be able to log in as admin', async function() {
    jar = apos.http.jar();
    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });
  });

  it('should be able to make a big upload request when logged in', async function() {
    const { default: bigUpload } = await getBigUpload();
    const result = await bigUpload('/api/v1/test/big-upload-test', {
      files: {
        file
      },
      http: httpFor(jar),
      chunkSize: 1024
    });

    assert(received);
    assert.strictEqual(result.ok, true);
  });

  it('should refuse a chunk count over the limit', async function() {
    const before = await apos.http.bigUploads.countDocuments({});
    const result = await raw({ type: 'start' }, {
      cookieJar: jar,
      body: {
        files: {
          file: {
            name: 'big.tar.gz',
            size: 4,
            type: 'application/gzip',
            chunks: apos.http.options.bigUploadMaxChunks + 1
          }
        }
      }
    });
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.body.name, 'invalid');
    assert.strictEqual(await apos.http.bigUploads.countDocuments({}), before);
  });

  it('should refuse an invalid chunk count for a nonempty file', async function() {
    for (const chunks of [ 0, -1, 1.5, Number.MAX_VALUE, 'lots', null ]) {
      const result = await raw({ type: 'start' }, {
        cookieJar: jar,
        body: {
          files: {
            file: {
              name: 'odd.tar.gz',
              size: 4,
              type: 'application/gzip',
              chunks
            }
          }
        }
      });
      assert.strictEqual(result.status, 400, `chunks: ${chunks}`);
      assert.strictEqual(result.body.name, 'invalid', `chunks: ${chunks}`);
    }
  });

  it('should accept zero chunks for a zero-byte file', async function() {
    const result = await raw({ type: 'start' }, {
      cookieJar: jar,
      body: {
        files: {
          file: {
            name: 'empty.txt',
            size: 0,
            type: 'text/plain',
            chunks: 0
          }
        }
      }
    });
    assert.strictEqual(result.status, 200);
    assert(result.body.id);
    await apos.http.bigUploads.deleteOne({ _id: result.body.id });
  });

  it('should refuse more files than the limit', async function() {
    const files = {};
    for (let i = 0; (i < apos.http.options.bigUploadMaxFiles + 1); i++) {
      files[`file${i}`] = {
        name: `many${i}.tar.gz`,
        size: 4,
        type: 'application/gzip',
        chunks: 1
      };
    }
    const result = await raw({ type: 'start' }, {
      cookieJar: jar,
      body: { files }
    });
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.body.name, 'invalid');
  });

  it('should bound cleanup work for legacy upload records', async function() {
    const maxFiles = apos.http.options.bigUploadMaxFiles;
    const maxChunks = apos.http.options.bigUploadMaxChunks;
    const getBigUploadFs = apos.http.getBigUploadFs;
    const removed = [];
    apos.http.options.bigUploadMaxFiles = 2;
    apos.http.options.bigUploadMaxChunks = 3;
    apos.http.getBigUploadFs = () => ({
      async remove(uploadfsPath) {
        removed.push(uploadfsPath);
      }
    });
    try {
      await apos.http.bigUploadCleanupOne({
        _id: 'legacy',
        files: {
          one: { chunks: 4 },
          two: { chunks: 4 },
          three: { chunks: 4 }
        }
      });
      assert.deepStrictEqual(removed, [
        '/big-uploads/legacy-0-0',
        '/big-uploads/legacy-0-1',
        '/big-uploads/legacy-0-2',
        '/big-uploads/legacy-1-0',
        '/big-uploads/legacy-1-1',
        '/big-uploads/legacy-1-2'
      ]);
    } finally {
      apos.http.options.bigUploadMaxFiles = maxFiles;
      apos.http.options.bigUploadMaxChunks = maxChunks;
      apos.http.getBigUploadFs = getBigUploadFs;
    }
  });

  it('should reject an end request for an id that does not exist', async function() {
    const result = await raw({
      type: 'end',
      id: 'abcdefghijklmnopqrstuvwx'
    }, { cookieJar: jar });
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.body.name, 'notfound');
  });

  it('should not accept a query operator in place of an upload id', async function() {
    const start = await raw({ type: 'start' }, {
      cookieJar: jar,
      body: {
        files: {
          file: {
            name: 'target.tar.gz',
            size: 4,
            type: 'application/gzip',
            chunks: 1
          }
        }
      }
    });
    assert.strictEqual(start.status, 200);
    assert(start.body.id);

    for (const id of [ { $ne: '' }, { $exists: true }, [ start.body.id ] ]) {
      const end = await raw({
        type: 'end',
        id
      }, { cookieJar: jar });
      assert.strictEqual(end.status, 404);
      assert.strictEqual(end.body.name, 'notfound');
      const chunk = await raw({
        type: 'chunk',
        id,
        n: 0,
        chunk: 0
      }, { cookieJar: jar });
      assert.strictEqual(chunk.status, 404);
      assert.strictEqual(chunk.body.name, 'notfound');
    }

    // The planted upload is still there, untouched by any of the above
    const still = await apos.http.bigUploads.findOne({ _id: start.body.id });
    assert(still);
    await apos.http.bigUploads.deleteOne({ _id: start.body.id });
  });

  it('should not let one user finish another user\'s upload', async function() {
    const start = await raw({ type: 'start' }, {
      cookieJar: jar,
      body: {
        files: {
          file: {
            name: 'mine.tar.gz',
            size: 4,
            type: 'application/gzip',
            chunks: 1
          }
        }
      }
    });
    assert.strictEqual(start.status, 200);

    // The same id, presented by an anonymous request to the route that
    // permits them
    const end = await raw({
      type: 'end',
      id: start.body.id
    }, { route: 'big-upload-public-test' });
    assert.strictEqual(end.status, 404);

    const still = await apos.http.bigUploads.findOne({ _id: start.body.id });
    assert(still);
    await apos.http.bigUploads.deleteOne({ _id: start.body.id });
  });

  it('should still allow an anonymous big upload when authorize is false', async function() {
    const { default: bigUpload } = await getBigUpload();
    const result = await bigUpload('/api/v1/test/big-upload-public-test', {
      files: {
        file
      },
      http: httpFor(),
      chunkSize: 1024
    });

    assert(publicReceived);
    assert.strictEqual(result.ok, true);
  });

  it('should not have crashed the process along the way', async function() {
    // Background cleanup is not awaited by the request, so give it a moment
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.deepStrictEqual(unhandled.map(e => e && e.message), []);
  });
});
