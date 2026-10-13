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
// duplicates prompt), the uploaded archive is kept in uploadfs so that any
// process can resume the import. It must not be readable there by the public.
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

    const uploadPath = path.join(apos.rootDir, 'data/tmp/uploads/topic-draft.tar.gz');
    const archive = await fs.readFile(uploadPath);
    const result = await importExportManager.import(
      req.clone({
        files: {
          file: {
            path: uploadPath,
            type: importExportManager.formats.gzip.allowedTypes[0]
          }
        }
      })
    );
    // Paused at the duplicates prompt
    assert(result.duplicatedDocs.length > 0);
    const exportPath = await importExportManager.getExportPath(result.exportId);

    return {
      req,
      result,
      exportPath,
      archive
    };
  }

  async function getStoredFiles(exportId) {
    let names;
    try {
      names = await fs.readdir(storedPath);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return [];
      }
      throw e;
    }
    return names.filter(name => name.includes(exportId));
  }

  async function anonymousGet(url) {
    const response = await apos.http.get(url, { originalResponse: true });
    return {
      status: response.status,
      body: Buffer.from(await response.arrayBuffer())
    };
  }

  it('is not served at a public URL while the import is pending', async function() {
    const { result, archive } = await startImport();

    const stored = await getStoredFiles(result.exportId);
    assert(stored.length > 0, 'the archive should be kept in uploadfs to resume the import');

    for (const name of stored) {
      const url = `${apos.attachment.uploadfs.getUrl()}/import-export/${name}`;
      const { status, body } = await anonymousGet(url);
      if (status !== 200) {
        continue;
      }
      assert(!body.equals(archive), `${url} serves the pending import archive`);
      // Not the archive nor any other gzip stream
      assert(
        !(body[0] === 0x1f && body[1] === 0x8b),
        `${url} serves a readable archive`
      );
    }
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

    assert.deepEqual(await getStoredFiles(result.exportId), []);
    await assert.rejects(fs.access(exportPath));
  });
});
