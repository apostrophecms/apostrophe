const assert = require('assert');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dbConnect = require(path.resolve(__dirname, '../lib/db-connect'));

const dumpBin = path.resolve(__dirname, '../bin/apos-db-dump.js');
const restoreBin = path.resolve(__dirname, '../bin/apos-db-restore.js');

// Default to mongodb, allow override via DB_URI env var
const baseUri = process.env.DB_URI || 'mongodb://localhost:27017';

function testUri(dbName) {
  if (baseUri.startsWith('mongodb://')) {
    return `${baseUri}/${dbName}`;
  }
  // postgres or multipostgres
  return `${baseUri.replace(/\/[^/]*$/, '')}/${dbName}`;
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [ bin, ...args ], {
      timeout: 30000,
      maxBuffer: 50 * 1024 * 1024
    }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({
        stdout,
        stderr
      });
    });
  });
}

async function dropAll(uri) {
  let client;
  try {
    client = await dbConnect(uri);
  } catch (e) {
    return;
  }
  const db = client.db();
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).drop();
  }
  await client.close();
}

describe('apos-db-dump and apos-db-restore', function () {
  this.timeout(30000);

  const sourceUri = testUri('dbtest_dump_source');
  const targetUri = testUri('dbtest_dump_target');
  let tmpFile;

  before(async function () {
    tmpFile = path.join(os.tmpdir(), `apos-db-test-${process.pid}.ndjson`);
    await dropAll(sourceUri);
    await dropAll(targetUri);
  });

  after(async function () {
    await dropAll(sourceUri);
    await dropAll(targetUri);
    try {
      fs.unlinkSync(tmpFile);
    } catch (e) {
      // ignore
    }
  });

  it('should dump an empty database without error', async function () {
    const { stdout } = await run(dumpBin, [ sourceUri ]);
    assert.strictEqual(stdout.trim(), '');
  });

  it('should dump and restore documents', async function () {
    // Insert test data
    const client = await dbConnect(sourceUri);
    const db = client.db();
    await db.collection('aposDocs').insertMany([
      {
        _id: 'doc1',
        title: 'Hello',
        tags: [ 'a', 'b' ]
      },
      {
        _id: 'doc2',
        title: 'World'
      }
    ]);
    await db.collection('aposCache').insertMany([
      {
        _id: 'cache1',
        value: 42
      }
    ]);
    await client.close();

    // Dump to file
    await run(dumpBin, [ sourceUri, `--output=${tmpFile}` ]);
    const content = fs.readFileSync(tmpFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    // Should have header + docs for each collection
    assert(lines.length >= 4, `Expected at least 4 lines, got ${lines.length}`);

    // Every line should be valid JSON
    for (const line of lines) {
      JSON.parse(line);
    }

    // Should have collection headers
    const headers = lines
      .map(l => JSON.parse(l))
      .filter(e => e._collection && !e._doc);
    const collNames = headers.map(h => h._collection).sort();
    assert(collNames.includes('aposDocs'));
    assert(collNames.includes('aposCache'));

    // Restore to target
    await run(restoreBin, [ targetUri, `--input=${tmpFile}` ]);

    // Verify target has the data
    const client2 = await dbConnect(targetUri);
    const db2 = client2.db();
    const docs = await db2.collection('aposDocs').find({}).sort({ _id: 1 }).toArray();
    assert.strictEqual(docs.length, 2);
    assert.strictEqual(docs[0]._id, 'doc1');
    assert.strictEqual(docs[0].title, 'Hello');
    assert.deepStrictEqual(docs[0].tags, [ 'a', 'b' ]);
    assert.strictEqual(docs[1]._id, 'doc2');

    const cacheDoc = await db2.collection('aposCache').findOne({ _id: 'cache1' });
    assert(cacheDoc);
    assert.strictEqual(cacheDoc.value, 42);
    await client2.close();
  });

  it('should preserve Date objects via $date serialization', async function () {
    await dropAll(sourceUri);
    const client = await dbConnect(sourceUri);
    const db = client.db();
    const testDate = new Date('2024-06-15T10:30:00.000Z');
    await db.collection('aposDocs').insertOne({
      _id: 'dateDoc',
      createdAt: testDate,
      nested: { updatedAt: testDate }
    });
    await client.close();

    // Dump and check format
    const { stdout } = await run(dumpBin, [ sourceUri ]);
    assert(stdout.includes('"$date"'));
    assert(stdout.includes('2024-06-15T10:30:00.000Z'), 'Should contain ISO date string');

    // Restore and verify dates come back as Date objects
    await dropAll(targetUri);
    await run(dumpBin, [ sourceUri, `--output=${tmpFile}` ]);
    await run(restoreBin, [ targetUri, `--input=${tmpFile}` ]);

    const client2 = await dbConnect(targetUri);
    const db2 = client2.db();
    const doc = await db2.collection('aposDocs').findOne({ _id: 'dateDoc' });
    assert(doc.createdAt instanceof Date);
    assert.strictEqual(doc.createdAt.toISOString(), '2024-06-15T10:30:00.000Z');
    assert(doc.nested.updatedAt instanceof Date);
    assert.strictEqual(doc.nested.updatedAt.toISOString(), '2024-06-15T10:30:00.000Z');
    await client2.close();
  });

  it('should dump and restore indexes', async function () {
    await dropAll(sourceUri);
    const client = await dbConnect(sourceUri);
    const db = client.db();
    const col = db.collection('aposDocs');
    await col.insertMany([
      {
        _id: 'idx1',
        slug: 'hello',
        price: 10
      },
      {
        _id: 'idx2',
        slug: 'world',
        price: 20
      }
    ]);
    await col.createIndex({ slug: 1 });
    await col.createIndex({ slug: 1 }, {
      unique: true,
      name: 'slug_unique'
    });
    await col.createIndex({ price: 1 }, { type: 'number' });
    await client.close();

    // Dump
    await run(dumpBin, [ sourceUri, `--output=${tmpFile}` ]);

    const content = fs.readFileSync(tmpFile, 'utf8');
    const header = JSON.parse(content.split('\n')[0]);
    assert(header._indexes, 'Header should contain _indexes');
    assert(header._indexes.length >= 2, 'Should have at least 2 custom indexes');

    // Restore
    await dropAll(targetUri);
    await run(restoreBin, [ targetUri, `--input=${tmpFile}` ]);

    // Verify indexes exist on target
    const client2 = await dbConnect(targetUri);
    const db2 = client2.db();
    const indexes = await db2.collection('aposDocs').indexes();
    assert(indexes.find(i => i.key && i.key.slug === 1 && !i.unique),
      'Should have regular slug index');
    assert(indexes.find(i => i.key && i.key.slug === 1 && i.unique),
      'Should have unique slug index');

    // Verify unique constraint is enforced
    try {
      await db2.collection('aposDocs').insertOne({
        _id: 'idx3',
        slug: 'hello'
      });
      assert.fail('Should have rejected duplicate slug');
    } catch (e) {
      assert(e.code === 11000 || /duplicate|unique|already exists/i.test(e.message));
    }

    await client2.close();
  });

  it('should handle piped stdout-to-stdin', async function () {
    await dropAll(sourceUri);
    const client = await dbConnect(sourceUri);
    const db = client.db();
    await db.collection('aposDocs').insertMany([
      {
        _id: 'pipe1',
        title: 'Piped'
      }
    ]);
    await client.close();

    // Dump to file, then restore from file (simulating pipe)
    const { stdout } = await run(dumpBin, [ sourceUri ]);

    // Write stdout to tmp, restore from it
    fs.writeFileSync(tmpFile, stdout);
    await dropAll(targetUri);
    await run(restoreBin, [ targetUri, `--input=${tmpFile}` ]);

    const client2 = await dbConnect(targetUri);
    const db2 = client2.db();
    const doc = await db2.collection('aposDocs').findOne({ _id: 'pipe1' });
    assert(doc);
    assert.strictEqual(doc.title, 'Piped');
    await client2.close();
  });

  it('should handle large collections in batches', async function () {
    await dropAll(sourceUri);
    const client = await dbConnect(sourceUri);
    const db = client.db();
    const docs = [];
    for (let i = 0; i < 350; i++) {
      docs.push({
        _id: `batch${String(i).padStart(4, '0')}`,
        value: i
      });
    }
    await db.collection('aposDocs').insertMany(docs);
    await client.close();

    // Dump
    await run(dumpBin, [ sourceUri, `--output=${tmpFile}` ]);

    const content = fs.readFileSync(tmpFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    // 1 header + 350 doc lines
    assert.strictEqual(lines.length, 351);

    // Docs should be sorted by _id
    const docLines = lines.slice(1).map(l => JSON.parse(l));
    for (let i = 1; i < docLines.length; i++) {
      assert(docLines[i]._doc._id > docLines[i - 1]._doc._id,
        'Docs should be sorted by _id');
    }

    // Restore and verify count
    await dropAll(targetUri);
    await run(restoreBin, [ targetUri, `--input=${tmpFile}` ]);

    const client2 = await dbConnect(targetUri);
    const db2 = client2.db();
    const count = await db2.collection('aposDocs').countDocuments({});
    assert.strictEqual(count, 350);
    await client2.close();
  });

  it('should restore to a clean state (drop existing data)', async function () {
    // Put some pre-existing data in target
    const client = await dbConnect(targetUri);
    const db = client.db();
    try {
      await db.collection('aposDocs').drop();
    } catch (e) {
      // ignore
    }
    await db.collection('aposDocs').insertOne({
      _id: 'old',
      title: 'Should be removed'
    });
    await client.close();

    // Set up source with different data
    await dropAll(sourceUri);
    const client2 = await dbConnect(sourceUri);
    const db2 = client2.db();
    await db2.collection('aposDocs').insertOne({
      _id: 'new',
      title: 'Fresh data'
    });
    await client2.close();

    // Dump source and restore to target
    await run(dumpBin, [ sourceUri, `--output=${tmpFile}` ]);
    await run(restoreBin, [ targetUri, `--input=${tmpFile}` ]);

    // Target should only have the new data
    const client3 = await dbConnect(targetUri);
    const db3 = client3.db();
    const all = await db3.collection('aposDocs').find({}).toArray();
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0]._id, 'new');
    await client3.close();
  });

  it('should fail with usage error when no URI is provided', async function () {
    try {
      await run(dumpBin, []);
      assert.fail('Should have exited with error');
    } catch (e) {
      assert.strictEqual(e.code, 1);
      assert(e.stderr.includes('Usage'));
    }

    try {
      await run(restoreBin, []);
      assert.fail('Should have exited with error');
    } catch (e) {
      assert.strictEqual(e.code, 1);
      assert(e.stderr.includes('Usage'));
    }
  });
});
