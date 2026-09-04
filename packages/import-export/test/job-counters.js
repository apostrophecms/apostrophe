const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const t = require('apostrophe/test-lib/util.js');

const {
  getAppConfig,
  insertAdminUser,
  insertPiecesAndPages,
  deletePiecesAndPages,
  deleteAttachments,
  cleanData
} = require('./util/index.js');

// How long each job counter write is held back. It has to outlast the work an
// import still does after its last counter call — ending the job, notifying,
// recomputing attachment references — otherwise an un-awaited write would have
// time to land on its own and the race would go unnoticed.
const COUNTER_LAG_MS = 400;

// `import()` and `overrideDuplicates()` report progress by calling the job
// manager's `success()`/`failure()`, which are async: each one is a database
// write. Those calls were made without `await`, so both methods could resolve
// with counter writes still in flight. Whoever read the job next — the admin UI
// polling progress, or a test asserting on `good`/`bad` — saw whatever had
// landed so far, which is why the counters were occasionally short by one on a
// loaded CI runner and never wrong locally.
//
// Rather than hope for the race, every counter write is stubbed to land late.
// That turns the timing bug into a deterministic pass/fail: the counters read
// the instant the import resolves must already match the counters read once
// everything has settled.
describe('import job counters', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let attachmentPath;
  let exportsPath;
  let tempPath;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig()
    });

    tempPath = path.join(apos.rootDir, 'data/temp/uploadfs');
    attachmentPath = path.join(apos.rootDir, 'public/uploads/attachments');
    exportsPath = path.join(apos.rootDir, 'public/uploads/exports');
    importExportManager = apos.modules['@apostrophecms/import-export'];

    await insertAdminUser(apos);
  });

  after(async function() {
    await t.destroy(apos);
    apos = null;
  });

  beforeEach(async function() {
    await insertPiecesAndPages(apos);
  });

  afterEach(async function() {
    await deletePiecesAndPages(apos);
    await deleteAttachments(apos, attachmentPath);
    await cleanData([ tempPath, exportsPath ]);
  });

  it('are fully written by the time an import without duplicates resolves', async function() {
    const req = apos.task.getReq();
    const importFilePath = await exportPage1(req);

    // Nothing left to collide with, so every doc and the attachment are
    // inserted and reported through `reporting.success()`.
    await deletePiecesAndPages(apos);
    await deleteAttachments(apos, attachmentPath);

    req.body = {};
    req.files = {
      file: {
        path: importFilePath,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };

    const { jobId } = await withLaggingCounters(apos, COUNTER_LAG_MS, () => {
      return importExportManager.import(req);
    });

    await assertCountersSettled(apos, jobId);
  });

  it('are fully written by the time overrideDuplicates resolves', async function() {
    const req = apos.task.getReq();
    const importFilePath = await exportPage1(req);

    req.body = {};
    req.files = {
      file: {
        path: importFilePath,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };

    // Everything the archive holds is already on the site, so the import stops
    // to ask about duplicates and reports nothing; the counters are all
    // incremented by `overrideDuplicates` below.
    const {
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    } = await importExportManager.import(req);

    assert.ok(duplicatedDocs.length, 'the fixture should produce duplicates');

    delete req.files;
    req.body = {
      docIds: duplicatedDocs.map(({ aposDocId }) => aposDocId),
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    };

    await withLaggingCounters(apos, COUNTER_LAG_MS, () => {
      return importExportManager.overrideDuplicates(req);
    });

    await assertCountersSettled(apos, jobId);
  });

  // Exports page1 and its related docs, then hands back a copy in the temp
  // directory ready to be fed to `import()` — the same round trip the suite's
  // other import tests make.
  async function exportPage1(req) {
    const page1 = await apos.page.find(req, { title: 'page1' }).toObject();

    req.body = {
      _ids: [ page1._id ],
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'article' ],
      type: page1.type
    };

    const { url } = await importExportManager.export(req, apos.page);
    const fileName = path.basename(url);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(path.join(exportsPath, fileName), importFilePath);

    return importFilePath;
  }
});

// Reads the counters straight away, then again once anything still in flight
// has had several lag periods to land. They must agree: if they do not, the
// import resolved while it was still reporting its own progress.
async function assertCountersSettled(apos, jobId) {
  const immediate = await readCounters(apos, jobId);
  await delay(COUNTER_LAG_MS * 5);
  const settled = await readCounters(apos, jobId);

  // Guards against passing for the wrong reason: two identical readings prove
  // nothing if no work was ever reported.
  assert.ok(settled.good + settled.bad > 0, 'the job should have reported work');
  assert.deepEqual(immediate, settled);
}

async function readCounters(apos, jobId) {
  const {
    good, bad, processed, total
  } = await apos.modules['@apostrophecms/job'].db.findOne({ _id: jobId });

  return {
    good,
    bad,
    processed,
    total
  };
}

// Delays every counter write ($inc) on the job collection. Other writes to the
// same collection — `setTotal`, `end`, the failed log — are left alone so only
// the behaviour under test is slowed down.
async function withLaggingCounters(apos, delayMs, fn) {
  const { db } = apos.modules['@apostrophecms/job'];
  const hadOwn = Object.prototype.hasOwnProperty.call(db, 'updateOne');
  const original = db.updateOne.bind(db);

  db.updateOne = async (criteria, update, ...rest) => {
    if (update && update.$inc) {
      await delay(delayMs);
    }
    return original(criteria, update, ...rest);
  };

  try {
    return await fn();
  } finally {
    if (hadOwn) {
      db.updateOne = original;
    } else {
      delete db.updateOne;
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
