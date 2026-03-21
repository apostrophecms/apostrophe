const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const fs = require('fs');

describe('Files', function() {

  let apos;

  const mockFiles = [
    {
      type: '@apostrophecms/file',
      slug: 'file-pretty-nice',
      visibility: 'public',
      attachment: {
        type: 'attachment',
        _id: 'testid',
        name: 'testname',
        extension: 'pdf',
        // Only for simulation purposes
        data: 'I am a fake PDF'
      }
    }
  ];

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/file': {
          options: {
            prettyUrls: true
          }
        }
      }
    });

    assert(apos.file);
    assert(apos.file.__meta.name === '@apostrophecms/file');
    // Bring the right port number into the base URL. This is
    // good enough for loopback only, which is why we only
    // use this trick in tests
    apos.baseUrl = apos.http.getBase();

    // Clean up any leftovers from last time
    try {
      const response = await apos.doc.db.deleteMany(
        { type: '@apostrophecms/file' }
      );
      assert(response.result.ok === 1);
      try {
        fs.mkdirSync(`${__dirname}/public/uploads/attachments`);
      } catch (e) {
        // May already exist
      }
      for (const file of mockFiles) {
        try {
          const {
            _id, name, extension
          } = file;
          fs.unlinkSync(`${__dirname}/public/uploads/attachments/${_id}-${name}.${extension}`);
        } catch (e) {
          // Don't care if we got that far or not
        }
      }
    } catch (e) {
      assert(false);
    }

  });

  it('should add files for testing', async function() {
    assert(apos.file.insert);

    const req = apos.task.getReq();

    const insertPromises = mockFiles.map(async (file) => {
      const result = await apos.file.insert(req, file);
      const {
        _id, name, extension, data
      } = file.attachment;
      fs.writeFileSync(`${__dirname}/public/uploads/attachments/${_id}-${name}.${extension}`, data);
      return result;
    });

    const inserted = await Promise.all(insertPromises);

    assert(inserted.length === mockFiles.length);
    assert(inserted[0]._id);
  });

  it('should generate an ugly URL when prettyUrls: true is not set on the module', async function() {
    apos.file.options.prettyUrls = false;
    try {
      const req = apos.task.getAnonReq();
      const files = await apos.file.find(req).toArray();
      assert.strictEqual(files.length, 1);
      const file = files[0];
      const attachment = apos.attachment.first(file);
      const url = apos.attachment.url(attachment);
      assert(url);
      assert.strictEqual(url, `/uploads/attachments/${attachment._id}-${attachment.name}.${attachment.extension}`);
    } finally {
      // So we don't spoil the next test either way
      apos.file.options.prettyUrls = true;
    }
  });

  it('should generate a pretty URL when prettyUrls: true is set and successfully serve it', async function() {
    const req = apos.task.getAnonReq();
    try {
      apos.file.options.prettyUrls = true;
      const files = await apos.file.find(req).toArray();
      assert.strictEqual(files.length, 1);
      const file = files[0];
      const attachment = apos.attachment.first(file);
      const url = apos.attachment.url(attachment);
      assert(url);
      assert.strictEqual(url, `${apos.http.getBase()}/files/${file.slug.replace('file-', '')}.${attachment.extension}`);
      const body = await apos.http.get(url);
      assert.strictEqual(body, attachment.data);
    } finally {
      apos.file.options.prettyUrls = false;
    }
  });

});
