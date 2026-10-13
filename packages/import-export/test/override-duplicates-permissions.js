const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const { output: gzip } = require('../lib/formats/gzip.js');
const {
  getAppConfig, insertAdminUser, cleanData
} = require('./util/index.js');

// `overrideDuplicates` continues an import once the user has confirmed which
// existing documents to replace. What it writes must be limited to what the
// import found for that user, and authorized against the documents it
// actually overwrites.
describe('#overrideDuplicates - permissions', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let tempPath;
  let exportsPath;
  let counter = 0;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig({
        'guarded-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'guardedPiece'
          }
        },
        // Editors may edit drafts of this type but only admins may publish
        'admin-published-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'adminPublishedPiece',
            publishRole: 'admin'
          }
        },
        // Editable, but not importable
        'locked-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'lockedPiece',
            importExport: {
              import: false
            }
          }
        }
      })
    });

    tempPath = path.join(apos.rootDir, 'data/temp/override-duplicates-permissions');
    exportsPath = path.join(apos.rootDir, 'public/uploads/exports');
    importExportManager = apos.modules['@apostrophecms/import-export'];

    await insertAdminUser(apos);
  });

  after(async function() {
    await cleanData([ tempPath, exportsPath ]);
    await t.destroy(apos);
  });

  afterEach(async function() {
    await apos.doc.db.deleteMany({
      type: { $in: [ 'guarded-piece', 'admin-published-piece', 'locked-piece' ] }
    });
  });

  function getReq(role, userId, body = {}) {
    const req = apos.task.getReq({
      role,
      locale: 'en',
      mode: 'draft',
      body
    });
    req.user._id = userId;
    return req;
  }

  // Insert and publish a piece as an admin
  async function insertPublished(manager, title) {
    const req = apos.task.getReq({ mode: 'draft' });
    const draft = await manager.insert(req, {
      ...manager.newInstance(),
      title
    });
    await manager.publish(req, draft);
    return {
      draft,
      draftId: draft._id,
      publishedId: draft._id.replace(':draft', ':published')
    };
  }

  // Export a piece (both modes), then give its existing versions the title
  // "live" so that replacing them shows
  async function exportThenChange(manager, piece) {
    const req = apos.task.getReq({
      mode: 'draft',
      body: {
        _ids: [ piece.draftId ],
        type: 'test'
      }
    });
    const { url } = await importExportManager.export(req, manager);
    const fileName = path.basename(url);
    await fs.mkdir(tempPath, { recursive: true });
    const archive = path.join(tempPath, `export-${counter++}-${fileName}`);
    await fs.copyFile(path.join(exportsPath, fileName), archive);
    await apos.doc.db.updateMany(
      { _id: { $in: [ piece.draftId, piece.publishedId ] } },
      { $set: { title: 'live' } }
    );
    return archive;
  }

  async function importAs(role, userId, archive) {
    const req = getReq(role, userId);
    req.files = {
      file: {
        path: archive,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };
    const result = await quietly(() => importExportManager.import(req));
    assert.ok(result.duplicatedDocs.length, 'the import should find duplicates');
    return result;
  }

  function overrideAs(role, userId, result, changes = {}) {
    const req = getReq(role, userId, {
      docIds: result.duplicatedDocs.map(({ aposDocId }) => aposDocId),
      duplicatedDocs: result.duplicatedDocs,
      importedAttachments: result.importedAttachments,
      exportId: result.exportId,
      jobId: result.jobId,
      formatLabel: result.formatLabel,
      ...changes
    });
    return quietly(() => importExportManager.overrideDuplicates(req));
  }

  // Failures are logged with `apos.util.error`, keep the output readable
  async function quietly(fn) {
    const origError = apos.util.error;
    apos.util.error = () => {};
    try {
      return await fn();
    } finally {
      apos.util.error = origError;
    }
  }

  async function titleOf(_id) {
    return (await apos.doc.db.findOne({ _id }))?.title;
  }

  it('should not let a contributor replace a published document through an inconsistent mode', async function() {
    const piece = await insertPublished(apos.guardedPiece, 'live');
    await fs.mkdir(tempPath, { recursive: true });
    const archive = path.join(tempPath, `crafted-${counter++}.tar.gz`);
    // A "draft" pointing at the published version
    await gzip(archive, {
      docs: [
        {
          _id: piece.publishedId,
          aposDocId: piece.draft.aposDocId,
          aposLocale: 'en:published',
          aposMode: 'draft',
          type: 'guarded-piece',
          title: 'replaced',
          slug: piece.draft.slug,
          visibility: 'public',
          archived: false
        }
      ],
      attachments: []
    }, async () => {});

    const result = await importAs('contributor', 'contributor-1', archive);
    await overrideAs('contributor', 'contributor-1', result);

    assert.equal(await titleOf(piece.publishedId), 'live');
  });

  it('should not let a contributor replace a document the import did not offer to replace', async function() {
    const piece = await insertPublished(apos.guardedPiece, 'from archive');
    const archive = await exportThenChange(apos.guardedPiece, piece);
    const other = await insertPublished(apos.guardedPiece, 'other');

    const result = await importAs('contributor', 'contributor-1', archive);
    await overrideAs('contributor', 'contributor-1', result, {
      duplicatedDocs: result.duplicatedDocs.map(duplicate => ({
        ...duplicate,
        replaceId: other.draft.aposDocId
      }))
    });

    assert.equal(await titleOf(other.draftId), 'other');
    assert.equal(await titleOf(other.publishedId), 'other');
  });

  it('should not let a contributor replace a document of a type they may not import', async function() {
    const piece = await insertPublished(apos.guardedPiece, 'from archive');
    const archive = await exportThenChange(apos.guardedPiece, piece);
    const locked = await insertPublished(apos.lockedPiece, 'locked');

    const result = await importAs('contributor', 'contributor-1', archive);
    await overrideAs('contributor', 'contributor-1', result, {
      duplicatedDocs: result.duplicatedDocs.map(duplicate => ({
        ...duplicate,
        replaceId: locked.draft.aposDocId
      }))
    });

    assert.equal(await titleOf(locked.draftId), 'locked');
    assert.equal(await titleOf(locked.publishedId), 'locked');
  });

  it('should not let an editor replace the published version of a type only admins may publish', async function() {
    const piece = await insertPublished(apos.adminPublishedPiece, 'from archive');
    const archive = await exportThenChange(apos.adminPublishedPiece, piece);

    const result = await importAs('editor', 'editor-1', archive);
    await overrideAs('editor', 'editor-1', result);

    assert.equal(await titleOf(piece.draftId), 'from archive', 'the draft should be replaced');
    assert.equal(await titleOf(piece.publishedId), 'live', 'the published doc should not change');
  });

  it('should not let a user continue the import of another user', async function() {
    const piece = await insertPublished(apos.guardedPiece, 'from archive');
    const archive = await exportThenChange(apos.guardedPiece, piece);

    const result = await importAs('editor', 'editor-1', archive);
    await assert.rejects(overrideAs('editor', 'editor-2', result));

    assert.equal(await titleOf(piece.draftId), 'live');
    assert.equal(await titleOf(piece.publishedId), 'live');
  });

  it('should let a contributor replace the draft only', async function() {
    const piece = await insertPublished(apos.guardedPiece, 'from archive');
    const archive = await exportThenChange(apos.guardedPiece, piece);

    const result = await importAs('contributor', 'contributor-1', archive);
    await overrideAs('contributor', 'contributor-1', result);

    assert.equal(await titleOf(piece.draftId), 'from archive');
    assert.equal(await titleOf(piece.publishedId), 'live');
  });

  it('should let an editor replace both versions of a document they may publish', async function() {
    const piece = await insertPublished(apos.guardedPiece, 'from archive');
    const archive = await exportThenChange(apos.guardedPiece, piece);

    const result = await importAs('editor', 'editor-1', archive);
    await overrideAs('editor', 'editor-1', result);

    assert.equal(await titleOf(piece.draftId), 'from archive');
    assert.equal(await titleOf(piece.publishedId), 'from archive');
  });
});
