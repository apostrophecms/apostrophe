const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

// An attachment field whose attachment record is missing from the database
// (#4713). Saves go through convertUpdateAndRefresh, the REST PUT path the
// editor uses, and the assertions read the stored document back.
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
        'pdf-file': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              file: {
                type: 'attachment',
                extensions: [ 'pdf' ]
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

  async function captureWarnings(fn) {
    const warnings = [];
    const logWarn = apos.attachment.logWarn;
    apos.attachment.logWarn = (...args) => warnings.push(args);
    try {
      await fn();
    } finally {
      apos.attachment.logWarn = logWarn;
    }
    return warnings;
  }

  it('keeps a required attachment whose record is missing', async function() {
    const attachment = await newAttachment();
    const stored = await insertThenEdit(
      apos.image,
      { attachment },
      { title: 'Edited' },
      { beforeEdit: () => forget(attachment) }
    );
    assert.strictEqual(stored.attachment?._id, attachment._id);
  });

  it('saves the rest of the edit', async function() {
    const attachment = await newAttachment();
    const stored = await insertThenEdit(
      apos.image,
      { attachment },
      { title: 'Edited' },
      { beforeEdit: () => forget(attachment) }
    );
    assert.strictEqual(stored.title, 'Edited');
  });

  it('keeps an optional attachment whose record is missing', async function() {
    const attachment = await newAttachment();
    const stored = await insertThenEdit(
      apos.modules['optional-file'],
      { file: attachment },
      { title: 'Edited' },
      { beforeEdit: () => forget(attachment) }
    );
    assert.strictEqual(stored.file?._id, attachment._id);
  });

  it('keeps an attachment in an array item whose record is missing', async function() {
    const attachment = await newAttachment();
    const itemId = apos.util.generateId();
    const stored = await insertThenEdit(
      apos.modules['optional-file'],
      {
        items: [ {
          _id: itemId,
          metaType: 'arrayItem',
          file: attachment
        } ]
      },
      { title: 'Edited' },
      { beforeEdit: () => forget(attachment) }
    );
    assert.strictEqual(stored.items[0].file?._id, attachment._id);
  });

  it('keeps a required attachment hidden by an if condition', async function() {
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
    assert.strictEqual(stored.file?._id, attachment._id);
  });

  it('clears a field newly pointed at a missing attachment', async function() {
    const attachment = await newAttachment();
    await forget(attachment);
    const stored = await insertThenEdit(
      apos.modules['optional-file'],
      { file: null },
      { file: attachment }
    );
    assert.strictEqual(stored.file, null);
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

  it('logs an attachment-not-found warning naming the attachment', async function() {
    const attachment = await newAttachment();
    const warnings = await captureWarnings(() => insertThenEdit(
      apos.image,
      { attachment },
      { title: 'Edited' },
      { beforeEdit: () => forget(attachment) }
    ));
    const [ , , , data ] = warnings.find(([ , type ]) => type === 'attachment-not-found') || [];
    assert.strictEqual(data?.attachmentId, attachment._id);
  });

  it('names the document, not the array item, in the warning', async function() {
    const attachment = await newAttachment();
    let docId;
    const warnings = await captureWarnings(() => insertThenEdit(
      apos.modules['optional-file'],
      {
        items: [ {
          _id: apos.util.generateId(),
          metaType: 'arrayItem',
          file: attachment
        } ]
      },
      { title: 'Edited' },
      {
        beforeEdit: async (doc) => {
          docId = doc._id;
          await forget(attachment);
        }
      }
    ));
    const [ , , , data ] = warnings.find(([ , type ]) => type === 'attachment-not-found') || [];
    assert.strictEqual(data?.docId, docId);
  });

  it('reports kept: true when it keeps the stored reference', async function() {
    const attachment = await newAttachment();
    const warnings = await captureWarnings(() => insertThenEdit(
      apos.image,
      { attachment },
      { title: 'Edited' },
      { beforeEdit: () => forget(attachment) }
    ));
    const [ , , , data ] = warnings.find(([ , type ]) => type === 'attachment-not-found') || [];
    assert.strictEqual(data?.kept, true);
  });

  it('reports kept: false when it clears the field', async function() {
    const attachment = await newAttachment();
    await forget(attachment);
    const warnings = await captureWarnings(() => insertThenEdit(
      apos.modules['optional-file'],
      { file: null },
      { file: attachment }
    ));
    const [ , , , data ] = warnings.find(([ , type ]) => type === 'attachment-not-found') || [];
    assert.strictEqual(data?.kept, false);
  });

  it('warns only once per missing attachment', async function() {
    const attachment = await newAttachment();
    const req = apos.task.getReq();
    const warnings = await captureWarnings(async () => {
      const doc = await apos.image.insert(req, {
        ...apos.image.newInstance(),
        title: 'Orphan',
        attachment
      });
      await forget(attachment);
      await apos.image.convertUpdateAndRefresh(req, {
        ...doc,
        title: 'First'
      }, doc._id);
      await apos.image.convertUpdateAndRefresh(req, {
        ...doc,
        title: 'Second'
      }, doc._id);
    });
    const count = warnings.filter(([ , type ]) => type === 'attachment-not-found').length;
    assert.strictEqual(count, 1);
  });

  it('rejects a kept attachment whose file type the field does not accept', async function() {
    const attachment = await newAttachment();
    await assert.rejects(
      insertThenEdit(
        apos.modules['pdf-file'],
        { file: attachment },
        { title: 'Edited' },
        { beforeEdit: () => forget(attachment) }
      ),
      errors => [].concat(errors).some(error => error.name === 'invalid')
    );
  });

  it('leaves docId out when the field is not yet on a saved document', async function() {
    const attachment = await newAttachment();
    await forget(attachment);
    const pieceModule = apos.modules['optional-file'];
    const warnings = await captureWarnings(() => pieceModule.convert(
      apos.task.getReq(),
      {
        title: 'New',
        file: attachment
      },
      pieceModule.newInstance()
    ));
    const [ , , , data ] = warnings.find(([ , type ]) => type === 'attachment-not-found') || [];
    assert.deepStrictEqual(Object.keys(data || {}).sort(), [ 'attachmentId', 'field', 'kept' ]);
  });
});
