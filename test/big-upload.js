const assert = require('assert');
const path = require('path');
const fs = require('fs');
const qs = require('qs');

const t = require('../test-lib/test.js');
const getBigUpload = async () => import('../modules/@apostrophecms/http/ui/apos/big-upload-client.js');
const buffer = fs.readFileSync(path.resolve(__dirname, 'data/upload_tests/crop_image.png'));

describe('Big Upload', function() {

  let apos;
  let received = false;

  after(async function () {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  before(async function() {
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
              ]
            }
          })
        }
      }
    });

    assert(apos.http);
  });

  it('should be able to make a big upload request', async function() {

    // Must have the same shape as a browser-side File object and be sliceable,
    // returning a Blob

    const file = {
      size: buffer.byteLength,
      name: 'crop_image.png',
      slice(from, to) {
        return new Blob([ buffer.subarray(from, to) ]);
      }
    };

    // Emulate the browser-side apos.http object just barely well enough to test
    // big-upload-client server-side.
    //
    // self.apos.http won't work for this task because it is based on node-fetch 2
    // which doesn't have a 100% browser-compatible API for blobs

    const http = {
      async post(url, options) {
        if (options.qs) {
          url += '?' + qs.stringify(options.qs);
        }
        const isFormData = options.body instanceof FormData;
        const body = isFormData ? options.body : JSON.stringify(options.body);
        const headers = {};
        headers.cookie = `${apos.csrfCookieName}=csrf`;
        if (!isFormData) {
          headers['content-type'] = 'application/json';
        }
        const base = apos.http.getBase();
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
    };
    const { default: bigUpload } = await getBigUpload();
    const result = await bigUpload('/api/v1/test/big-upload-test', {
      files: {
        file
      },
      http,
      chunkSize: 1024
    });

    assert(received);
    assert.strictEqual(result.ok, true);
  });
});
