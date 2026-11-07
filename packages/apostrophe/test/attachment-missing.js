const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

// An attachment field whose attachment record is missing from the database
// (#4713). Saves go through convertUpdateAndRefresh, the REST PUT path the
// editor uses.
describe('Attachment missing from the database', function() {
  let apos;
  this.timeout(t.timeout);
  const uploadSource = path.join(__dirname, '/data/upload_tests/');

  after(async function() {
    await fs.remove(path.join(__dirname, '/public/uploads'));
    if (apos) {
      await t.destroy(apos);
    }
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/uploadfs': {
          options: { uploadfs: { disabledFileKey: 'testkey' } }
        },
        '@apostrophecms/image': { options: { versions: false } },
        'optional-file': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              file: { type: 'attachment' },
              items: {
                type: 'array',
                fields: {
                  add: {
                    file: { type: 'attachment' }
                  }
                }
              }
            }
          }
        },
        'conditional-file': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              mode: {
                type: 'select',
                def: 'link',
                choices: [
                  {
                    label: 'Upload',
                    value: 'upload'
                  },
                  {
                    label: 'Link',
                    value: 'link'
                  }
                ]
              },
              file: {
                type: 'attachment',
                required: true,
                if: { mode: 'upload' }
              }
            }
          }
        }
      }
    });
  });

  async function newAttachment() {
    return apos.attachment.insert(apos.task.getReq(), {
      name: 'upload_image.png',
      path: uploadSource + 'upload_image.png'
    });
  }

  async function forget(attachment) {
    await apos.attachment.db.deleteOne({ _id: attachment._id });
  }

  // Insert a doc, then save it the way the editor does: the client sends the
  // doc back as it last saw it, plus the user's change.
  async function insertThenEdit(pieceModule, fields, change, { beforeEdit } = {}) {
    const req = apos.task.getReq();
    const doc = await pieceModule.insert(req, {
      ...pieceModule.newInstance(),
      title: 'Orphan',
      ...fields
    });
    if (beforeEdit) {
      await beforeEdit(doc);
    }
    await pieceModule.convertUpdateAndRefresh(req, {
      ...doc,
      ...change
    }, doc._id);
    return apos.doc.db.findOne({ _id: doc._id });
  }

  function isInvalid(errors) {
    return [].concat(errors).some(error => error.name === 'invalid');
  }

  it('rejects saving a required attachment whose record is missing', async function() {
    const attachment = await newAttachment();
    await assert.rejects(
      insertThenEdit(
        apos.image,
        { attachment },
        { title: 'Edited' },
        { beforeEdit: () => forget(attachment) }
      ),
      isInvalid
    );
  });

  it('rejects saving an optional attachment whose record is missing', async function() {
    const attachment = await newAttachment();
    await assert.rejects(
      insertThenEdit(
        apos.modules['optional-file'],
        { file: attachment },
        { title: 'Edited' },
        { beforeEdit: () => forget(attachment) }
      ),
      isInvalid
    );
  });

  it('rejects saving an array item attachment whose record is missing', async function() {
    const attachment = await newAttachment();
    await assert.rejects(
      insertThenEdit(
        apos.modules['optional-file'],
        {
          items: [ {
            _id: apos.util.generateId(),
            metaType: 'arrayItem',
            file: attachment
          } ]
        },
        { title: 'Edited' },
        { beforeEdit: () => forget(attachment) }
      ),
      isInvalid
    );
  });

  it('rejects a field newly pointed at a missing attachment', async function() {
    const attachment = await newAttachment();
    await forget(attachment);
    await assert.rejects(
      insertThenEdit(
        apos.modules['optional-file'],
        { file: null },
        { file: attachment }
      ),
      isInvalid
    );
  });

  it('names the missing attachment in the error', async function() {
    const attachment = await newAttachment();
    await assert.rejects(
      insertThenEdit(
        apos.image,
        { attachment },
        { title: 'Edited' },
        { beforeEdit: () => forget(attachment) }
      ),
      errors => [].concat(errors).some(error => error.data?.errors?.some(
        sub => sub.message?.includes(attachment._id)
      ) || error.message?.includes(attachment._id))
    );
  });

  it('leaves the stored document unchanged when the save is rejected', async function() {
    const attachment = await newAttachment();
    const req = apos.task.getReq();
    const doc = await apos.image.insert(req, {
      ...apos.image.newInstance(),
      title: 'Orphan',
      attachment
    });
    await forget(attachment);
    await assert.rejects(
      apos.image.convertUpdateAndRefresh(req, {
        ...doc,
        title: 'Edited'
      }, doc._id)
    );
    const stored = await apos.doc.db.findOne({ _id: doc._id });
    assert.strictEqual(stored.title, 'Orphan');
  });

  it('saves a document whose missing attachment is hidden by an if condition', async function() {
    const attachment = await newAttachment();
    const stored = await insertThenEdit(
      apos.modules['conditional-file'],
      {
        mode: 'link',
        file: attachment
      },
      { title: 'Edited' },
      { beforeEdit: () => forget(attachment) }
    );
    assert.strictEqual(stored.title, 'Edited');
  });

  it('still clears the field when no attachment is sent', async function() {
    const attachment = await newAttachment();
    const stored = await insertThenEdit(
      apos.modules['optional-file'],
      { file: attachment },
      { file: null }
    );
    assert.strictEqual(stored.file, null);
  });
});
