const t = require('../test-lib/test.js');
const assert = require('assert');
const bigUpload = require('../lib/big-upload-client.js');
const buffer = fs.readFileSync(`${__dirname}/data/upload_tests/crop_image.png`);
const qs = require('qs');

describe('Big Upload', function() {

  let apos;
  let jar;
  let received = false;

  after(async function () {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('init apos', async function() {
    apos = await t.create({
      root: module,
      modules: {
        test: {
          apiRoutes: (self) => ({
            post: {
              '/big-upload-test': (req) => {
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
            }
          })
        }
      }
    });

    assert(apos.http);
    jar = apos.http.jar();
  });

  it('should be able to make a big upload request', async function() {
    const file = {
      size: buffer.size,
      name: 'crop_image.png',
      slice(from, to) {
        return buffer.slice(from, to)
      }
    };
    const FormData = () => {
      this.parts = {};
      this.append = (name, blob) => {
        this.parts[name] = blob;
      };
    };
    
    const result = await bigUpload('/api/v1/test/big-upload-test', {
      files: {
        file,
        FormData,
        http: {
          post(url, options) {
            if (options.qs) {
              url += '?' + qs.stringify(options.qs);
            }
          }
        }
      }
    });

    assert.strictEqual(result.ok, true);
  });

});
