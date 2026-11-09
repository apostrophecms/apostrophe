const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const {
  getAppConfig, insertAdminUser, cleanData, getExtractedFiles
} = require('./util/index.js');

// Exports must not contain the fields the exporting user may not view
// (`viewPermission`), neither in the exported documents nor in the related
// documents exported with them, whatever the format.
describe('#export - viewPermission', function() {
  this.timeout(t.timeout);

  const adminOnly = {
    action: 'edit',
    type: '@apostrophecms/user'
  };

  let apos;
  let importExportManager;
  let exportsPath;
  let tempPath;
  let piece;
  let attachment;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig({
        'secret-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'secretPiece'
          },
          fields: {
            add: {
              adminNote: {
                type: 'string',
                viewPermission: adminOnly
              },
              adminFile: {
                type: 'attachment',
                viewPermission: adminOnly
              },
              _related: {
                type: 'relationship',
                withType: 'secret-related'
              }
            }
          }
        },
        'secret-related': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'secretRelated'
          },
          fields: {
            add: {
              adminNote: {
                type: 'string',
                viewPermission: adminOnly
              }
            }
          }
        }
      })
    });

    importExportManager = apos.modules['@apostrophecms/import-export'];
    exportsPath = path.join(apos.rootDir, 'public/uploads/exports');
    tempPath = path.join(apos.rootDir, 'data/temp/export-view-permission');

    await insertAdminUser(apos);

    const req = apos.task.getReq({ mode: 'draft' });
    attachment = await apos.attachment.insert(req, {
      name: 'test-image.jpg',
      path: path.join(apos.rootDir, 'public/test-image.jpg')
    });
    const related = await apos.secretRelated.insert(req, {
      ...apos.secretRelated.newInstance(),
      title: 'related',
      adminNote: 'related hidden value'
    });
    piece = await apos.secretPiece.insert(req, {
      ...apos.secretPiece.newInstance(),
      title: 'piece',
      adminNote: 'piece hidden value',
      adminFile: attachment,
      _related: [ related ]
    });
  });

  after(async function() {
    await cleanData([ exportsPath, tempPath ]);
    await apos.attachment.db.deleteMany({});
    await t.destroy(apos);
  });

  async function exportAs(role, formatName) {
    const req = apos.task.getReq({
      role,
      mode: 'draft',
      body: {
        _ids: [ piece._id ],
        type: 'test',
        relatedTypes: [ 'secret-related' ],
        formatName
      }
    });
    const { url } = await importExportManager.export(req, apos.secretPiece);
    return path.join(exportsPath, path.basename(url));
  }

  async function exportGzipAs(role) {
    const file = await exportAs(role, 'gzip');
    await fs.mkdir(tempPath, { recursive: true });
    const copy = path.join(tempPath, path.basename(file));
    await fs.copyFile(file, copy);
    const { exportPath } = await importExportManager.formats.gzip.input(copy);
    return getExtractedFiles(exportPath);
  }

  function byType(docs, type) {
    const found = docs.filter(doc => doc.type === type);
    assert.ok(found.length, `the export should include ${type}`);
    return found;
  }

  it('should not export the fields a contributor may not view', async function() {
    const { docs, attachments } = await exportGzipAs('contributor');

    for (const doc of byType(docs, 'secret-piece')) {
      assert.equal(doc.adminNote, undefined);
      assert.equal(doc.adminFile, undefined);
    }
    for (const doc of byType(docs, 'secret-related')) {
      assert.equal(doc.adminNote, undefined);
    }
    assert.deepEqual(attachments, []);
  });

  it('should not export the fields a contributor may not view as CSV', async function() {
    const file = await exportAs('contributor', 'csv');
    const csv = await fs.readFile(file, 'utf8');

    assert.ok(csv.includes('piece'), 'the export should include the piece');
    assert.ok(!csv.includes('hidden value'), 'the export should not include the hidden values');
  });

  it('should still export those fields for an admin', async function() {
    const { docs, attachments } = await exportGzipAs('admin');

    for (const doc of byType(docs, 'secret-piece')) {
      assert.equal(doc.adminNote, 'piece hidden value');
      assert.equal(doc.adminFile._id, attachment._id);
    }
    for (const doc of byType(docs, 'secret-related')) {
      assert.equal(doc.adminNote, 'related hidden value');
    }
    assert.deepEqual(attachments.map(({ _id }) => _id), [ attachment._id ]);
  });
});
