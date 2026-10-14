const assert = require('node:assert/strict');
const path = require('node:path');
const dayjs = require('dayjs');
const t = require('apostrophe/test-lib/util.js');

const { getAppConfig } = require('./util/index.js');

// GHSA-5gc8-frw3-3vqm: an export is published under the public
// `/uploads/exports/` URL until it expires. Its name used to be built only
// from the site's short name, the exported type and a timestamp to the
// second, so anyone could guess the URL of a fresh export and download it.
describe('export download filename', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig()
    });

    importExportManager = apos.modules['@apostrophecms/import-export'];

    const req = apos.task.getReq();
    await apos.article.insert(req, {
      ...apos.article.newInstance(),
      title: 'Confidential article'
    });
  });

  after(async function() {
    await t.destroy(apos);
    apos = null;
  });

  it('cannot be derived from the short name, type and time of the export', async function() {
    const req = apos.task.getReq();
    const articles = await apos.article.find(req).toArray();
    const startedAt = dayjs();

    const exportArticles = () => importExportManager.export(apos.task.getReq({
      body: {
        _ids: articles.map(({ _id }) => _id),
        formatName: 'gzip',
        type: 'article'
      }
    }), apos.article);

    // Two exports started in the same second
    const results = await Promise.all([ exportArticles(), exportArticles() ]);
    const urls = results.map(({ url }) => url);
    const names = urls.map(url => path.basename(url));

    assert.notEqual(names[0], names[1], 'concurrent exports must not share a name');

    const prefix = `${apos.shortName}-article-export-`;
    const guessable = [];
    for (let offset = -5; offset <= 5; offset++) {
      const timestamp = startedAt.startOf('second').add(offset, 'second').format('YYYYMMDDHHmmss');
      guessable.push(`${prefix}${timestamp}.tar.gz`);
    }

    for (const name of names) {
      // Still readable for the person who downloads it
      assert(name.startsWith(prefix), `${name} should start with ${prefix}`);
      assert(name.endsWith('.tar.gz'), `${name} should end with .tar.gz`);
      assert(!guessable.includes(name), `${name} is guessable`);
      // Whatever follows the timestamp must carry real entropy
      const rest = name.slice(prefix.length, -'.tar.gz'.length).replace(/^\d{14}/, '');
      assert(rest.replace(/[^a-z0-9]/gi, '').length >= 20, `${name} has no secret component`);
    }

    // The real URL works, guessed ones do not
    for (const url of urls) {
      const response = await apos.http.get(url, { fullResponse: true });
      assert.equal(response.status, 200);
    }
    for (const name of guessable) {
      let status;
      try {
        status = (await apos.http.get(`/uploads/exports/${name}`, { fullResponse: true })).status;
      } catch (e) {
        status = e.status;
      }
      assert.equal(status, 404, `guessed ${name} should not be downloadable`);
    }
  });

  it('keeps the export inside the exports folder whatever the type is', async function() {
    const req = apos.task.getReq();
    const articles = await apos.article.find(req).toArray();

    const { url } = await importExportManager.export(apos.task.getReq({
      body: {
        _ids: articles.map(({ _id }) => _id),
        formatName: 'gzip',
        type: '/../../../Evil'
      }
    }), apos.article);

    const uploadsUrl = apos.attachment.uploadfs.getUrl();
    assert(url.startsWith(`${uploadsUrl}/exports/`), url);
    const relative = url.slice(`${uploadsUrl}/exports/`.length);
    assert(!relative.includes('/'), `${relative} should be a bare file name`);
    assert(!relative.includes('..'), `${relative} should not contain ..`);
  });
});
