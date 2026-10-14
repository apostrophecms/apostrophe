const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const {
  getAppConfig,
  insertAdminUser,
  login,
  buildFixtures,
  copyFixtures,
  cleanFixtures
} = require('./util/index.js');

// GHSA-rw26-wwfc-9wvm: the `clean-export` and `override-duplicates` routes
// did not require a login, and `clean-export` would remove the pending import
// files of whoever started the import and mark any job as completed, without
// checking that they belonged to the caller.
describe('clean-export and override-duplicates routes', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let admin;
  let otherAdmin;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig()
    });
    importExportManager = apos.modules['@apostrophecms/import-export'];

    await insertAdminUser(apos);
    await apos.user.insert(apos.task.getReq(), {
      ...apos.user.newInstance(),
      title: 'other-admin',
      username: 'other-admin',
      password: 'other-admin',
      role: 'admin'
    });
    admin = await apos.user.find(apos.task.getReq(), { username: 'admin' }).toObject();
    otherAdmin = await apos.user.find(apos.task.getReq(), { username: 'other-admin' }).toObject();

    // Existing topics, so that importing the fixture stops on the
    // duplicates step and leaves its files pending
    await apos.topic.insert(apos.task.getReq({ mode: 'draft' }), {
      ...apos.topic.newInstance(),
      _id: '4:en:draft',
      slug: 'topic1-existing-draft',
      title: 'topic1 EXISTING DRAFT'
    });
  });

  after(async function() {
    await cleanFixtures(apos);
    await t.destroy(apos);
    apos = null;
  });

  it('refuses to clean an export for an anonymous visitor', async function() {
    const pending = await startImport(admin);
    const jar = await anonymousJar();

    await assertForbidden(() => apos.http.post('/api/v1/@apostrophecms/import-export/clean-export', {
      body: {
        exportId: pending.exportId,
        jobId: pending.jobId
      },
      jar
    }));

    assert(await exists(pending.exportPath), 'the pending import must survive');
    assert.notEqual((await findJob(pending.jobId)).status, 'completed');
  });

  it('refuses to override duplicates for an anonymous visitor', async function() {
    const pending = await startImport(admin);
    const jar = await anonymousJar();

    await assertForbidden(() => apos.http.post('/api/v1/@apostrophecms/import-export/override-duplicates', {
      body: {
        exportId: pending.exportId,
        jobId: pending.jobId,
        formatLabel: pending.formatLabel,
        docIds: pending.duplicatedDocs.map(({ aposDocId }) => aposDocId),
        duplicatedDocs: pending.duplicatedDocs,
        importedAttachments: pending.importedAttachments
      },
      jar
    }));

    assert(await exists(pending.exportPath), 'the pending import must survive');
  });

  it('refuses to clean an export started by another user', async function() {
    const pending = await startImport(admin);
    const jar = await login(apos.http, 'other-admin');

    await assertForbidden(() => apos.http.post('/api/v1/@apostrophecms/import-export/clean-export', {
      body: {
        exportId: pending.exportId,
        jobId: pending.jobId
      },
      jar
    }));

    assert(await exists(pending.exportPath), 'the pending import must survive');
    assert.notEqual((await findJob(pending.jobId)).status, 'completed');
  });

  it('does not end a job started by another user', async function() {
    const victim = await startImport(admin);
    const own = await startImport(otherAdmin);
    const jar = await login(apos.http, 'other-admin');

    try {
      await apos.http.post('/api/v1/@apostrophecms/import-export/clean-export', {
        body: {
          exportId: own.exportId,
          jobId: victim.jobId
        },
        jar
      });
    } catch (e) {
      // Refusing outright is fine too
    }

    const job = await findJob(victim.jobId);
    assert.notEqual(job.status, 'completed');
    assert.notEqual(job.ended, true);
  });

  it('cleans an export for the user who started it', async function() {
    const pending = await startImport(admin);
    const jar = await login(apos.http, 'admin');

    await apos.http.post('/api/v1/@apostrophecms/import-export/clean-export', {
      body: {
        exportId: pending.exportId,
        jobId: pending.jobId
      },
      jar
    });

    assert(!(await exists(pending.exportPath)), 'the pending import should be removed');
    const job = await findJob(pending.jobId);
    assert.equal(job.status, 'completed');
    assert.equal(job.ended, true);
  });

  // Imports the topic fixture as `user`. It stops at the duplicates step,
  // leaving the uploaded file and the job pending until `clean-export`
  // or `override-duplicates` is called.
  async function startImport(user) {
    await cleanFixtures(apos);
    await copyFixtures(apos);
    await buildFixtures(apos);

    const req = apos.task.getReq({
      locale: 'en',
      body: {
        formatLabel: 'gzip'
      },
      files: {
        file: {
          path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft.tar.gz'),
          type: importExportManager.formats.gzip.allowedTypes[0]
        }
      }
    });
    req.user = user;

    const result = await importExportManager.import(req);
    assert(result.duplicatedDocs.length, 'the import should stop on duplicates');
    // The archive itself is extracted then removed, what remains pending is
    // the extracted folder and the copy kept in uploadfs
    const exportPath = await importExportManager.getExportArtifactsPath(result.exportId);
    assert(await exists(exportPath));

    return {
      ...result,
      exportPath
    };
  }

  async function anonymousJar() {
    const jar = apos.http.jar();
    // Obtains the CSRF cookie every visitor gets
    await apos.http.get('/', { jar });
    return jar;
  }

  function findJob(_id) {
    return apos.modules['@apostrophecms/job'].db.findOne({ _id });
  }
});

async function assertForbidden(fn) {
  try {
    await fn();
  } catch (e) {
    assert.equal(e.status, 403);
    return;
  }
  assert.fail('the request should have been refused');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (e) {
    return false;
  }
}
