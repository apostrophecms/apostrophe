const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FormData = require('form-data');
const t = require('../test-lib/test.js');

// Uploads to the CSV table route are staged by multer in `os.tmpdir()`.
// Point that at a private folder for the duration of these tests so we
// can verify nothing is left behind.

describe('Rich Text Widget CSV table import', function () {
  let apos;
  let tmpDir;
  let originalTmpDir;
  const url = '/api/v1/@apostrophecms/rich-text-widget/generate-csv-table';

  this.timeout(t.timeout);

  before(async function () {
    originalTmpDir = process.env.TMPDIR;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apos-csv-test-'));
    process.env.TMPDIR = tmpDir;
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/rich-text-widget': {
          options: {
            csvTableMaxSize: 1024 * 1024
          }
        }
      }
    });
    await t.createUser(apos, 'contributor');
    await t.createUser(apos, 'guest');
  });

  after(async function () {
    if (originalTmpDir === undefined) {
      delete process.env.TMPDIR;
    } else {
      process.env.TMPDIR = originalTmpDir;
    }
    await t.destroy(apos);
    fs.rmSync(tmpDir, {
      recursive: true,
      force: true
    });
  });

  beforeEach(function () {
    // Each test checks only for files it left behind itself
    for (const name of fs.readdirSync(tmpDir)) {
      fs.rmSync(path.join(tmpDir, name), {
        recursive: true,
        force: true
      });
    }
  });

  function leftovers() {
    return fs.readdirSync(tmpDir);
  }

  function form(filename, content) {
    const formData = new FormData();
    formData.append('file', Buffer.from(content), {
      filename,
      contentType: 'text/plain'
    });
    return formData;
  }

  async function anonJar() {
    const jar = apos.http.jar();
    await apos.http.get('/', { jar });
    return jar;
  }

  async function userJar(username) {
    const jar = await t.loginAs(apos, username);
    await apos.http.get('/', { jar });
    return jar;
  }

  async function post(filename, content, jar) {
    try {
      const result = await apos.http.post(url, {
        body: form(filename, content),
        jar
      });
      return {
        status: 200,
        result
      };
    } catch (e) {
      return { status: e.status };
    }
  }

  it('refuses anonymous uploads and leaves no temporary file behind', async function () {
    const { status } = await post('table.csv', 'a,b\n1,2\n', await anonJar());
    assert.equal(status, 403);
    assert.deepEqual(leftovers(), []);
  });

  it('refuses uploads from users who cannot edit content', async function () {
    const jar = await userJar('guest');
    const { status } = await post('table.csv', 'a,b\n1,2\n', jar);
    assert.equal(status, 403);
    assert.deepEqual(leftovers(), []);
  });

  it('removes the temporary file when a non-csv upload is rejected', async function () {
    const jar = await userJar('contributor');
    const { status } = await post('rejected.txt', 'x'.repeat(10000), jar);
    assert.equal(status, 400);
    assert.deepEqual(leftovers(), []);
  });

  it('converts a csv upload to a table and removes the temporary file', async function () {
    const jar = await userJar('contributor');
    const { status, result } = await post('table.csv', 'a,b\n1,2\n', jar);
    assert.equal(status, 200);
    assert.equal(result.type, 'table');
    assert.deepEqual(leftovers(), []);
  });

  it('rejects uploads larger than csvTableMaxSize without leaving a file', async function () {
    const jar = await userJar('contributor');
    const { status } = await post('big.csv', 'a,b\n' + '1,2\n'.repeat(512 * 1024), jar);
    assert.equal(status, 400);
    assert.deepEqual(leftovers(), []);
  });
});
