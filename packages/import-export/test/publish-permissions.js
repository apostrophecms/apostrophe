const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const { output: gzip } = require('../lib/formats/gzip.js');
const {
  getAppConfig, insertAdminUser, cleanData
} = require('./util/index.js');

// Importing must not let a user write the published version of a document
// they are not allowed to publish. Their drafts are still imported.
describe('#import - publish permissions', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let jobManager;
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
        'auto-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'autoPiece',
            autopublish: true
          }
        }
      })
    });

    tempPath = path.join(apos.rootDir, 'data/temp/publish-permissions');
    exportsPath = path.join(apos.rootDir, 'public/uploads/exports');
    importExportManager = apos.modules['@apostrophecms/import-export'];
    jobManager = apos.modules['@apostrophecms/job'];

    await insertAdminUser(apos);
  });

  after(async function() {
    await cleanData([ tempPath, exportsPath ]);
    await t.destroy(apos);
  });

  afterEach(async function() {
    await apos.doc.db.deleteMany({
      type: { $in: [ 'guarded-piece', 'admin-published-piece', 'auto-piece' ] }
    });
  });

  // Insert a published piece as an admin, export it (both modes) and return
  // the archive path along with the ids of the two modes.
  async function insertAndExport(manager, title) {
    const req = apos.task.getReq({ mode: 'draft' });
    const draft = await manager.insert(req, {
      ...manager.newInstance(),
      title
    });
    await manager.publish(req, draft);
    const exportReq = apos.task.getReq({
      mode: 'draft',
      body: {
        _ids: [ draft._id ],
        type: 'test'
      }
    });
    const { url } = await importExportManager.export(exportReq, manager);
    const fileName = path.basename(url);
    await fs.mkdir(tempPath, { recursive: true });
    const archive = path.join(tempPath, fileName);
    await fs.copyFile(path.join(exportsPath, fileName), archive);
    return {
      archive,
      draftId: draft._id,
      publishedId: draft._id.replace(':draft', ':published')
    };
  }

  // The import renames the uploaded file, give it a fresh copy every time
  async function upload(source, type) {
    const copy = path.join(tempPath, `upload-${counter++}-${path.basename(source)}`);
    await fs.copyFile(source, copy);
    return {
      path: copy,
      type
    };
  }

  async function importAs(role, source, body = {}, moduleName) {
    const req = apos.task.getReq({
      role,
      locale: 'en',
      mode: 'draft',
      body,
      files: {
        file: await upload(
          source,
          source.endsWith('.csv')
            ? importExportManager.formats.csv.allowedTypes[0]
            : importExportManager.formats.gzip.allowedTypes[0]
        )
      }
    });
    return quietly(() => importExportManager.import(req, moduleName));
  }

  async function overrideAs(role, result) {
    const req = apos.task.getReq({
      role,
      locale: 'en',
      mode: 'draft',
      body: {
        docIds: result.duplicatedDocs.map(({ aposDocId }) => aposDocId),
        duplicatedDocs: result.duplicatedDocs,
        importedAttachments: result.importedAttachments,
        exportId: result.exportId,
        jobId: result.jobId,
        formatLabel: result.formatLabel
      }
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

  async function getFailedLog(jobId) {
    const job = await jobManager.db.findOne({ _id: jobId });
    // An import that ends at once stores the log as its results, one
    // waiting for duplicates to be confirmed stores it as `failedLog`
    return Array.isArray(job?.results)
      ? job.results
      : (job?.results?.failedLog || []);
  }

  async function findDoc(_id) {
    return apos.doc.db.findOne({ _id });
  }

  async function writeCsv(name, content) {
    await fs.mkdir(tempPath, { recursive: true });
    const file = path.join(tempPath, name);
    await fs.writeFile(file, content);
    return file;
  }

  describe('new documents', function() {
    it('should import only the draft when a contributor imports a published document', async function() {
      const {
        archive, draftId, publishedId
      } = await insertAndExport(
        apos.guardedPiece,
        'guarded new'
      );
      await apos.doc.db.deleteMany({ type: 'guarded-piece' });

      const result = await importAs('contributor', archive);

      const draft = await findDoc(draftId);
      assert.ok(draft, 'the draft should be imported');
      assert.equal(draft.title, 'guarded new');
      assert.equal(await findDoc(publishedId), null, 'the published doc should not be imported');
      const failedLog = await getFailedLog(result.jobId);
      assert.deepEqual(failedLog.map(({ _id }) => _id), [ publishedId ]);
    });

    it('should not let an editor publish a document of a type only admins may publish', async function() {
      const {
        archive, draftId, publishedId
      } = await insertAndExport(
        apos.adminPublishedPiece,
        'admin published new'
      );
      await apos.doc.db.deleteMany({ type: 'admin-published-piece' });

      const result = await importAs('editor', archive);

      const draft = await findDoc(draftId);
      assert.ok(draft, 'the draft should be imported');
      assert.equal(await findDoc(publishedId), null, 'the published doc should not be imported');
      const failedLog = await getFailedLog(result.jobId);
      assert.deepEqual(failedLog.map(({ _id }) => _id), [ publishedId ]);
    });

    it('should still import both modes for an editor who may publish', async function() {
      const {
        archive, draftId, publishedId
      } = await insertAndExport(
        apos.guardedPiece,
        'editor new'
      );
      await apos.doc.db.deleteMany({ type: 'guarded-piece' });

      const result = await importAs('editor', archive);

      assert.ok(await findDoc(draftId));
      assert.ok(await findDoc(publishedId));
      assert.deepEqual(await getFailedLog(result.jobId), []);
    });

    it('should still import both modes for an admin on a type only admins may publish', async function() {
      const {
        archive, draftId, publishedId
      } = await insertAndExport(
        apos.adminPublishedPiece,
        'admin new'
      );
      await apos.doc.db.deleteMany({ type: 'admin-published-piece' });

      const result = await importAs('admin', archive);

      assert.ok(await findDoc(draftId));
      assert.ok(await findDoc(publishedId));
      assert.deepEqual(await getFailedLog(result.jobId), []);
    });

    it('should let a contributor import drafts only without any failure', async function() {
      const {
        archive, draftId, publishedId
      } = await insertAndExport(
        apos.guardedPiece,
        'drafts only'
      );
      await apos.doc.db.deleteMany({ type: 'guarded-piece' });

      const result = await importAs('contributor', archive, { importDraftsOnly: true });

      assert.ok(await findDoc(draftId));
      assert.equal(await findDoc(publishedId), null);
      assert.deepEqual(await getFailedLog(result.jobId), []);
    });

    it('should keep autopublishing types working for editors', async function() {
      const {
        archive, draftId, publishedId
      } = await insertAndExport(
        apos.autoPiece,
        'auto new'
      );
      await apos.doc.db.deleteMany({ type: 'auto-piece' });

      const result = await importAs('editor', archive);

      assert.ok(await findDoc(draftId));
      assert.ok(await findDoc(publishedId), 'autopublish should publish the draft');
      assert.deepEqual(await getFailedLog(result.jobId), []);
    });
  });

  describe('existing documents (duplicates)', function() {
    for (const [ role, alias, type ] of [
      [ 'contributor', 'guardedPiece', 'guarded-piece' ],
      [ 'editor', 'adminPublishedPiece', 'admin-published-piece' ]
    ]) {
      it(`should not let ${role}s replace the published version of ${type}`, async function() {
        const {
          archive, draftId, publishedId
        } = await insertAndExport(
          apos[alias],
          'from archive'
        );
        // Change the existing doc so the import has something to overwrite
        await apos.doc.db.updateMany(
          { _id: { $in: [ draftId, publishedId ] } },
          { $set: { title: 'live' } }
        );

        const result = await importAs(role, archive);
        assert.equal(result.duplicatedDocs.length, 1);
        await overrideAs(role, result);

        assert.equal((await findDoc(draftId)).title, 'from archive', 'the draft should be replaced');
        assert.equal((await findDoc(publishedId)).title, 'live', 'the published doc should not change');
        const failedLog = await getFailedLog(result.jobId);
        assert.deepEqual(failedLog.map(({ _id }) => _id), [ publishedId ]);
      });
    }

    it('should let an editor replace both versions of a document they may publish', async function() {
      const {
        archive, draftId, publishedId
      } = await insertAndExport(
        apos.guardedPiece,
        'from archive'
      );
      await apos.doc.db.updateMany(
        { _id: { $in: [ draftId, publishedId ] } },
        { $set: { title: 'live' } }
      );

      const result = await importAs('editor', archive);
      await overrideAs('editor', result);

      assert.equal((await findDoc(draftId)).title, 'from archive');
      assert.equal((await findDoc(publishedId)).title, 'from archive');
    });
  });

  describe('documents whose mode is inconsistent', function() {
    // A document claiming to be a draft while its `_id` names the
    // published version
    async function craftArchive(aposDocId, title) {
      await fs.mkdir(tempPath, { recursive: true });
      const archive = path.join(tempPath, `crafted-${counter++}.tar.gz`);
      await gzip(archive, {
        docs: [
          {
            _id: `${aposDocId}:en:published`,
            aposDocId,
            aposLocale: 'en:draft',
            aposMode: 'draft',
            type: 'guarded-piece',
            title,
            slug: `crafted-${aposDocId}`,
            visibility: 'public',
            archived: false
          }
        ],
        attachments: []
      }, async () => {});
      return archive;
    }

    it('should not let a contributor insert a published document', async function() {
      const aposDocId = apos.util.generateId();
      const archive = await craftArchive(aposDocId, 'crafted new');

      const result = await importAs('contributor', archive);

      assert.equal(await findDoc(`${aposDocId}:en:published`), null);
      const failedLog = await getFailedLog(result.jobId);
      assert.equal(failedLog.length, 1);
    });

    it('should not let a contributor replace a published document', async function() {
      const req = apos.task.getReq({ mode: 'draft' });
      const draft = await apos.guardedPiece.insert(req, {
        ...apos.guardedPiece.newInstance(),
        title: 'live'
      });
      await apos.guardedPiece.publish(req, draft);
      const publishedId = draft._id.replace(':draft', ':published');
      const archive = await craftArchive(draft.aposDocId, 'crafted');

      const result = await importAs('contributor', archive);
      assert.equal(result.duplicatedDocs.length, 1);
      await overrideAs('contributor', result);

      assert.equal((await findDoc(publishedId)).title, 'live');
      assert.equal((await findDoc(draft._id)).title, 'live');
    });
  });

  describe('CSV files with a key column', function() {
    it('should not let an editor update the published version of a type only admins may publish', async function() {
      const req = apos.task.getReq({ mode: 'draft' });
      const draft = await apos.adminPublishedPiece.insert(req, {
        ...apos.adminPublishedPiece.newInstance(),
        title: 'csv live'
      });
      await apos.adminPublishedPiece.publish(req, draft);
      const publishedId = draft._id.replace(':draft', ':published');

      const csv = await writeCsv(
        `update-${counter++}.csv`,
        'type,title:key,title\n"admin-published-piece","csv live","csv edited"\n'
      );
      const result = await importAs('editor', csv);

      assert.equal((await findDoc(draft._id)).title, 'csv edited', 'the draft should be updated');
      assert.equal((await findDoc(publishedId)).title, 'csv live', 'the published doc should not change');
      const failedLog = await getFailedLog(result.jobId);
      assert.equal(failedLog.length, 1);
    });

    it('should not let an editor insert a published document of a type only admins may publish', async function() {
      const csv = await writeCsv(
        `insert-${counter++}.csv`,
        'type,title:key,title\n"admin-published-piece","csv new","csv new"\n'
      );
      const result = await importAs('editor', csv);

      const docs = await apos.doc.db
        .find({ type: 'admin-published-piece' })
        .toArray();
      assert.deepEqual(docs.map(({ aposMode }) => aposMode), [ 'draft' ]);
      const failedLog = await getFailedLog(result.jobId);
      assert.equal(failedLog.length, 1);
    });

    it('should still insert both modes for an editor who may publish', async function() {
      const csv = await writeCsv(
        `insert-${counter++}.csv`,
        'type,title:key,title\n"guarded-piece","csv editor","csv editor"\n'
      );
      const result = await importAs('editor', csv);

      const docs = await apos.doc.db
        .find({ type: 'guarded-piece' })
        .sort({ aposMode: 1 })
        .toArray();
      assert.deepEqual(docs.map(({ aposMode }) => aposMode), [ 'draft', 'published' ]);
      assert.deepEqual(await getFailedLog(result.jobId), []);
    });
  });
});
