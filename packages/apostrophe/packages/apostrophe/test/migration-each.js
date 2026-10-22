const assert = require('node:assert/strict');
const t = require('../test-lib/test.js');

describe('Migration each', function () {
  this.timeout(t.timeout);

  let apos;
  let collection;

  before(async function () {
    apos = await t.create({ root: module });
    collection = apos.db.collection('migrationEachTest');
    await collection.deleteMany({});
    await collection.insertMany([
      { _id: 'a' },
      { _id: 'b' },
      { _id: 'c' }
    ]);
  });

  after(async function () {
    await t.destroy(apos);
  });

  // Count the closes of every cursor the collection hands out
  function trackCloses(collection) {
    const find = collection.find.bind(collection);
    const closes = { count: 0 };
    collection.find = (...args) => {
      const cursor = find(...args);
      const close = cursor.close.bind(cursor);
      cursor.close = async (...closeArgs) => {
        closes.count++;
        return close(...closeArgs);
      };
      return cursor;
    };
    return closes;
  }

  it('closes the cursor after visiting every document', async function () {
    const closes = trackCloses(collection);
    const visited = [];
    await apos.migration.each(collection, {}, 1, async doc => {
      visited.push(doc._id);
    });
    assert.deepEqual(visited, [ 'a', 'b', 'c' ]);
    assert.equal(closes.count, 1);
  });

  it('closes the cursor and rethrows when the iterator throws', async function () {
    const closes = trackCloses(collection);
    await assert.rejects(
      apos.migration.each(collection, {}, 1, async () => {
        throw new Error('iterator failed');
      }),
      /iterator failed/
    );
    assert.equal(closes.count, 1);
    const doc = await collection.findOne({ _id: 'a' });
    assert.equal(doc._id, 'a');
  });
});
