const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const { output: gzip } = require('../lib/formats/gzip.js');
const {
  getAppConfig, insertAdminUser, cleanData
} = require('./util/index.js');

// A handler publishing selected drafts of a type that is not autopublished,
// the way a project may publish some documents on their own.
function forcePublishHandlers(self) {
  return {
    afterSave: {
      autopublish(_super, req, doc, options) {
        if (
          self.options.localized &&
          !self.options.autopublish &&
          doc.aposLocale.includes(':draft') &&
          doc.forcePublish === true
        ) {
          return self.publish(req, doc, {
            ...options,
            autopublishing: true
          });
        }
        return _super(req, doc, options);
      }
    }
  };
}

const forcePublishField = {
  forcePublish: {
    type: 'boolean',
    def: false
  }
};

describe('#import - documents published by the draft insert', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let jobManager;
  let tempPath;
  let exportsPath;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig({
        '@apostrophecms/page': {
          options: {
            park: [],
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'force-published-page',
                label: 'Force Published Page'
              }
            ]
          }
        },
        'force-published-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'forcePublishedPiece',
            autopublish: false
          },
          fields: {
            add: forcePublishField
          },
          extendHandlers: forcePublishHandlers
        },
        'force-published-page': {
          extend: '@apostrophecms/page-type',
          options: {
            autopublish: false
          },
          fields: {
            add: forcePublishField
          },
          extendHandlers: forcePublishHandlers
        }
      })
    });

    tempPath = path.join(apos.rootDir, 'data/temp/uploadfs');
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
      type: { $in: [ 'force-published-piece', 'force-published-page', 'article' ] }
    });
  });

  // Export the given ids (both modes) to a file the import can consume.
  async function exportToTemp(manager, ids) {
    const req = apos.task.getReq({
      mode: 'draft',
      body: {
        _ids: ids,
        type: 'test'
      }
    });
    const { url } = await importExportManager.export(req, manager);
    const fileName = path.basename(url);
    const importFilePath = path.join(tempPath, fileName);
    await fs.mkdir(tempPath, { recursive: true });
    await fs.copyFile(path.join(exportsPath, fileName), importFilePath);
    return importFilePath;
  }

  // Run an import while recording every logged error and every low-level
  // write and lookup on the docs collection.
  async function importWithSpies(importFilePath, body = {}) {
    const errors = [];
    const insertOneIds = [];
    const findOneIds = [];
    const origError = apos.util.error;
    const origInsertOne = apos.doc.db.insertOne;
    const origFindOne = apos.doc.db.findOne;
    apos.util.error = (error) => errors.push(error);
    apos.doc.db.insertOne = function(doc, ...rest) {
      insertOneIds.push(doc._id);
      return origInsertOne.call(this, doc, ...rest);
    };
    apos.doc.db.findOne = function(criteria, ...rest) {
      findOneIds.push(criteria?._id);
      return origFindOne.call(this, criteria, ...rest);
    };

    const req = apos.task.getReq({
      locale: 'en',
      body,
      files: {
        file: {
          path: importFilePath,
          type: importExportManager.formats.gzip.allowedTypes[0]
        }
      }
    });

    try {
      const result = await importExportManager.import(req);
      return {
        req,
        result,
        errors,
        insertOneIds,
        findOneIds
      };
    } finally {
      apos.util.error = origError;
      apos.doc.db.insertOne = origInsertOne;
      apos.doc.db.findOne = origFindOne;
    }
  }

  async function assertRoundTrip({
    type, ids, errors, insertOneIds, jobId, title
  }) {
    const job = await jobManager.db.findOne({ _id: jobId });
    const docs = await apos.doc.db
      .find({ type })
      .sort({ _id: 1 })
      .toArray();

    assert.deepEqual(errors, [], 'no error should be logged');
    assert.equal(job.bad, 0);
    assert.equal(job.good, 2);
    assert.deepEqual(
      insertOneIds.filter(id => id === ids.published),
      [ ids.published ],
      'the published doc should be inserted exactly once'
    );
    assert.deepEqual(
      docs.map(doc => doc._id),
      [ ids.draft, ids.published ]
    );
    for (const doc of docs) {
      assert.equal(doc.title, title);
      assert.ok(doc.importedAt instanceof Date, `${doc._id} should be stamped`);
    }
  }

  it('should import a piece the draft insert published', async function() {
    const req = apos.task.getReq({ mode: 'draft' });
    const draft = await apos.forcePublishedPiece.insert(req, {
      ...apos.forcePublishedPiece.newInstance(),
      title: 'force published piece',
      forcePublish: true
    });
    const ids = {
      draft: draft._id,
      published: `${draft.aposDocId}:en:published`
    };

    const importFilePath = await exportToTemp(apos.forcePublishedPiece, [ draft._id ]);
    await apos.doc.db.deleteMany({ type: 'force-published-piece' });

    const {
      result, errors, insertOneIds
    } = await importWithSpies(importFilePath);

    await assertRoundTrip({
      type: 'force-published-piece',
      ids,
      errors,
      insertOneIds,
      jobId: result.jobId,
      title: 'force published piece'
    });
  });

  it('should import a page the draft insert published', async function() {
    const req = apos.task.getReq({ mode: 'draft' });
    const draft = await apos.page.insert(req, '_home', 'lastChild', {
      title: 'force published page',
      type: 'force-published-page',
      slug: '/force-published-page',
      forcePublish: true
    });
    const ids = {
      draft: draft._id,
      published: `${draft.aposDocId}:en:published`
    };

    const importFilePath = await exportToTemp(apos.page, [ draft._id ]);
    await apos.doc.db.deleteMany({ type: 'force-published-page' });

    const {
      result, errors, insertOneIds
    } = await importWithSpies(importFilePath);

    await assertRoundTrip({
      type: 'force-published-page',
      ids,
      errors,
      insertOneIds,
      jobId: result.jobId,
      title: 'force published page'
    });
  });

  it('should still apply the published doc from the file when overriding duplicates', async function() {
    const req = apos.task.getReq({ mode: 'draft' });
    const draft = await apos.forcePublishedPiece.insert(req, {
      ...apos.forcePublishedPiece.newInstance(),
      title: 'force published piece',
      forcePublish: true
    });
    const publishedId = `${draft.aposDocId}:en:published`;

    // Same docs as on the site, with a change made only to the published one.
    const docs = await apos.doc.db
      .find({ type: 'force-published-piece' })
      .sort({ _id: 1 })
      .toArray();
    const published = docs.find(doc => doc._id === publishedId);
    published.title = 'force published piece EDITED';
    const importFilePath = path.join(tempPath, 'force-published-override.tar.gz');
    await fs.mkdir(tempPath, { recursive: true });
    await gzip(importFilePath, { docs }, async () => {});

    const {
      req: importReq, result, errors
    } = await importWithSpies(importFilePath, { formatLabel: 'gzip' });
    assert.deepEqual(errors, []);
    assert.equal(result.duplicatedDocs.length, 1);

    const origError = apos.util.error;
    const overrideErrors = [];
    apos.util.error = (error) => overrideErrors.push(error);
    try {
      await importExportManager.overrideDuplicates(importReq.clone({
        body: {
          ...importReq.body,
          docIds: result.duplicatedDocs.map(({ aposDocId }) => aposDocId),
          duplicatedDocs: result.duplicatedDocs,
          importedAttachments: result.importedAttachments,
          exportId: result.exportId,
          jobId: result.jobId,
          notificationId: result.notificationId,
          formatLabel: result.formatLabel
        }
      }));
    } finally {
      apos.util.error = origError;
    }

    const job = await jobManager.db.findOne({ _id: result.jobId });
    // Re-publishing the existing doc also writes a `:previous` copy.
    const after = await apos.doc.db
      .find({
        type: 'force-published-piece',
        aposMode: { $in: [ 'draft', 'published' ] }
      })
      .sort({ _id: 1 })
      .toArray();

    assert.deepEqual(overrideErrors, []);
    assert.equal(job.bad, 0);
    assert.deepEqual(
      after.map(({ _id, title }) => ({
        _id,
        title
      })),
      [
        {
          _id: draft._id,
          title: 'force published piece'
        },
        {
          _id: publishedId,
          title: 'force published piece EDITED'
        }
      ]
    );
  });

  it('should not look up the published doc of an autopublished type', async function() {
    const req = apos.task.getReq({ mode: 'draft' });
    const draft = await apos.article.insert(req, {
      ...apos.article.newInstance(),
      title: 'autopublished article'
    });
    const ids = {
      draft: draft._id,
      published: `${draft.aposDocId}:en:published`
    };

    const importFilePath = await exportToTemp(apos.article, [ draft._id ]);
    await apos.doc.db.deleteMany({ type: 'article' });

    const {
      result, errors, insertOneIds, findOneIds
    } = await importWithSpies(importFilePath);

    await assertRoundTrip({
      type: 'article',
      ids,
      errors,
      insertOneIds,
      jobId: result.jobId,
      title: 'autopublished article'
    });
    assert.deepEqual(
      findOneIds.filter(id => id === ids.published),
      [],
      'the published doc should not be looked up for an autopublished type'
    );
  });
});
