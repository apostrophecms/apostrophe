const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const FormData = require('form-data');
const testUtil = require('apostrophe/test-lib/test');

// Uploads to the public form submission route are staged by multer in
// `os.tmpdir()`. Point that at a private folder for this instance so we
// can verify what is written there.

describe('Forms module: submission upload limits', function () {
  let apos;
  let tmpDir;
  let originalTmpDir;

  this.timeout(25000);

  const url = '/api/v1/@apostrophecms/form/submit';

  const withFile = {
    _id: 'uploadLimitsWithFile:en:published',
    aposDocId: 'uploadLimitsWithFile',
    aposLocale: 'en:published',
    aposMode: 'published',
    visibility: 'public',
    archived: false,
    type: '@apostrophecms/form',
    title: 'Form with a file field',
    slug: 'upload-limits-with-file',
    contents: {
      _id: 'uploadLimitsWithFileArea',
      metaType: 'area',
      items: [
        {
          _id: 'withFileNameId',
          fieldLabel: 'Name',
          fieldName: 'Name',
          required: true,
          type: '@apostrophecms/form-text-field'
        },
        {
          _id: 'withFileGroupId',
          type: '@apostrophecms/form-group',
          label: 'Group',
          contents: {
            _id: 'withFileGroupArea',
            metaType: 'area',
            items: [
              {
                _id: 'withFilePhotoId',
                fieldLabel: 'Photo',
                fieldName: 'Photo',
                required: false,
                allowMultiple: true,
                type: '@apostrophecms/form-file-field'
              }
            ]
          }
        }
      ]
    }
  };

  const withoutFile = {
    _id: 'uploadLimitsWithoutFile:en:published',
    aposDocId: 'uploadLimitsWithoutFile',
    aposLocale: 'en:published',
    aposMode: 'published',
    visibility: 'public',
    archived: false,
    type: '@apostrophecms/form',
    title: 'Form without a file field',
    slug: 'upload-limits-without-file',
    contents: {
      _id: 'uploadLimitsWithoutFileArea',
      metaType: 'area',
      items: [
        {
          _id: 'withoutFileNameId',
          fieldLabel: 'Name',
          fieldName: 'Name',
          required: true,
          type: '@apostrophecms/form-text-field'
        }
      ]
    }
  };

  before(async function () {
    originalTmpDir = process.env.TMPDIR;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apos-form-upload-test-'));
    process.env.TMPDIR = tmpDir;
    apos = await testUtil.create({
      shortname: 'formsUploadLimitsTest',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            session: {
              secret: 'test-the-form-upload-limits'
            }
          }
        },
        '@apostrophecms/form': {
          options: {
            uploadLimits: {
              fileSize: 1000,
              files: 2
            },
            formWidgets: {
              '@apostrophecms/form-text-field': {},
              '@apostrophecms/form-file-field': {},
              '@apostrophecms/form-group': {}
            }
          }
        },
        '@apostrophecms/form-widget': {},
        '@apostrophecms/form-text-field-widget': {},
        '@apostrophecms/form-file-field-widget': {},
        '@apostrophecms/form-group-widget': {}
      }
    });
    await apos.doc.db.insertMany([ withFile, withoutFile ]);
  });

  after(async function () {
    if (originalTmpDir === undefined) {
      delete process.env.TMPDIR;
    } else {
      process.env.TMPDIR = originalTmpDir;
    }
    await testUtil.destroy(apos);
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

  async function anonJar() {
    // Any visitor gets this cookie from their first GET request
    const jar = apos.http.jar();
    jar.setCookieSync(`${apos.csrfCookieName}=csrf`, apos.http.getBase());
    return jar;
  }

  function file(size = 100) {
    return {
      value: Buffer.from('x'.repeat(size)),
      options: {
        filename: 'upload-test.txt',
        contentType: 'text/plain'
      }
    };
  }

  // `parts` is an array of [ name, value ] pairs, appended in order.
  // A `value` that is not a string is a file
  async function submit(parts) {
    const formData = new FormData();
    for (const [ name, value ] of parts) {
      if (typeof value === 'string') {
        formData.append(name, value);
      } else {
        formData.append(name, value.value, value.options);
      }
    }
    try {
      await apos.http.post(url, {
        body: formData,
        jar: await anonJar()
      });
      return { status: 200 };
    } catch (e) {
      return {
        status: e.status,
        body: e.body
      };
    }
  }

  function data(form, name, extra = {}) {
    return JSON.stringify({
      _id: form._id,
      Name: name,
      ...extra
    });
  }

  function submissionCount(name) {
    return apos.db.collection('aposFormSubmissions').countDocuments({
      'data.Name': name
    });
  }

  it('accepts files for a file field of the form, even in a group', async function () {
    const { status } = await submit([
      [ 'data', data(withFile, 'valid', { Photo: 'files-pending' }) ],
      [ 'Photo-1', file() ],
      [ 'Photo-2', file() ]
    ]);
    assert.equal(status, 200);
    assert.equal(await submissionCount('valid'), 1);
    const submission = await apos.db.collection('aposFormSubmissions').findOne({
      'data.Name': 'valid'
    });
    assert.equal(submission.data.Photo.length, 2);
    assert.deepEqual(leftovers(), []);
  });

  it('still accepts a submission without files for a form without file fields', async function () {
    const { status } = await submit([
      [ 'data', data(withoutFile, 'no-files') ]
    ]);
    assert.equal(status, 200);
    assert.equal(await submissionCount('no-files'), 1);
  });

  it('rejects files sent to a form without file fields', async function () {
    const { status } = await submit([
      [ 'data', data(withoutFile, 'no-file-field') ],
      [ 'Photo-1', file() ]
    ]);
    assert.equal(status, 400);
    assert.equal(await submissionCount('no-file-field'), 0);
    assert.deepEqual(leftovers(), []);
  });

  it('rejects files for a field that is not a file field of the form', async function () {
    const { status } = await submit([
      [ 'data', data(withFile, 'wrong-field') ],
      [ 'Name-1', file() ]
    ]);
    assert.equal(status, 400);
    assert.equal(await submissionCount('wrong-field'), 0);
    assert.deepEqual(leftovers(), []);
  });

  it('rejects files sent before the form is identified', async function () {
    const { status } = await submit([
      [ 'Photo-1', file() ],
      [ 'data', data(withFile, 'files-first', { Photo: 'files-pending' }) ]
    ]);
    assert.equal(status, 400);
    assert.equal(await submissionCount('files-first'), 0);
    assert.deepEqual(leftovers(), []);
  });

  it('rejects files for a form that does not exist', async function () {
    const { status } = await submit([
      [ 'data', data({ _id: 'nonexistent:en:published' }, 'no-form') ],
      [ 'Photo-1', file() ]
    ]);
    assert(status >= 400 && status < 500);
    assert.deepEqual(leftovers(), []);
  });

  it('rejects a file larger than the fileSize limit with a form error', async function () {
    const { status, body } = await submit([
      [ 'data', data(withFile, 'too-large', { Photo: 'files-pending' }) ],
      [ 'Photo-1', file(5000) ]
    ]);
    assert.equal(status, 400);
    assert.equal(body.data.formErrors[0].field, 'Photo');
    assert.equal(await submissionCount('too-large'), 0);
    assert.deepEqual(leftovers(), []);
  });

  it('rejects more files than the files limit', async function () {
    const { status } = await submit([
      [ 'data', data(withFile, 'too-many', { Photo: 'files-pending' }) ],
      [ 'Photo-1', file() ],
      [ 'Photo-2', file() ],
      [ 'Photo-3', file() ]
    ]);
    assert.equal(status, 400);
    assert.equal(await submissionCount('too-many'), 0);
    assert.deepEqual(leftovers(), []);
  });

  it('removes a partially staged file when the client aborts', async function () {
    const jar = await anonJar();
    const cookie = jar.getCookieStringSync(apos.http.getBase());
    const boundary = 'aposFormUploadLimitsBoundary';
    const head = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="data"',
      '',
      data(withFile, 'aborted', { Photo: 'files-pending' }),
      `--${boundary}`,
      'Content-Disposition: form-data; name="Photo-1"; filename="upload-test.txt"',
      'Content-Type: text/plain',
      '',
      'x'.repeat(500)
    ].join('\r\n');
    await new Promise((resolve) => {
      const req = http.request(`${apos.http.getBase()}${url}`, {
        method: 'POST',
        headers: {
          cookie,
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': head.length + 10000
        }
      });
      req.on('error', resolve);
      req.on('close', resolve);
      req.write(head);
      // Give the server time to stage the partial file, then abort
      setTimeout(() => req.destroy(), 500);
    });
    // Give the server time to notice and clean up
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.deepEqual(leftovers(), []);
    assert.equal(await submissionCount('aborted'), 0);
  });
});
