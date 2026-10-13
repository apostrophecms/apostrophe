const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const {
  getAppConfig,
  insertAdminUser,
  deletePiecesAndPages,
  deleteAttachments,
  buildFixtures,
  copyFixtures,
  cleanFixtures
} = require('./util/index.js');

// GHSA-5gc8-frw3-3vqm: while an import is pending (e.g. waiting at the
// duplicates prompt), the uploaded archive is kept in uploadfs, at a public
// URL, so that any process can resume the import. Its name must be
// unguessable and must stay inside the import-export folder.
describe('pending import archive', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let attachmentPath;
  let storedPath;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig()
    });

    attachmentPath = path.join(apos.rootDir, 'public/uploads/attachments');
    storedPath = path.join(apos.rootDir, 'public/uploads/import-export');
    importExportManager = apos.modules['@apostrophecms/import-export'];

    await insertAdminUser(apos);
  });

  after(async function() {
    await t.destroy(apos);
    apos = null;
  });

  beforeEach(async function() {
    await deletePiecesAndPages(apos);
    await deleteAttachments(apos, attachmentPath);
    await cleanFixtures(apos);
    await copyFixtures(apos);
    await buildFixtures(apos);
  });

  async function startImport() {
    const req = apos.task.getReq({
      locale: 'en',
      body: {
        formatLabel: 'gzip'
      }
    });

    await apos.topic.insert(apos.task.getReq({ mode: 'draft' }), {
      ...apos.topic.newInstance(),
      _id: '4:en:draft',
      slug: 'topic1-existing-draft',
      title: 'topic1 EXISTING DRAFT'
    });

    const before = await listStored();
    const result = await importExportManager.import(
      req.clone({
        files: {
          file: {
            path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft.tar.gz'),
            type: importExportManager.formats.gzip.allowedTypes[0]
          }
        }
      })
    );
    // Paused at the duplicates prompt
    assert(result.duplicatedDocs.length > 0);
    const exportPath = await importExportManager.getExportPath(result.exportId);
    const stored = (await listStored()).filter(name => !before.includes(name));

    return {
      req,
      result,
      exportPath,
      stored
    };
  }

  async function listStored() {
    try {
      return await fs.readdir(storedPath);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return [];
      }
      throw e;
    }
  }

  it('is stored under an unguessable name while the import is pending', async function() {
    // cuid2 ids (`apos.util.generateId`) draw their entropy from
    // `Math.random()`, which is not a secret. Make them recognizable to
    // prove the stored name does not rely on them.
    const generateId = apos.util.generateId;
    let n = 0;
    apos.util.generateId = () => `predictable${n++}`;
    let started;
    try {
      started = await startImport();
    } finally {
      apos.util.generateId = generateId;
    }
    const { result, stored } = started;

    assert.equal(stored.length, 1, 'the archive should be kept in uploadfs to resume the import');
    const [ name ] = stored;
    assert(!name.includes('predictable'), `${name} is derived from a cuid`);
    // The user's upload name has no business in a public URL
    assert(!name.includes('topic-draft'), `${name} contains the upload name`);
    assert.match(name, /^[0-9a-f]{32}\.tar\.gz$/);
    assert(name.includes(result.exportId));
  });

  it('can still be resumed by a process that does not have the local copy', async function() {
    const {
      req, result, exportPath
    } = await startImport();

    // Simulate another server: no local copy of the archive (the gzip format
    // already removes it once extracted) or of its extraction
    const artifactsPath = await importExportManager
      .getExportArtifactsPath(result.exportId);
    await fs.rm(exportPath, { force: true });
    await fs.rm(artifactsPath, {
      recursive: true,
      force: true
    });

    await importExportManager.overrideDuplicates(req.clone({
      body: {
        ...req.body,
        docIds: result.duplicatedDocs.map(({ aposDocId }) => aposDocId),
        duplicatedDocs: result.duplicatedDocs,
        importedAttachments: result.importedAttachments,
        exportId: result.exportId,
        jobId: result.jobId,
        notificationId: result.notificationId,
        formatLabel: result.formatLabel
      }
    }));

    const draft = await apos.doc.db.findOne({ _id: '4:en:draft' });
    assert.equal(draft.title, 'topic1');

    await importExportManager.cleanExport(req.clone({
      body: {
        exportId: result.exportId,
        jobId: result.jobId,
        notificationId: result.notificationId
      }
    }));

    assert.deepEqual(
      (await listStored()).filter(name => name.includes(result.exportId)),
      []
    );
    await assert.rejects(fs.access(exportPath));
  });
});
