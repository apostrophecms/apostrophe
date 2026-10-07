const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const tar = require('tar-stream');
const t = require('apostrophe/test-lib/util.js');
const { getAppConfig, deletePiecesAndPages } = require('./util/index.js');

// GHSA-jqw5-w6h3-44g6: the value of a "<field>:key" column is used to look up
// the existing document to update. Both import formats can deliver a non-string
// value there: gzip archives are parsed with EJSON (which revives objects such
// as `{ $ne: null }`), and the CSV format JSON-parses every cell. A MongoDB
// operator smuggled in that way must never select an existing document the
// import did not identify by its exact key. The field name itself comes from
// the file too, so it must not be able to name a query operator.
describe('@apostrophecms/import-export update key injection', function() {
  let apos;
  let importExportManager;
  let uploadsPath;

  this.timeout(60000);

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig()
    });
    importExportManager = apos.modules['@apostrophecms/import-export'];
    uploadsPath = path.join(apos.rootDir, 'data/tmp/uploads');
    await fsp.mkdir(uploadsPath, { recursive: true });
  });

  after(async function() {
    await t.destroy(apos);
    apos = null;
  });

  beforeEach(async function() {
    await deletePiecesAndPages(apos);
    const req = apos.task.getReq({ mode: 'draft' });
    for (const name of [ 'good', 'decoy' ]) {
      await apos.article.insert(req, {
        ...apos.article.newInstance(),
        title: `${name} article`,
        slug: `${name}-article`
      });
    }
  });

  async function assertUntouched() {
    const articles = await apos.doc.db
      .find({
        type: 'article',
        aposMode: { $in: [ 'draft', 'published' ] }
      })
      .toArray();
    // Draft and published of each of the two seeded articles, unmodified
    assert.equal(articles.length, 4);
    for (const article of articles) {
      assert.match(article.title, /^(good|decoy) article$/);
      assert.match(article.slug, /^(good|decoy)-article$/);
    }
  }

  function getImportReq(filePath, type) {
    return apos.task.getReq({
      locale: 'en',
      body: {},
      files: {
        file: {
          path: filePath,
          type
        }
      }
    });
  }

  async function importCsv(name, content) {
    const filePath = path.join(uploadsPath, name);
    await fsp.writeFile(filePath, content);
    await importExportManager.import(
      getImportReq(filePath, importExportManager.formats.csv.allowedTypes[0])
    );
  }

  async function importGzip(name, docs) {
    const filePath = path.join(uploadsPath, name);
    await makeArchive(filePath, JSON.stringify(docs));
    await importExportManager.import(
      getImportReq(filePath, importExportManager.formats.gzip.allowedTypes[0])
    );
  }

  it('does not let a CSV key cell holding a $regex operator select a document', async function() {
    await importCsv(
      'regex-key.csv',
      [
        'type,slug:key,title',
        '"article","{""$regex"":""^decoy""}","PWNED"'
      ].join('\n')
    );
    await assertUntouched();
  });

  it('does not let a CSV key cell holding a $ne operator select a document', async function() {
    await importCsv(
      'ne-key.csv',
      [
        'type,slug:key,title',
        '"article","{""$ne"":null}","PWNED"'
      ].join('\n')
    );
    await assertUntouched();
  });

  it('does not let a CSV key column name a query operator', async function() {
    await importCsv(
      'where-key.csv',
      [
        'type,$where:key,title',
        '"article","this.slug === \'decoy-article\'","PWNED"'
      ].join('\n')
    );
    await assertUntouched();
  });

  it('does not let a gzip key value holding a $ne operator select a document', async function() {
    await importGzip('ne-key.tar.gz', [
      {
        _id: 'evil1:en:draft',
        aposDocId: 'evil1',
        aposLocale: 'en:draft',
        aposMode: 'draft',
        type: 'article',
        title: 'PWNED',
        'slug:key': { $ne: null }
      }
    ]);
    await assertUntouched();
  });

  it('does not let a gzip key value holding a $gt operator select a document', async function() {
    await importGzip('gt-key.tar.gz', [
      {
        _id: 'evil2:en:draft',
        aposDocId: 'evil2',
        aposLocale: 'en:draft',
        aposMode: 'draft',
        type: 'article',
        title: 'PWNED',
        'title:key': { $gt: '' }
      }
    ]);
    await assertUntouched();
  });

  it('does not let a gzip key name a query operator', async function() {
    await importGzip('where-key.tar.gz', [
      {
        _id: 'evil3:en:draft',
        aposDocId: 'evil3',
        aposLocale: 'en:draft',
        aposMode: 'draft',
        type: 'article',
        title: 'PWNED',
        '$where:key': 'this.slug === \'decoy-article\''
      }
    ]);
    await assertUntouched();
  });

  it('still updates the document matching a plain string key', async function() {
    await importCsv(
      'legit-key.csv',
      [
        'type,slug:key,title',
        '"article","decoy-article","decoy article - edited"'
      ].join('\n')
    );
    const decoys = await apos.doc.db
      .find({
        type: 'article',
        aposMode: { $in: [ 'draft', 'published' ] },
        slug: 'decoy-article'
      })
      .toArray();
    assert.equal(decoys.length, 2);
    for (const decoy of decoys) {
      assert.equal(decoy.title, 'decoy article - edited');
    }
    const good = await apos.doc.db
      .find({
        type: 'article',
        aposMode: { $in: [ 'draft', 'published' ] },
        slug: 'good-article'
      })
      .toArray();
    assert.equal(good.length, 2);
    for (const doc of good) {
      assert.equal(doc.title, 'good article');
    }
  });
});

async function makeArchive(archivePath, docsJson) {
  const pack = tar.pack();
  const gzip = zlib.createGzip();
  const out = fs.createWriteStream(archivePath);

  const done = new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
    gzip.on('error', reject);
    pack.on('error', reject);
  });

  pack.pipe(gzip).pipe(out);
  pack.entry({ name: 'aposDocs.json' }, docsJson);
  pack.entry({ name: 'aposAttachments.json' }, '[]');
  pack.finalize();
  await done;
}
