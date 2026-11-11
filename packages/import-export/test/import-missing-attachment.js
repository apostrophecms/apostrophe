const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const {
  getAppConfig, insertAdminUser, cleanData
} = require('./util/index.js');

// CSV and XLSX can't carry files. A document whose attachment record does
// not exist where it is imported can't be saved: it must be reported as a
// failed document, with an explanation, while the rest of the import goes on
describe('#import - missing attachment records', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let jobManager;
  let exportsPath;
  let tempPath;
  let kept;
  let lost;
  let lostAttachment;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig({
        'required-file': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'requiredFile'
          },
          fields: {
            add: {
              file: {
                type: 'attachment',
                required: true
              }
            }
          }
        }
      })
    });

    importExportManager = apos.modules['@apostrophecms/import-export'];
    jobManager = apos.modules['@apostrophecms/job'];
    exportsPath = path.join(apos.rootDir, 'public/uploads/exports');
    tempPath = path.join(apos.rootDir, 'data/temp/import-missing-attachment');

    await insertAdminUser(apos);

    const req = apos.task.getReq({ mode: 'draft' });
    const insertAttachment = () => apos.attachment.insert(req, {
      name: 'test-image.jpg',
      path: path.join(apos.rootDir, 'public/test-image.jpg')
    });
    const keptAttachment = await insertAttachment();
    lostAttachment = await insertAttachment();
    kept = await apos.requiredFile.insert(req, {
      ...apos.requiredFile.newInstance(),
      title: 'kept',
      file: keptAttachment
    });
    lost = await apos.requiredFile.insert(req, {
      ...apos.requiredFile.newInstance(),
      title: 'lost',
      file: lostAttachment
    });
  });

  after(async function() {
    await cleanData([ exportsPath, tempPath ]);
    await apos.attachment.db.deleteMany({});
    await t.destroy(apos);
  });

  it('should report a document whose attachment record is missing, and import the rest', async function() {
    const exportReq = apos.task.getReq({
      mode: 'draft',
      body: {
        _ids: [ kept._id, lost._id ],
        relatedTypes: [],
        formatName: 'csv'
      }
    });
    const { url } = await importExportManager.export(exportReq, apos.requiredFile);

    // As if imported into another site: the documents are not there, and
    // neither is one of the attachments, since CSV could not carry it
    await apos.doc.db.deleteMany({ type: 'required-file' });
    await apos.attachment.db.deleteOne({ _id: lostAttachment._id });

    await fs.mkdir(tempPath, { recursive: true });
    const upload = path.join(tempPath, path.basename(url));
    await fs.copyFile(path.join(exportsPath, path.basename(url)), upload);

    const origError = apos.util.error;
    apos.util.error = () => {};
    let result;
    try {
      result = await importExportManager.import(apos.task.getReq({
        locale: 'en',
        mode: 'draft',
        body: {},
        files: {
          file: {
            path: upload,
            type: importExportManager.formats.csv.allowedTypes[0]
          }
        }
      }), 'required-file');
    } finally {
      apos.util.error = origError;
    }

    const titles = (await apos.doc.db
      .find({ type: 'required-file' })
      .toArray())
      .map(({ title }) => title);
    assert.ok(titles.includes('kept'), 'the document with its attachment is imported');
    assert.ok(!titles.includes('lost'), 'the document without its attachment is not');

    const job = await jobManager.db.findOne({ _id: result.jobId });
    const failedLog = Array.isArray(job?.results)
      ? job.results
      : (job?.results?.failedLog || []);
    assert.ok(failedLog.length > 0, 'the failure is reported');
    for (const failure of failedLog) {
      assert.equal(failure.title, 'lost');
      assert.match(
        failure.detail,
        new RegExp(`file: The attachment ${lostAttachment._id} was not found in the database`)
      );
    }
  });
});
