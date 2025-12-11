const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const {
  getAppConfig,
  insertAdminUser,
  insertPiecesAndPages,
  deletePiecesAndPages,
  deleteAttachments,
  cleanData,
  buildFixtures,
  copyFixtures,
  cleanFixtures,
  getExtractedFiles,
  extractFileNames
} = require('./util/index.js');

describe('@apostrophecms/import-export', function() {
  let apos;
  let importExportManager;
  let tempPath;
  let attachmentPath;
  let exportsPath;
  let piecesTgzPath;
  let pageTgzPath;

  this.timeout(60000);

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: {
        ...getAppConfig(),
        '@apostrophecms/import-export': {
          options: {
            importExport: {
              export: {
                expiration: 10 * 1000
              }
            }
          }
        }
      }
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

  it('should generate a zip file for pieces without related documents but with attachments', async function () {
    const req = apos.task.getReq();
    const articles = await apos.article.find(req).toArray();
    const manager = apos.article;

    req.body = {
      _ids: articles.map(({ _id }) => _id),
      extension: 'gzip',
      type: req.t(manager.options.pluralLabel)
    };
    const { url } = await importExportManager.export(req, manager);
    const fileName = path.basename(url);

    const { exportPath } = await importExportManager.formats.gzip.input(
      path.join(exportsPath, fileName)
    );

    const {
      docs, attachments, attachmentFiles
    } = await getExtractedFiles(exportPath);

    const actual = {
      docsLength: docs.length,
      attachmentsLength: attachments.length,
      attachmentFiles
    };
    const expected = {
      docsLength: 4,
      attachmentsLength: 1,
      attachmentFiles: [
        `${attachments[0]._id}-test-image.jpg`
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should generate a zip file for pieces with related documents', async function () {
    const req = apos.task.getReq();
    const articles = await apos.article.find(req).toArray();
    const { _id: attachmentId } = await apos.attachment.db.findOne({ name: 'test-image' });
    const manager = apos.article;

    req.body = {
      _ids: articles.map(({ _id }) => _id),
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'topic' ],
      type: req.t(manager.options.pluralLabel)
    };

    const { url } = await importExportManager.export(req, manager);
    const fileName = path.basename(url);

    piecesTgzPath = path.join(exportsPath, fileName);
    const { exportPath } = await importExportManager.formats.gzip.input(piecesTgzPath);

    const {
      docs, attachments, attachmentFiles
    } = await getExtractedFiles(exportPath);

    const docsNames = docs.map(({ title, aposMode }) => ({
      title,
      aposMode
    }));

    const topicsContainNonProjectedFields = docs
      .filter(({ type }) => type === 'topic')
      .every(({
        createdAt, titleSortified, aposLocale
      }) => createdAt && titleSortified && aposLocale);

    const actual = {
      docsNames,
      attachmentsLength: attachments.length,
      attachmentFiles,
      topicsContainNonProjectedFields
    };

    const expected = {
      docsNames: [
        {
          title: 'article2',
          aposMode: 'draft'
        },
        {
          title: 'article1',
          aposMode: 'draft'
        },
        {
          title: 'topic1',
          aposMode: 'draft'
        },
        {
          title: 'topic3',
          aposMode: 'draft'
        },
        {
          title: 'topic2',
          aposMode: 'draft'
        },
        {
          title: 'article2',
          aposMode: 'published'
        },
        {
          title: 'article1',
          aposMode: 'published'
        },
        {
          title: 'topic3',
          aposMode: 'published'
        },
        {
          title: 'topic1',
          aposMode: 'published'
        },
        {
          title: 'topic2',
          aposMode: 'published'
        }
      ],
      attachmentsLength: 1,
      attachmentFiles: [ `${attachmentId}-test-image.jpg` ],
      topicsContainNonProjectedFields: true
    };

    assert.deepEqual(actual, expected);
  });

  it('should generate a zip file for pieces with related documents in all modes', async function () {
    const req = apos.task.getReq();
    const { _id: attachmentId } = await apos.attachment.db.findOne({ name: 'test-image' });
    const manager = apos.article;

    // PREPARE
    // update an article draft removing the topic relation
    await apos.doc.db.updateOne(
      {
        title: 'article1',
        aposMode: 'draft'
      },
      { $set: { topicsIds: [] } }
    );
    const articles1 = await manager.find(req, {
      title: 'article1',
      aposMode: { $in: [ 'draft', 'published' ] }
    }).locale(null).toArray();
    {
      const draft = articles1.find(({ aposMode }) => aposMode === 'draft');
      const published = articles1.find(({ aposMode }) => aposMode === 'published');
      assert.deepEqual(draft._topics, []);
      assert.equal(published._topics.length, 1);
    }
    // remove all other relations
    await apos.doc.db.updateMany(
      {
        title: 'article2'
      },
      { $set: { topicsIds: [] } }
    );
    const article2 = await manager.find(req.clone({ mode: 'draft' }), {
      title: 'article2',
      aposMode: { $in: [ 'draft', 'published' ] }
    }).locale(null).toArray();
    {
      const draft = article2.find(({ aposMode }) => aposMode === 'draft');
      const published = article2.find(({ aposMode }) => aposMode === 'published');
      assert.deepEqual(draft._topics, []);
      assert.deepEqual(published._topics, []);
    }

    // TEST
    const articles = await apos.article.find(req).toArray();

    req.body = {
      _ids: articles.map(({ _id }) => _id),
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'topic' ],
      type: req.t(manager.options.pluralLabel)
    };

    const { url } = await importExportManager.export(req, manager);
    const fileName = path.basename(url);

    piecesTgzPath = path.join(exportsPath, fileName);
    const { exportPath } = await importExportManager.formats.gzip.input(piecesTgzPath);

    const {
      docs, attachments, attachmentFiles
    } = await getExtractedFiles(exportPath);

    const docsNames = docs.map(({ title, aposMode }) => ({
      title,
      aposMode
    }));

    const topicsContainNonProjectedFields = docs
      .filter(({ type }) => type === 'topic')
      .every(({
        createdAt, titleSortified, aposLocale
      }) => createdAt && titleSortified && aposLocale);

    const actual = {
      docsNames,
      attachmentsLength: attachments.length,
      attachmentFiles,
      topicsContainNonProjectedFields
    };

    const expected = {
      docsNames: [
        {
          title: 'article2',
          aposMode: 'draft'
        },
        {
          title: 'article1',
          aposMode: 'draft'
        },
        {
          title: 'topic2',
          aposMode: 'draft'
        },
        {
          title: 'article2',
          aposMode: 'published'
        },
        {
          title: 'article1',
          aposMode: 'published'
        },
        {
          title: 'topic2',
          aposMode: 'published'
        }
      ],
      attachmentsLength: 1,
      attachmentFiles: [ `${attachmentId}-test-image.jpg` ],
      topicsContainNonProjectedFields: true
    };

    assert.deepEqual(actual, expected);
  });

  it('should generate a zip file for pages with related documents', async function () {
    const req = apos.task.getReq();
    const page1 = await apos.page.find(req, { title: 'page1' }).toObject();
    const { _id: attachmentId } = await apos.attachment.db.findOne({ name: 'test-image' });

    req.body = {
      _ids: [ page1._id ],
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'article' ],
      type: page1.type
    };

    const { url } = await importExportManager.export(req, apos.page);
    const fileName = path.basename(url);

    pageTgzPath = path.join(exportsPath, fileName);
    const { exportPath } = await importExportManager.formats.gzip.input(pageTgzPath);

    const {
      docs, attachments, attachmentFiles
    } = await getExtractedFiles(exportPath);

    const actual = {
      docsNames: docs.map(({ title, aposMode }) => ({
        title,
        aposMode
      })),
      attachmentsLength: attachments.length,
      attachmentFiles
    };

    const expected = {
      docsNames: [
        {
          title: 'page1',
          aposMode: 'draft'
        },
        {
          title: 'image1',
          aposMode: 'draft'
        },
        {
          title: 'article2',
          aposMode: 'draft'
        },
        {
          title: 'page1',
          aposMode: 'published'
        },
        {
          title: 'image1',
          aposMode: 'published'
        },
        {
          title: 'article2',
          aposMode: 'published'
        }
      ],
      attachmentsLength: 1,
      attachmentFiles: [ `${attachmentId}-test-image.jpg` ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should import pieces with related documents from a compressed file', async function() {
    const req = apos.task.getReq();
    const articles = await apos.article.find(req).toArray();
    const manager = apos.article;

    req.body = {
      _ids: articles.map(({ _id }) => _id),
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'topic' ],
      type: req.t(manager.options.pluralLabel)
    };

    const { url } = await importExportManager.export(req, manager);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    await deletePiecesAndPages(apos);
    await deleteAttachments(apos, attachmentPath);

    req.body = {};
    req.files = {
      file: {
        path: importFilePath,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };
    await importExportManager.import(req);

    const importedDocs = await apos.doc.db
      .find({ type: /article|topic|@apostrophecms\/image/ })
      .toArray();

    const importedAttachments = await apos.attachment.db
      .find()
      .toArray();

    const articlesWithRelatedImages = importedDocs
      .filter(({ title }) => title === 'article1')
      .map(({ image }) => ({
        title: image?.title,
        name: image?.name,
        type: image?.type
      }));

    const attachmentFiles = await fs.readdir(attachmentPath);

    const actual = {
      articlesWithRelatedImages,
      docsLength: importedDocs.length,
      docsTitles: importedDocs.map(({ title }) => title),
      attachmentsNames: importedAttachments.map(({ name }) => name),
      attachmentFileNames: attachmentFiles.map((fullName) => {
        const regex = /-([\w\d-]+)\./;
        const [ , name ] = regex.exec(fullName);
        return name;
      })
    };

    const expected = {
      articlesWithRelatedImages: [
        {
          title: 'test image',
          name: 'test-image',
          type: 'attachment'
        },
        {
          title: 'test image',
          name: 'test-image',
          type: 'attachment'
        } ],
      docsLength: 10,
      docsTitles: [
        'article2', 'article1',
        'article2', 'article1',
        'topic1', 'topic3', 'topic2',
        'topic3', 'topic1', 'topic2'
      ],
      attachmentsNames: [ 'test-image' ],
      attachmentFileNames: new Array(apos.attachment.imageSizes.length + 1)
        .fill('test-image')
    };

    assert.deepEqual(actual, expected);
  });

  it('should return duplicates pieces when already existing and override them', async function() {
    const req = apos.task.getReq();
    const articles = await apos.article.find(req).toArray();
    const manager = apos.article;

    req.body = {
      _ids: articles.map(({ _id }) => _id),
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'topic' ],
      type: req.t(manager.options.pluralLabel)
    };

    const { url } = await importExportManager.export(req, manager);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    req.body = {};
    req.files = {
      file: {
        path: importFilePath,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };

    const {
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    } = await importExportManager.import(req);

    // We update the title of every targetted docs to be sure the update really occurs
    await apos.doc.db.updateMany({ type: /article|topic/ }, { $set: { title: 'new title' } });
    await apos.attachment.db.updateMany({}, { $set: { name: 'new-name' } });
    const filesNames = await fs.readdir(attachmentPath);

    // We rename all versions of the image to be sure the file is also updated
    for (const fileName of filesNames) {
      await fs.rename(
        path.join(attachmentPath, fileName),
        path.join(attachmentPath, fileName.replace('test-image', 'new-name'))
      );
    }

    delete req.files;

    // Overrides all docs excepted topic3
    const docIds = duplicatedDocs
      .filter((doc) => doc.title !== 'topic3')
      .map(({ aposDocId }) => aposDocId);
    req.body = {
      docIds,
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    };

    await importExportManager.overrideDuplicates(req);

    const updatedDocs = await apos.doc.db
      .find({
        type: /article|topic|@apostrophecms\/image/,
        aposMode: { $ne: 'previous' }
      })
      .toArray();
    const updatedAttachments = await apos.attachment.db.find().toArray();
    const attachmentFiles = await fs.readdir(attachmentPath);
    const job = await apos.modules['@apostrophecms/job'].db.findOne({ _id: jobId });

    const actual = {
      docTitles: updatedDocs.map(({ title }) => title),
      attachmentNames: updatedAttachments.map(({ name }) => name),
      attachmentFileNames: extractFileNames(attachmentFiles),
      job: {
        good: job.good,
        total: job.total
      }
    };

    const expected = {
      docTitles: [
        'image1',
        'image1',
        'article1',
        'article2',
        'article1',
        'article2',
        'new title',
        'topic2',
        'topic1',
        'new title',
        'topic2',
        'topic1'
      ],
      attachmentNames: [ 'new-name' ],
      attachmentFileNames: new Array(apos.attachment.imageSizes.length + 1)
        .fill('new-name'),
      job: {
        good: 9,
        total: 11
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should import page and related documents', async function() {
    const req = apos.task.getReq();
    const page1 = await apos.page.find(req, { title: 'page1' }).toObject();

    req.body = {
      _ids: [ page1._id ],
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'article' ],
      type: page1.type
    };

    const { url } = await importExportManager.export(req, apos.page);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    await deletePiecesAndPages(apos);
    await deleteAttachments(apos, attachmentPath);

    req.body = {};
    req.files = {
      file: {
        path: importFilePath,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };

    await importExportManager.import(req);

    const importedDocs = await apos.doc.db
      .find({ type: /default-page|article|topic|@apostrophecms\/image/ })
      .toArray();
    const importedAttachments = await apos.attachment.db.find(
      { aposMode: { $ne: 'previous' } }
    ).toArray();
    const attachmentFiles = await fs.readdir(attachmentPath);

    const actual = {
      docTitles: importedDocs.map(({ title }) => title),
      attachmentNames: importedAttachments.map(({ name }) => name),
      attachmentFileNames: extractFileNames(attachmentFiles)
    };

    const expected = {
      docTitles: [ 'image1', 'image1', 'article2', 'article2', 'page1', 'page1' ],
      attachmentNames: [ 'test-image' ],
      attachmentFileNames: new Array(apos.attachment.imageSizes.length + 1)
        .fill('test-image')
    };

    assert.deepEqual(actual, expected);
  });

  it('should return existing duplicated docs during page import and override them', async function() {
    const req = apos.task.getReq();
    const page1 = await apos.page.find(req, { title: 'page1' }).toObject();

    req.body = {
      _ids: [ page1._id ],
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'article' ],
      type: page1.type
    };

    const { url } = await importExportManager.export(req, apos.page);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    req.body = {};
    req.files = {
      file: {
        path: importFilePath,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };

    const {
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    } = await importExportManager.import(req);

    // We update the title of every targetted docs to be sure the update really occurs
    await apos.doc.db.updateMany(
      { type: /default-page|article|@apostrophecms\/image/ },
      { $set: { title: 'new title' } }
    );
    await apos.attachment.db.updateMany({}, { $set: { name: 'new-name' } });
    const filesNames = await fs.readdir(attachmentPath);

    // We rename all versions of the image to be sure the file is also updated
    for (const fileName of filesNames) {
      await fs.rename(
        path.join(attachmentPath, fileName),
        path.join(attachmentPath, fileName.replace('test-image', 'new-name'))
      );
    }

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

    await importExportManager.overrideDuplicates(req);

    const updatedDocs = await apos.doc.db
      .find({
        type: /default-page|article|@apostrophecms\/image/,
        aposMode: { $ne: 'previous' }
      })
      .toArray();
    const updatedAttachments = await apos.attachment.db.find().toArray();
    const attachmentFiles = await fs.readdir(attachmentPath);
    const job = await apos.modules['@apostrophecms/job'].db.findOne({ _id: jobId });

    const actual = {
      docTitles: updatedDocs.map(({ title }) => title),
      attachmentNames: updatedAttachments.map(({ name }) => name),
      attachmentFileNames: extractFileNames(attachmentFiles),
      job: {
        good: job.good,
        total: job.total
      }
    };

    const expected = {
      docTitles: [
        'image1',
        'image1',
        'new title',
        'article2',
        'new title',
        'article2',
        'page1',
        'page1'
      ],
      attachmentNames: [ 'new-name' ],
      attachmentFileNames: new Array(apos.attachment.imageSizes.length + 1)
        .fill('new-name'),
      job: {
        good: 7,
        total: 7
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should not override attachment if associated document is not imported', async function() {
    const req = apos.task.getReq();
    const page1 = await apos.page.find(req, { title: 'page1' }).toObject();

    req.body = {
      _ids: [ page1._id ],
      extension: 'gzip',
      relatedTypes: [ '@apostrophecms/image', 'article' ],
      type: page1.type
    };

    const { url } = await importExportManager.export(req, apos.page);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    req.body = {};
    req.files = {
      file: {
        path: importFilePath,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };

    const {
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    } = await importExportManager.import(req);

    // We update the title of every targetted docs to be sure the update really occurs
    await apos.doc.db.updateMany(
      { type: /default-page|article|@apostrophecms\/image/ },
      { $set: { title: 'new title' } }
    );
    await apos.attachment.db.updateMany({}, { $set: { name: 'new-name' } });
    const filesNames = await fs.readdir(attachmentPath);

    // We rename all versions of the image to be sure the file is also updated
    for (const fileName of filesNames) {
      await fs.rename(
        path.join(attachmentPath, fileName),
        path.join(attachmentPath, fileName.replace('test-image', 'new-name'))
      );
    }

    delete req.files;
    req.body = {
      docIds: duplicatedDocs
        .filter(({ type }) => type !== '@apostrophecms/image')
        .map(({ aposDocId }) => aposDocId),
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    };

    await importExportManager.overrideDuplicates(req);

    const docs = await apos.doc.db
      .find({
        type: /default-page|article|@apostrophecms\/image/,
        aposMode: { $ne: 'previous' }
      })
      .toArray();
    const updatedAttachments = await apos.attachment.db.find().toArray();
    const attachmentFiles = await fs.readdir(attachmentPath);
    const job = await apos.modules['@apostrophecms/job'].db.findOne({ _id: jobId });

    const actual = {
      docTitles: docs.map(({ title }) => title),
      attachmentNames: updatedAttachments.map(({ name }) => name),
      attachmentFileNames: extractFileNames(attachmentFiles),
      job: {
        good: job.good,
        bad: job.bad,
        total: job.total
      }
    };

    const expected = {
      docTitles: [
        'new title',
        'new title',
        'new title',
        'article2',
        'new title',
        'article2',
        'page1',
        'page1'
      ],
      attachmentNames: [ 'new-name' ],
      attachmentFileNames: new Array(apos.attachment.imageSizes.length + 1)
        .fill('new-name'),
      job: {
        good: 4,
        bad: 0,
        total: 7
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should preserve lastPublishedAt property on import for existing drafts', async function() {
    const req = apos.task.getReq();
    const manager = apos.doc.getManager('default-page');
    const pageInstance = manager.newInstance();

    // PUBLISH a new page
    await apos.page.insert(req, '_home', 'lastChild', {
      ...pageInstance,
      title: 'page2',
      type: 'default-page',
      _articles: [],
      main: {
        _id: 'areaId',
        items: [],
        metaType: 'area'
      }
    });

    const page2 = await apos.page.find(req, { title: 'page2' }).toObject();

    // UNPUBLISH (draft) the page
    const draftPage = await apos.page.unpublish(req, page2);

    // EXPORT the page (as draft)
    req.body = {
      _ids: [ draftPage._id ],
      extension: 'gzip',
      type: draftPage.type
    };

    const { url } = await importExportManager.export(req, apos.page);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    // Now that it's exported as draft, PUBLISH the page again
    const { lastPublishedAt } = await apos.page.publish(req, draftPage);

    // Finally, IMPORT the previously exported draft page
    req.body = {};
    req.files = {
      file: {
        path: importFilePath,
        type: importExportManager.formats.gzip.allowedTypes[0]
      }
    };

    const {
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    } = await importExportManager.import(req);

    req.body = {
      docIds: duplicatedDocs.map(doc => doc.aposDocId),
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    };

    await importExportManager.overrideDuplicates(req);

    const updatedPage = await apos.doc.db
      .find({ title: 'page2' })
      .toArray();

    assert.deepEqual(updatedPage.every((doc) => {
      return String(doc.lastPublishedAt) === String(lastPublishedAt);
    }), true, `expected imported docs 'lastPublishedAt' value to be of '${lastPublishedAt}'`);
  });

  it('should get related types of a given doc type', function() {
    const req = apos.task.getReq();

    const start = performance.now();
    const relatedTypesArticles = importExportManager
      .getRelatedTypes(req, apos.article.schema);
    const relatedTypesTopics = importExportManager
      .getRelatedTypes(req, apos.topic.schema);
    const duration = performance.now() - start;

    const actual = {
      relatedTypesArticles: relatedTypesArticles.sort(),
      relatedTypesTopics: relatedTypesTopics.sort()
    };
    const expected = {
      // All page types are in play because rich text internal page links are in play.
      // Articles are in play because a page type has a relationship to them, so:
      // see above (remember this is quite recursive)
      relatedTypesArticles: [
        '@apostrophecms/home-page',
        '@apostrophecms/image',
        '@apostrophecms/image-tag',
        'article',
        'default-page',
        'home-page',
        'topic'
      ],
      relatedTypesTopics: [
        '@apostrophecms/home-page',
        '@apostrophecms/image',
        '@apostrophecms/image-tag',
        'article',
        'default-page',
        'home-page',
        'topic'
      ]
    };

    assert(duration < 1000);
    assert.deepEqual(actual, expected);
  });

  describe('#getFirstDifferentLocale', function () {
    it('should find among the docs the first locale that is different from the req one', async function() {
      const req = {
        locale: 'fr-CA',
        mode: 'draft'
      };
      const docs = [
        {
          _id: '1:daft',
          aposMode: 'draft'
        },
        {
          _id: '2:fr:published',
          aposLocale: 'fr:published',
          aposMode: 'published'
        },
        {
          _id: '3:fr-CA:published',
          aposLocale: 'fr-CA:published',
          aposMode: 'published'
        },
        {
          _id: '4:en:draft',
          aposLocale: 'en:draft',
          aposMode: 'draft'
        }
      ];

      const actual = apos.modules['@apostrophecms/import-export'].getFirstDifferentLocale(req, docs);
      const expected = 'fr';

      assert.equal(actual, expected);
    });
  });

  describe('#rewriteDocsWithCurrentLocale', function() {
    it('should rewrite the docs locale with the req one', async function() {
      const req = {
        locale: 'fr-CA',
        mode: 'draft'
      };
      const docs = [
        {
          _id: '1:daft',
          aposMode: 'draft'
        },
        {
          _id: '2:fr:published',
          aposLocale: 'fr:published',
          aposMode: 'published'
        },
        {
          _id: '3:fr-CA:published',
          aposLocale: 'fr-CA:published',
          aposMode: 'published'
        },
        {
          _id: '4:en:draft',
          aposLocale: 'en:draft',
          aposMode: 'draft'
        }
      ];

      apos.modules['@apostrophecms/import-export'].rewriteDocsWithCurrentLocale(req, docs);

      assert.deepEqual(docs, [
        {
          _id: '1:daft',
          aposMode: 'draft'
        },
        {
          _id: '2:fr-CA:published',
          aposLocale: 'fr-CA:published',
          aposMode: 'published',
          __originalLocale: 'fr'
        },
        {
          _id: '3:fr-CA:published',
          aposLocale: 'fr-CA:published',
          aposMode: 'published'
        },
        {
          _id: '4:fr-CA:draft',
          aposLocale: 'fr-CA:draft',
          aposMode: 'draft',
          __originalLocale: 'en'
        }
      ]);
    });
  });

  describe('#import - man-made CSV file', function() {
    let notify;

    const getImportReq = (filePath) => apos.task.getReq({
      locale: 'en',
      body: {},
      files: {
        file: {
          path: filePath,
          type: importExportManager.formats.csv.allowedTypes[0]
        }
      }
    });

    this.beforeEach(async function() {
      notify = apos.notify;

      await deletePiecesAndPages(apos);
      await deleteAttachments(apos, attachmentPath);
      await cleanFixtures(apos);
      await copyFixtures(apos);
      await buildFixtures(apos);
    });

    this.afterEach(function() {
      apos.notify = notify;
    });

    it('should import a piece from a csv file that was not made from the import-export module', async function() {
      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/topic-type-title-description-main.csv')));

      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      assert.equal(topics.length, 1);
      assert.equal(topics[0].title, 'topic1');
      assert.equal(topics[0].slug, 'topic1');
      assert.equal(topics[0].aposMode, 'draft');
      assert.equal(topics[0].description, 'description1');
      assert.equal(topics[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong></p>');
    });

    it('should import a piece from a csv file with no type, as long as the module name is known', async function() {
      // type intentionally omitted
      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/topic-title-description-main.csv')), 'topic');

      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      assert.equal(topics.length, 1);
      assert.equal(topics[0].title, 'topic1');
      assert.equal(topics[0].slug, 'topic1');
      assert.equal(topics[0].aposMode, 'draft');
      assert.equal(topics[0].description, 'description1');
      assert.equal(topics[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong></p>');
    });

    it('should import a page from a csv file that was not made from the import-export module', async function() {
      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-title-main.csv')));

      const pages = await apos.doc.db
        .find({ type: 'default-page' })
        .toArray();

      assert.equal(pages.length, 1);
      assert.equal(pages[0].title, 'page1');
      assert.equal(pages[0].slug, '/page1');
      assert.equal(pages[0].aposMode, 'draft');
      assert.equal(pages[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong></p>');
    });

    it('should insert a piece as draft and published when there is an update key that does not match any existing doc', async function() {
      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/topic-type-titleKey-title-description-main.csv')));

      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      assert.equal(topics.length, 2);

      assert.equal(topics[0].title, 'topic1 - edited');
      assert.equal(topics[0].slug, 'topic1-edited');
      assert.equal(topics[0].aposMode, 'draft');
      assert.equal(topics[0].description, 'description1 - edited');
      assert.equal(topics[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');

      assert.equal(topics[1].title, 'topic1 - edited');
      assert.equal(topics[1].slug, 'topic1-edited');
      assert.equal(topics[1].aposMode, 'published');
      assert.equal(topics[1].description, 'description1 - edited');
      assert.equal(topics[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should insert a page as draft and published when there is an update key that does not match any existing doc', async function() {
      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-titleKey-title-main.csv')));

      const pages = await apos.doc.db
        .find({ type: 'default-page' })
        .toArray();

      assert.equal(pages.length, 2);

      assert.equal(pages[0].title, 'page1 - edited');
      assert.equal(pages[0].slug, '/page1-edited');
      assert.equal(pages[0].aposMode, 'draft');
      assert.equal(pages[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');

      assert.equal(pages[1].title, 'page1 - edited');
      assert.equal(pages[1].slug, '/page1-edited');
      assert.equal(pages[1].aposMode, 'published');
      assert.equal(pages[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should insert a piece as draft and published when there is an empty update key', async function() {
      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/topic-type-titleKey-title-description-main.csv')));

      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      assert.equal(topics.length, 2);

      assert.equal(topics[0].title, 'topic1 - edited');
      assert.equal(topics[0].slug, 'topic1-edited');
      assert.equal(topics[0].aposMode, 'draft');
      assert.equal(topics[0].description, 'description1 - edited');
      assert.equal(topics[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');

      assert.equal(topics[1].title, 'topic1 - edited');
      assert.equal(topics[1].slug, 'topic1-edited');
      assert.equal(topics[1].aposMode, 'published');
      assert.equal(topics[1].description, 'description1 - edited');
      assert.equal(topics[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should insert a page as draft and published when there is an empty update key', async function() {
      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-titleKey-title-main.csv')));

      const pages = await apos.doc.db
        .find({ type: 'default-page' })
        .toArray();

      assert.equal(pages.length, 2);

      assert.equal(pages[0].title, 'page1 - edited');
      assert.equal(pages[0].slug, '/page1-edited');
      assert.equal(pages[0].aposMode, 'draft');
      assert.equal(pages[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');

      assert.equal(pages[1].title, 'page1 - edited');
      assert.equal(pages[1].slug, '/page1-edited');
      assert.equal(pages[1].aposMode, 'published');
      assert.equal(pages[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should update a piece draft and published versions when there is an update key that matches an existing doc', async function() {
      const topic = await apos.topic.insert(apos.task.getReq(), {
        ...apos.topic.newInstance(),
        title: 'topic1',
        description: 'description1',
        main: '<p><em>rich</em> <strong>text</strong></p>'
      });

      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/topic-type-titleKey-title-description-main.csv')));

      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      assert.equal(topics.length, 2);

      assert.equal(topics[0].aposDocId, topic.aposDocId);
      assert.equal(topics[0].title, 'topic1 - edited');
      assert.equal(topics[0].slug, 'topic1');
      assert.equal(topics[0].aposMode, 'draft');
      assert.equal(topics[0].description, 'description1 - edited');
      assert.equal(topics[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
      assert.equal(topics[0].modified, false);

      assert.equal(topics[1].aposDocId, topic.aposDocId);
      assert.equal(topics[1].title, 'topic1 - edited');
      assert.equal(topics[1].slug, 'topic1');
      assert.equal(topics[1].aposMode, 'published');
      assert.equal(topics[1].description, 'description1 - edited');
      assert.equal(topics[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should update a page draft and published versions when there is an update key that matches an existing doc', async function() {
      const page = await apos.page.insert(apos.task.getReq(), '_home', 'lastChild', {
        ...apos.modules['default-page'].newInstance(),
        title: 'page1',
        main: '<p><em>rich</em> <strong>text</strong></p>'
      });

      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-titleKey-title-main.csv')));

      const pages = await apos.doc.db
        .find({ type: 'default-page' })
        .toArray();

      assert.equal(pages.length, 2);

      assert.equal(pages[0].aposDocId, page.aposDocId);
      assert.equal(pages[0].title, 'page1 - edited');
      assert.equal(pages[0].slug, '/page1');
      assert.equal(pages[0].aposMode, 'draft');
      assert.equal(pages[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
      assert.equal(pages[0].modified, false);

      assert.equal(pages[1].aposDocId, page.aposDocId);
      assert.equal(pages[1].title, 'page1 - edited');
      assert.equal(pages[1].slug, '/page1');
      assert.equal(pages[1].aposMode, 'published');
      assert.equal(pages[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should update a piece draft and published versions when there is an update key that only matches the existing draft doc', async function() {
      const topic = await apos.topic.insert(apos.task.getReq(), {
        ...apos.topic.newInstance(),
        title: 'topic1',
        description: 'description1',
        main: '<p><em>rich</em> <strong>text</strong></p>'
      });

      // check that the published doc is also updated, even with a different title
      await apos.doc.db.updateOne(
        {
          aposDocId: topic.aposDocId,
          aposMode: 'published'
        },
        {
          $set: {
            title: 'topic1 - published title that does not match the draft title nor the update key'
          }
        }
      );

      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/topic-type-titleKey-title-description-main.csv')));

      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      assert.equal(topics.length, 2);

      assert.equal(topics[0].aposDocId, topic.aposDocId);
      assert.equal(topics[0].title, 'topic1 - edited');
      assert.equal(topics[0].slug, 'topic1');
      assert.equal(topics[0].aposMode, 'draft');
      assert.equal(topics[0].description, 'description1 - edited');
      assert.equal(topics[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
      assert.equal(topics[0].modified, false);

      assert.equal(topics[1].aposDocId, topic.aposDocId);
      assert.equal(topics[1].title, 'topic1 - edited');
      assert.equal(topics[1].slug, 'topic1');
      assert.equal(topics[1].aposMode, 'published');
      assert.equal(topics[1].description, 'description1 - edited');
      assert.equal(topics[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should update a page draft and published versions when there is an update key that only matches the existing draft doc', async function() {
      const page = await apos.page.insert(apos.task.getReq(), '_home', 'lastChild', {
        ...apos.modules['default-page'].newInstance(),
        title: 'page1',
        main: '<p><em>rich</em> <strong>text</strong></p>'
      });

      // check that the published doc is also updated, even with a different title
      await apos.doc.db.updateOne(
        {
          aposDocId: page.aposDocId,
          aposMode: 'published'
        },
        {
          $set: {
            title: 'page1 - published title that does not match the draft title nor the update key'
          }
        }
      );

      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-titleKey-title-main.csv')));

      const pages = await apos.doc.db
        .find({ type: 'default-page' })
        .toArray();

      assert.equal(pages.length, 2);

      assert.equal(pages[0].aposDocId, page.aposDocId);
      assert.equal(pages[0].title, 'page1 - edited');
      assert.equal(pages[0].slug, '/page1');
      assert.equal(pages[0].aposMode, 'draft');
      assert.equal(pages[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
      assert.equal(pages[0].modified, false);

      assert.equal(pages[1].aposDocId, page.aposDocId);
      assert.equal(pages[1].title, 'page1 - edited');
      assert.equal(pages[1].slug, '/page1');
      assert.equal(pages[1].aposMode, 'published');
      assert.equal(pages[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should update a piece draft and published versions when there is an update key that matches only the existing published doc', async function() {
      const topic = await apos.topic.insert(apos.task.getReq(), {
        ...apos.topic.newInstance(),
        title: 'topic1',
        description: 'description1',
        main: '<p><em>rich</em> <strong>text</strong></p>'
      });

      // check that the draft doc is also updated, even with a different title
      await apos.doc.db.updateOne(
        {
          aposDocId: topic.aposDocId,
          aposMode: 'draft'
        },
        {
          $set: {
            title: 'topic1 - draft title that does not match the published title nor the update key'
          }
        }
      );

      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/topic-type-titleKey-title-description-main.csv')));

      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      assert.equal(topics.length, 2);

      assert.equal(topics[0].aposDocId, topic.aposDocId);
      assert.equal(topics[0].title, 'topic1 - edited');
      assert.equal(topics[0].slug, 'topic1');
      assert.equal(topics[0].aposMode, 'draft');
      assert.equal(topics[0].description, 'description1 - edited');
      assert.equal(topics[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
      assert.equal(topics[0].modified, false);

      assert.equal(topics[1].aposDocId, topic.aposDocId);
      assert.equal(topics[1].title, 'topic1 - edited');
      assert.equal(topics[1].slug, 'topic1');
      assert.equal(topics[1].aposMode, 'published');
      assert.equal(topics[1].description, 'description1 - edited');
      assert.equal(topics[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should update a page draft and published versions when there is an update key that only matches the existing published doc', async function() {
      const page = await apos.page.insert(apos.task.getReq(), '_home', 'lastChild', {
        ...apos.modules['default-page'].newInstance(),
        title: 'page1',
        main: '<p><em>rich</em> <strong>text</strong></p>'
      });

      // check that the draft doc is also updated, even with a different title
      await apos.doc.db.updateOne(
        {
          aposDocId: page.aposDocId,
          aposMode: 'draft'
        },
        {
          $set: {
            title: 'page1 - draft title that does not match the published title nor the update key'
          }
        }
      );

      await importExportManager.import(getImportReq(path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-titleKey-title-main.csv')));

      const pages = await apos.doc.db
        .find({ type: 'default-page' })
        .toArray();

      assert.equal(pages.length, 2);

      assert.equal(pages[0].aposDocId, page.aposDocId);
      assert.equal(pages[0].title, 'page1 - edited');
      assert.equal(pages[0].slug, '/page1');
      assert.equal(pages[0].aposMode, 'draft');
      assert.equal(pages[0].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
      assert.equal(pages[0].modified, false);

      assert.equal(pages[1].aposDocId, page.aposDocId);
      assert.equal(pages[1].title, 'page1 - edited');
      assert.equal(pages[1].slug, '/page1');
      assert.equal(pages[1].aposMode, 'published');
      assert.equal(pages[1].main.items[0].content, '<p><em>rich</em> <strong>text</strong> - edited</p>');
    });

    it('should sort all exported documents', async function() {
      const docs = [
        {
          title: 'doc1',
          aposMode: 'draft'
        },

        {
          title: 'sub2',
          aposMode: 'published',
          level: 2,
          rank: 1,
          slug: '/'
        },
        {
          title: 'sub2 bis',
          aposMode: 'published',
          level: 2,
          rank: 2,
          slug: '/'
        },

        {
          title: 'sub2 bis',
          aposMode: 'draft',
          level: 2,
          rank: 2,
          slug: '/'
        },

        {
          title: 'sub2',
          aposMode: 'draft',
          level: 2,
          rank: 1,
          slug: '/'
        },
        {
          title: 'doc1',
          aposMode: 'published'
        },
        {
          title: 'sub sub1 bis',
          aposMode: 'draft',
          level: 3,
          rank: 2,
          slug: '/'
        },
        {
          title: 'doc3',
          aposMode: 'draft'
        },
        {
          title: 'sub sub1',
          aposMode: 'draft',
          level: 3,
          rank: 1,
          slug: '/'
        },
        {
          title: 'sub sub1',
          aposMode: 'published',
          level: 3,
          rank: 1,
          slug: '/'
        },
        {
          title: 'doc3',
          aposMode: 'published'
        },
        {
          title: 'sub sub1 bis',
          aposMode: 'published',
          level: 3,
          rank: 2,
          slug: '/'
        },
        {
          title: 'doc2',
          aposMode: 'published'
        },
        {
          title: 'doc2',
          aposMode: 'draft'
        },
        {
          title: 'sub1',
          aposMode: 'published',
          level: 2,
          rank: 1,
          slug: '/'
        },
        {
          title: 'parent2',
          aposMode: 'published',
          level: 1,
          rank: 2,
          slug: '/'
        },
        {
          title: 'sub1',
          aposMode: 'draft',
          level: 2,
          rank: 1,
          slug: '/'
        },
        {
          title: 'parent1',
          aposMode: 'published',
          level: 1,
          rank: 1,
          slug: '/'
        },
        {
          title: 'parent1',
          aposMode: 'draft',
          level: 1,
          rank: 1,
          slug: '/'
        },

        {
          title: 'parent2',
          aposMode: 'draft',
          level: 1,
          rank: 2,
          slug: '/'
        }
      ];
      importExportManager.sortDocs(docs);

      const actual = docs.map(({ title, aposMode }) => `${title}:${aposMode}`);
      const expected = [
        'parent1:draft', 'parent2:draft',
        'sub2:draft', 'sub1:draft',
        'sub2 bis:draft', 'sub sub1:draft',
        'sub sub1 bis:draft', 'doc1:draft',
        'doc3:draft', 'doc2:draft',
        'parent1:published', 'parent2:published',
        'sub2:published', 'sub1:published',
        'sub2 bis:published', 'sub sub1:published',
        'sub sub1 bis:published', 'doc1:published',
        'doc3:published', 'doc2:published'
      ];

      assert.deepEqual(actual, expected);
    });

  });

  describe('#import - translations', function () {
    before(async function () {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        testModule: true,
        modules: {
          ...getAppConfig({}, { autopublish: false }),
          '@apostrophecms/i18n': {
            options: {
              defaultLocale: 'en',
              locales: {
                en: { label: 'English' },
                fr: {
                  label: 'French',
                  prefix: '/fr'
                }
              }
            }
          },
          '@apostrophecms/import-export': {
            options: {
              importExport: {
                export: {
                  expiration: 10 * 1000
                }
              }
            }
          },
          '@apostrophecms-pro/automatic-translation': {
            options: {
              provider: 'deepl'
            }
          },
          '@apostrophecms-pro/automatic-translation-deepl': {
            options: {
              apiSecret: 'test'
            },
            extendMethods: (self) => ({
              async requestTranslation(_super, req, text, source, target) {
                if (text.some((t) => t.toLowerCase().includes('test error'))) {
                  throw new Error('Translate test error');
                }
                return text.map((t) => `${t}-${source}-${target}-translated`);
              }
            })
          }
        }
      });

      tempPath = path.join(apos.rootDir, 'data/temp/uploadfs');
      attachmentPath = path.join(apos.rootDir, 'public/uploads/attachments');
      exportsPath = path.join(apos.rootDir, 'public/uploads/exports');
      importExportManager = apos.modules['@apostrophecms/import-export'];

      await insertAdminUser(apos);
    });

    it('should import and translate', async function() {
      const req = apos.task.getReq();
      const articles = await apos.article.find(req).toArray();
      const manager = apos.article;

      req.body = {
        _ids: articles.map(({ _id }) => _id),
        extension: 'gzip',
        relatedTypes: [ 'topic' ],
        type: req.t(manager.options.pluralLabel)
      };

      const { url } = await importExportManager.export(req, manager);
      const fileName = path.basename(url);
      const exportFilePath = path.join(exportsPath, fileName);
      const importFilePath = path.join(tempPath, fileName);
      await fs.copyFile(exportFilePath, importFilePath);

      req.body = {
        translate: true
      };
      req.files = {
        file: {
          path: importFilePath,
          type: importExportManager.formats.gzip.allowedTypes[0]
        }
      };
      const params = await importExportManager.import(req);
      await deletePiecesAndPages(apos);
      await deleteAttachments(apos, attachmentPath);

      req.body = {
        ...params,
        duplicatedDocs: [],
        importedAttachments: [],
        overrideLocale: true,
        translate: true
      };
      req.locale = 'fr';
      await importExportManager.import(req);

      const importedDocs = await apos.doc.db
        .find({
          type: /article|topic/,
          aposLocale: {
            $in: [
              'fr:published', 'fr:draft'
            ]
          }
        })
        .toArray();

      const actual = importedDocs.map(doc => {
        return {
          title: doc.title,
          type: doc.type,
          aposLocale: doc.aposLocale,
          modified: doc.modified ?? false
        };
      });

      const expected = [
        {
          title: 'article2-en-fr-translated',
          type: 'article',
          aposLocale: 'fr:draft',
          modified: true
        },
        {
          title: 'article1-en-fr-translated',
          type: 'article',
          aposLocale: 'fr:draft',
          modified: true
        },
        {
          title: 'article2',
          type: 'article',
          aposLocale: 'fr:published',
          modified: false
        },
        {
          title: 'article1',
          type: 'article',
          aposLocale: 'fr:published',
          modified: false
        },
        {
          title: 'topic1-en-fr-translated',
          type: 'topic',
          aposLocale: 'fr:draft',
          modified: true
        },
        {
          title: 'topic3-en-fr-translated',
          type: 'topic',
          aposLocale: 'fr:draft',
          modified: true
        },
        {
          title: 'topic2-en-fr-translated',
          type: 'topic',
          aposLocale: 'fr:draft',
          modified: true
        },
        {
          title: 'topic3',
          type: 'topic',
          aposLocale: 'fr:published',
          modified: false
        },
        {
          title: 'topic1',
          type: 'topic',
          aposLocale: 'fr:published',
          modified: false
        },
        {
          title: 'topic2',
          type: 'topic',
          aposLocale: 'fr:published',
          modified: false
        }
      ];

      assert.deepEqual(actual, expected);
    });

    it('should import and translate duplicated docs', async function () {
      const req = apos.task.getReq();
      const page1 = await apos.page.find(req, { title: 'page1' }).toObject();

      req.body = {
        _ids: [ page1._id ],
        extension: 'gzip',
        relatedTypes: [ 'article' ],
        type: page1.type
      };

      const { url } = await importExportManager.export(req, apos.page);
      const fileName = path.basename(url);
      const exportFilePath = path.join(exportsPath, fileName);
      const importFilePath = path.join(tempPath, fileName);
      await fs.copyFile(exportFilePath, importFilePath);

      req.body = {
        translate: true
      };
      req.files = {
        file: {
          path: importFilePath,
          type: importExportManager.formats.gzip.allowedTypes[0]
        }
      };

      const {
        duplicatedDocs,
        importedAttachments,
        exportId,
        jobId,
        notificationId,
        formatLabel
      } = await importExportManager.import(req);

      // Copy the existing docs to the fr locale
      const frReq = req.clone({
        locale: 'fr'
      });
      for (const doc of duplicatedDocs) {
        const manager = doc.type === 'default-page' ? apos.page : apos.article;
        const orig = await manager.find(req, {
          aposDocId: doc.aposDocId
        }).toObject();
        const localized = await manager.localize(req, orig, 'fr');
        await manager.publish(frReq, localized);
      }

      delete req.files;
      req.locale = 'fr';
      req.body = {
        docIds: duplicatedDocs.map(({ aposDocId }) => aposDocId),
        duplicatedDocs,
        importedAttachments,
        exportId,
        jobId,
        notificationId,
        formatLabel,
        translate: true,
        overrideLocale: true
      };

      await importExportManager.overrideDuplicates(req);

      const updatedDocs = await apos.doc.db
        .find({
          aposDocId: { $in: duplicatedDocs.map(({ aposDocId }) => aposDocId) },
          aposMode: { $ne: 'previous' },
          aposLocale: { $in: [ 'fr:draft', 'fr:published' ] }
        })
        .sort({
          type: 1,
          aposLocale: 1
        })
        .toArray();
      const actualDocs = updatedDocs.map(doc => {
        return {
          title: doc.title,
          type: doc.type,
          aposLocale: doc.aposLocale,
          modified: doc.modified ?? false
        };
      });
      const job = await apos.modules['@apostrophecms/job'].db.findOne({ _id: jobId });

      const actual = {
        docs: actualDocs,
        job: {
          good: job.good,
          total: job.total
        }
      };

      const expected = {
        docs: [
          {
            title: 'article2-en-fr-translated',
            type: 'article',
            aposLocale: 'fr:draft',
            modified: true
          },
          {
            title: 'article2',
            type: 'article',
            aposLocale: 'fr:published',
            modified: false
          },
          {
            title: 'page1-en-fr-translated',
            type: 'default-page',
            aposLocale: 'fr:draft',
            modified: true
          },
          {
            title: 'page1',
            type: 'default-page',
            aposLocale: 'fr:published',
            modified: false
          }
        ],
        job: {
          good: 4,
          total: 4
        }
      };

      assert.deepEqual(actual, expected);
    });
  });

  describe('#import - translations autopublish', function () {
    before(async function () {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        testModule: true,
        modules: {
          ...getAppConfig(),
          '@apostrophecms/i18n': {
            options: {
              defaultLocale: 'en',
              locales: {
                en: { label: 'English' },
                fr: {
                  label: 'French',
                  prefix: '/fr'
                }
              }
            }
          },
          '@apostrophecms/import-export': {
            options: {
              importExport: {
                export: {
                  expiration: 10 * 1000
                }
              }
            }
          },
          '@apostrophecms-pro/automatic-translation': {
            options: {
              provider: 'deepl'
            }
          },
          '@apostrophecms-pro/automatic-translation-deepl': {
            options: {
              apiSecret: 'test'
            },
            extendMethods: (self) => ({
              async requestTranslation(_super, req, text, source, target) {
                if (text.some((t) => t.toLowerCase().includes('test error'))) {
                  throw new Error('Translate test error');
                }
                return text.map((t) => `${t}-${source}-${target}-translated`);
              }
            })
          }
        }
      });

      tempPath = path.join(apos.rootDir, 'data/temp/uploadfs');
      attachmentPath = path.join(apos.rootDir, 'public/uploads/attachments');
      exportsPath = path.join(apos.rootDir, 'public/uploads/exports');
      importExportManager = apos.modules['@apostrophecms/import-export'];

      await insertAdminUser(apos);
    });

    it('should import, translate and autopublish', async function() {
      const req = apos.task.getReq();
      const articles = await apos.article.find(req).toArray();
      const manager = apos.article;

      req.body = {
        _ids: articles.map(({ _id }) => _id),
        extension: 'gzip',
        relatedTypes: [ 'topic' ],
        type: req.t(manager.options.pluralLabel)
      };

      const { url } = await importExportManager.export(req, manager);
      const fileName = path.basename(url);
      const exportFilePath = path.join(exportsPath, fileName);
      const importFilePath = path.join(tempPath, fileName);
      await fs.copyFile(exportFilePath, importFilePath);

      req.body = {
        translate: true
      };
      req.files = {
        file: {
          path: importFilePath,
          type: importExportManager.formats.gzip.allowedTypes[0]
        }
      };
      const params = await importExportManager.import(req);
      await deletePiecesAndPages(apos);
      await deleteAttachments(apos, attachmentPath);

      req.body = {
        ...params,
        duplicatedDocs: [],
        importedAttachments: [],
        overrideLocale: true,
        translate: true
      };
      req.locale = 'fr';
      await importExportManager.import(req);

      const importedDocs = await apos.doc.db
        .find({
          type: /article|topic/,
          aposLocale: {
            $in: [
              'fr:published', 'fr:draft'
            ]
          }
        })
        .toArray();

      const actual = importedDocs.map(doc => {
        return {
          title: doc.title,
          type: doc.type,
          aposLocale: doc.aposLocale,
          modified: doc.modified ?? false
        };
      });

      const expected = [
        {
          title: 'article2-en-fr-translated',
          type: 'article',
          aposLocale: 'fr:draft',
          modified: false
        },
        {
          title: 'article1-en-fr-translated',
          type: 'article',
          aposLocale: 'fr:draft',
          modified: false
        },
        {
          title: 'article2-en-fr-translated',
          type: 'article',
          aposLocale: 'fr:published',
          modified: false
        },
        {
          title: 'article1-en-fr-translated',
          type: 'article',
          aposLocale: 'fr:published',
          modified: false
        },
        {
          title: 'topic1-en-fr-translated',
          type: 'topic',
          aposLocale: 'fr:draft',
          modified: true
        },
        {
          title: 'topic3-en-fr-translated',
          type: 'topic',
          aposLocale: 'fr:draft',
          modified: true
        },
        {
          title: 'topic2-en-fr-translated',
          type: 'topic',
          aposLocale: 'fr:draft',
          modified: true
        },
        {
          title: 'topic3',
          type: 'topic',
          aposLocale: 'fr:published',
          modified: false
        },
        {
          title: 'topic1',
          type: 'topic',
          aposLocale: 'fr:published',
          modified: false
        },
        {
          title: 'topic2',
          type: 'topic',
          aposLocale: 'fr:published',
          modified: false
        }
      ];

      assert.deepEqual(actual, expected);
    });
  });
});
