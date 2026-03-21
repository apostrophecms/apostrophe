/* global describe, it, before, after */
const { expect } = require('chai');
const dbConnect = require('..');

const ADAPTER = process.env.ADAPTER || 'mongodb';

function getUri(dbName) {
  if (ADAPTER === 'mongodb') {
    return `mongodb://localhost:27017/${dbName}`;
  } else if (ADAPTER === 'postgres') {
    const user = process.env.PGUSER || process.env.USER;
    const password = process.env.PGPASSWORD || '';
    const auth = password ? `${user}:${password}@` : `${user}@`;
    return `postgres://${auth}localhost:5432/${dbName}`;
  } else if (ADAPTER === 'multipostgres') {
    const user = process.env.PGUSER || process.env.USER;
    const password = process.env.PGPASSWORD || '';
    const auth = password ? `${user}:${password}@` : `${user}@`;
    return `multipostgres://${auth}localhost:5432/dbtest_dump-${dbName}`;
  } else if (ADAPTER === 'sqlite') {
    return `sqlite:///tmp/${dbName}.db`;
  }
  throw new Error(`Unknown adapter: ${ADAPTER}`);
}

describe(`dump/restore programmatic API (${ADAPTER})`, function () {
  const sourceDbName = 'dbtest_dump_source';
  const targetDbName = 'dbtest_dump_target';
  let sourceClient;
  let targetClient;

  before(async function () {
    // Clean up any previous runs
    sourceClient = await dbConnect(getUri(sourceDbName));
    targetClient = await dbConnect(getUri(targetDbName));
    const sourceDb = sourceClient.db();
    const targetDb = targetClient.db();
    try {
      await sourceDb.collection('items').drop();
    } catch (e) { /* ignore */ }
    try {
      await sourceDb.collection('meta').drop();
    } catch (e) { /* ignore */ }
    try {
      await targetDb.collection('items').drop();
    } catch (e) { /* ignore */ }
    try {
      await targetDb.collection('meta').drop();
    } catch (e) { /* ignore */ }
    await sourceClient.close();
    await targetClient.close();
  });

  after(async function () {
    // Clean up
    sourceClient = await dbConnect(getUri(sourceDbName));
    targetClient = await dbConnect(getUri(targetDbName));
    try {
      await sourceClient.db().collection('items').drop();
    } catch (e) { /* ignore */ }
    try {
      await sourceClient.db().collection('meta').drop();
    } catch (e) { /* ignore */ }
    try {
      await targetClient.db().collection('items').drop();
    } catch (e) { /* ignore */ }
    try {
      await targetClient.db().collection('meta').drop();
    } catch (e) { /* ignore */ }
    await sourceClient.close();
    await targetClient.close();
  });

  it('should dump a database to a string', async function () {
    // Insert some data
    const client = await dbConnect(getUri(sourceDbName));
    const db = client.db();
    await db.collection('items').insertMany([
      {
        _id: 'item1',
        title: 'First',
        value: 10
      },
      {
        _id: 'item2',
        title: 'Second',
        value: 20
      }
    ]);
    await db.collection('meta').insertOne({
      _id: 'version',
      v: 1
    });
    await client.close();

    const data = await dbConnect.dump(getUri(sourceDbName));
    expect(data).to.be.a('string');
    expect(data).to.include('item1');
    expect(data).to.include('First');
    expect(data).to.include('item2');
    expect(data).to.include('version');
  });

  it('should restore a database from a dump string', async function () {
    const data = await dbConnect.dump(getUri(sourceDbName));
    await dbConnect.restore(getUri(targetDbName), data);

    const client = await dbConnect(getUri(targetDbName));
    const db = client.db();
    const items = await db.collection('items').find({}).sort({ _id: 1 }).toArray();
    expect(items).to.have.length(2);
    expect(items[0]._id).to.equal('item1');
    expect(items[0].title).to.equal('First');
    expect(items[1]._id).to.equal('item2');
    expect(items[1].title).to.equal('Second');

    const meta = await db.collection('meta').findOne({ _id: 'version' });
    expect(meta.v).to.equal(1);
    await client.close();
  });

  it('should copy a database via copyDatabase()', async function () {
    // Modify source to prove we get fresh data
    const client = await dbConnect(getUri(sourceDbName));
    await client.db().collection('items').insertOne({
      _id: 'item3',
      title: 'Third',
      value: 30
    });
    await client.close();

    // Clean target first
    const tgt = await dbConnect(getUri(targetDbName));
    try {
      await tgt.db().collection('items').drop();
    } catch (e) { /* ignore */ }
    try {
      await tgt.db().collection('meta').drop();
    } catch (e) { /* ignore */ }
    await tgt.close();

    await dbConnect.copyDatabase(getUri(sourceDbName), getUri(targetDbName));

    const check = await dbConnect(getUri(targetDbName));
    const items = await check.db().collection('items').find({}).sort({ _id: 1 }).toArray();
    expect(items).to.have.length(3);
    expect(items[2].title).to.equal('Third');
    await check.close();
  });

  it('should produce independent databases after copy', async function () {
    await dbConnect.copyDatabase(getUri(sourceDbName), getUri(targetDbName));

    // Modify target
    const tgt = await dbConnect(getUri(targetDbName));
    await tgt.db().collection('items').updateOne({ _id: 'item1' }, { $set: { title: 'Modified' } });
    await tgt.close();

    // Source should be unchanged
    const src = await dbConnect(getUri(sourceDbName));
    const item = await src.db().collection('items').findOne({ _id: 'item1' });
    expect(item.title).to.equal('First');
    await src.close();
  });
});
