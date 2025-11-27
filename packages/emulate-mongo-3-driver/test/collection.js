const assert = require('assert/strict');
const mongo = require('../index.js');

describe('collection', function() {
  let client;
  let db;

  afterEach(async function() {
    const collections = await db.collections();
    await Promise.all(collections.map(collection => db.dropCollection(collection.collectionName)));
    await client.close();
  });

  beforeEach(async function() {
    client = new mongo.MongoClient('mongodb://localhost:27017/testdb', {});
    await client.connect();
    db = client.db();
  });

  // [ ] bulkWrite
  // [x] count
  // [x] ensureIndex
  // [x] insert
  //   [x] insertMany
  //   [x] insertOne
  // [x] remove
  //   [x] deleteMany
  //   [x] deleteOne
  //   [x] removeMany
  //   [x] removeOne
  // [x] rename
  // [x] replaceOne
  // [x] update
  //   [x] updateMany
  //   [x] updateOne

  it('collection.count (callback)', function(done) {
    const trees = db.collection('trees');

    trees.insert(
      [
        {
          title: 'birch',
          type: 'tree'
        },
        {
          title: 'oak',
          type: 'tree'
        },
        {
          title: 'rhododendron ',
          type: 'shrub'
        }
      ],
      {},
      (insertError) => {
        if (insertError) {
          done(insertError);

          return;
        }

        trees.count(
          { type: 'shrub' },
          {},
          (err, result) => {
            try {
              assert.ifError(err);
              const actual = result;
              const expected = 1;

              assert.equal(actual, expected);
              done();
            } catch (error) {
              done(error);
            }
          }
        );
      }
    );
  });
  it('collection.count (promise)', async function() {
    const trees = db.collection('trees');

    await trees.insert(
      [
        {
          title: 'birch',
          type: 'tree'
        },
        {
          title: 'oak',
          type: 'tree'
        },
        {
          title: 'rhododendron ',
          type: 'shrub'
        }
      ]
    );
    const actual = {
      tree: await trees.count({ type: 'tree' }),
      shrub: await trees.count({ type: 'shrub' }),
      all: await trees.count()
    };
    const expected = {
      tree: 2,
      shrub: 1,
      all: 3
    };

    assert.deepEqual(actual, expected);
  });

  it('collection.ensureIndex (callback)', function(done) {
    const trees = db.collection('trees');

    trees.ensureIndex(
      {
        location: '2dsphere'
      },
      {},
      (err, index) => {
        assert.ifError(err);
        const actual = index;
        const expected = 'location_2dsphere';

        assert.equal(actual, expected);
        done();
      }
    );
  });
  it('collection.ensureIndex (promise)', async function() {
    const trees = db.collection('trees');

    const actual = await trees.ensureIndex({
      location: '2dsphere'
    });
    const expected = 'location_2dsphere';

    assert.equal(actual, expected);
  });

  it('collection.insert array (callback)', function(done) {
    const trees = db.collection('trees');

    trees.insert(
      [
        {
          title: 'birch'
        },
        {
          title: 'oak'
        }
      ],
      {},
      (err, result) => {
        try {
          assert.ifError(err);
          const actual = result;
          const expected = {
            acknowledged: true,
            insertedCount: 2,
            insertedIds: actual.insertedIds,
            result: {
              getInsertedIds: actual.insertedIds,
              getUpsertedIds: undefined,
              n: 2,
              nInserted: 2,
              nMatched: undefined,
              nModified: undefined,
              nRemoved: undefined,
              nUpserted: undefined,
              ok: 1
            }
          };

          assert.deepEqual(actual, expected);
          done();
        } catch (error) {
          done(error);
        }
      }
    );
  });
  it('collection.insert array (promise)', async function() {
    const trees = db.collection('trees');

    const actual = await trees.insert(
      [
        {
          title: 'birch'
        },
        {
          title: 'oak'
        }
      ]
    );
    const expected = {
      acknowledged: true,
      insertedCount: 2,
      insertedIds: actual.insertedIds,
      result: {
        getInsertedIds: actual.insertedIds,
        getUpsertedIds: undefined,
        n: 2,
        nInserted: 2,
        nMatched: undefined,
        nModified: undefined,
        nRemoved: undefined,
        nUpserted: undefined,
        ok: 1
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('collection.insert (callback)', function(done) {
    const trees = db.collection('trees');

    trees.insert(
      {
        title: 'birch'
      },
      {},
      (err, result) => {
        try {
          assert.ifError(err);
          const actual = result;
          const expected = {
            acknowledged: true,
            insertedCount: 1,
            insertedId: actual.insertedId,
            ops: [ { _id: actual.insertedId } ],
            result: {
              getInsertedIds: undefined,
              getUpsertedIds: undefined,
              n: 1,
              nInserted: undefined,
              nMatched: undefined,
              nModified: undefined,
              nRemoved: undefined,
              nUpserted: undefined,
              ok: 1
            }
          };

          assert.deepEqual(actual, expected);
          done();
        } catch (error) {
          done(error);
        }
      }
    );
  });
  it('collection.insert (promise)', async function() {
    const trees = db.collection('trees');

    const actual = await trees.insert({
      title: 'birch'
    });
    const expected = {
      acknowledged: true,
      insertedCount: 1,
      insertedId: actual.insertedId,
      ops: [ { _id: actual.insertedId } ],
      result: {
        getInsertedIds: undefined,
        getUpsertedIds: undefined,
        n: 1,
        nInserted: undefined,
        nMatched: undefined,
        nModified: undefined,
        nRemoved: undefined,
        nUpserted: undefined,
        ok: 1
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('collection.remove (callback)', function(done) {
    const trees = db.collection('trees');
    Promise.all([
      trees.insert({ title: 'birch' }),
      trees.insert({ title: 'oak' })
    ])
      .then(() => {
        trees.remove(
          {
            title: {
              $in: [ 'birch', 'oak' ]
            }
          },
          {},
          (err, result) => {
            try {
              assert.ifError(err);
              const actual = result;
              const expected = {
                acknowledged: true,
                deletedCount: 2,
                result: {
                  getInsertedIds: undefined,
                  getUpsertedIds: undefined,
                  n: 2,
                  nInserted: undefined,
                  nMatched: undefined,
                  nModified: undefined,
                  nRemoved: 2,
                  nUpserted: undefined,
                  ok: 1
                }
              };

              assert.deepEqual(actual, expected);
              done();
            } catch (error) {
              done(error);
            }
          }
        );
      });
  });
  it('collection.remove (promise)', async function() {
    const trees = db.collection('trees');
    await trees.insert({ title: 'birch' });
    await trees.insert({ title: 'oak' });

    const actual = await trees.remove({
      title: {
        $in: [ 'birch', 'oak' ]
      }
    });
    const expected = {
      acknowledged: true,
      deletedCount: 2,
      result: {
        getInsertedIds: undefined,
        getUpsertedIds: undefined,
        n: 2,
        nInserted: undefined,
        nMatched: undefined,
        nModified: undefined,
        nRemoved: 2,
        nUpserted: undefined,
        ok: 1
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('collection.remove single (callback)', function(done) {
    const trees = db.collection('trees');
    Promise.all([
      trees.insert({ title: 'birch' }),
      trees.insert({ title: 'oak' })
    ])
      .then(() => {
        trees.remove(
          {
            title: {
              $in: [ 'birch', 'oak' ]
            }
          },
          {
            single: true
          },
          (err, result) => {
            try {
              assert.ifError(err);
              const actual = result;
              const expected = {
                acknowledged: true,
                deletedCount: 1,
                result: {
                  getInsertedIds: undefined,
                  getUpsertedIds: undefined,
                  n: 1,
                  nInserted: undefined,
                  nMatched: undefined,
                  nModified: undefined,
                  nRemoved: 1,
                  nUpserted: undefined,
                  ok: 1
                }
              };

              assert.deepEqual(actual, expected);
              done();
            } catch (error) {
              done(error);
            }
          }
        );
      });
  });
  it('collection.remove single (promise)', async function() {
    const trees = db.collection('trees');
    await trees.insert({ title: 'birch' });
    await trees.insert({ title: 'oak' });

    const actual = await trees.remove(
      {
        title: {
          $in: [ 'birch', 'oak' ]
        }
      },
      {
        single: true
      }
    );
    const expected = {
      acknowledged: true,
      deletedCount: 1,
      result: {
        getInsertedIds: undefined,
        getUpsertedIds: undefined,
        n: 1,
        nInserted: undefined,
        nMatched: undefined,
        nModified: undefined,
        nRemoved: 1,
        nUpserted: undefined,
        ok: 1
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('collection.rename (callback)', function(done) {
    db.createCollection('leaves')
      .then((leaves) => {
        leaves.rename(
          'branches',
          {},
          function(err, collection) {
            try {
              assert.ifError(err);
              const actual = collection.constructor;
              const expected = mongo.Collection;

              assert.deepEqual(actual, expected);
              done();
            } catch (error) {
              done(error);
            }
          }
        );
      });
  });
  it('collection.rename (promise)', async function() {
    const leaves = await db.createCollection('leaves');

    const collection = await leaves.rename('branches', {});

    const actual = collection.constructor;
    const expected = mongo.Collection;

    assert.deepEqual(actual, expected);
  });

  it('collection.replaceOne (callback)', function(done) {
    const trees = db.collection('trees');
    trees.insert({ title: 'birch' })
      .then(() => {
        trees.replaceOne(
          {
            title: 'birch'
          },
          {},
          (err, result) => {
            try {
              assert.ifError(err);
              const actual = result;
              const expected = {
                acknowledged: true,
                matchedCount: 1,
                modifiedCount: 1,
                result: {
                  getInsertedIds: undefined,
                  getUpsertedIds: undefined,
                  n: 1,
                  nInserted: undefined,
                  nMatched: 1,
                  nModified: 1,
                  nRemoved: undefined,
                  nUpserted: 0,
                  ok: 1
                },
                upsertedCount: 0,
                upsertedId: null
              };

              assert.deepEqual(actual, expected);
              done();
            } catch (error) {
              done(error);
            }
          }
        );
      });
  });
  it('collection.replaceOne (promise)', async function() {
    const trees = db.collection('trees');
    await trees.insert({ title: 'birch' });

    const actual = await trees.replaceOne(
      {
        title: 'birch'
      },
      {
        title: 'oak',
        age: 37
      },
      {}
    );
    const expected = {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      result: {
        getInsertedIds: undefined,
        getUpsertedIds: undefined,
        n: 1,
        nInserted: undefined,
        nMatched: 1,
        nModified: 1,
        nRemoved: undefined,
        nUpserted: 0,
        ok: 1
      },
      upsertedCount: 0,
      upsertedId: null
    };

    assert.deepEqual(actual, expected);
  });

  it('collection.update multi (callback)', function(done) {
    const trees = db.collection('trees');
    Promise.all([
      trees.insert({ title: 'birch' }),
      trees.insert({ title: 'oak' })
    ])
      .then(() => {
        trees.update(
          {
            title: {
              $in: [ 'birch', 'oak' ]
            }
          },
          {
            $set: {
              age: 37
            }
          },
          {
            multi: true
          },
          (err, result) => {
            try {
              assert.ifError(err);
              const actual = result;
              const expected = {
                acknowledged: true,
                matchedCount: 2,
                modifiedCount: 2,
                result: {
                  getInsertedIds: undefined,
                  getUpsertedIds: undefined,
                  n: 2,
                  nInserted: undefined,
                  nMatched: 2,
                  nModified: 2,
                  nRemoved: undefined,
                  nUpserted: 0,
                  ok: 1
                },
                upsertedCount: 0,
                upsertedId: null
              };

              assert.deepEqual(actual, expected);
              done();
            } catch (error) {
              done(error);
            }
          }
        );
      });
  });
  it('collection.update multi (promise)', async function() {
    const trees = db.collection('trees');
    await trees.insert({ title: 'birch' });
    await trees.insert({ title: 'oak' });

    const actual = await trees.update(
      {
        title: {
          $in: [ 'birch', 'oak' ]
        }
      },
      {
        $set: {
          age: 37
        }
      },
      {
        multi: true
      }
    );
    const expected = {
      acknowledged: true,
      matchedCount: 2,
      modifiedCount: 2,
      result: {
        getInsertedIds: undefined,
        getUpsertedIds: undefined,
        nInserted: undefined,
        n: 2,
        nMatched: 2,
        nModified: 2,
        nRemoved: undefined,
        nUpserted: 0,
        ok: 1
      },
      upsertedCount: 0,
      upsertedId: null
    };

    assert.deepEqual(actual, expected);
  });

  it('collection.update (callback)', function(done) {
    const trees = db.collection('trees');
    Promise.all([
      trees.insert({ title: 'birch' }),
      trees.insert({ title: 'oak' })
    ])
      .then(() => {
        trees.update(
          {
            title: {
              $in: [ 'birch', 'oak' ]
            }
          },
          {
            $set: {
              age: 37
            }
          },
          {},
          (err, result) => {
            try {
              assert.ifError(err);
              const actual = result;
              const expected = {
                acknowledged: true,
                matchedCount: 1,
                modifiedCount: 1,
                result: {
                  getInsertedIds: undefined,
                  getUpsertedIds: undefined,
                  n: 1,
                  nInserted: undefined,
                  nMatched: 1,
                  nModified: 1,
                  nRemoved: undefined,
                  nUpserted: 0,
                  ok: 1
                },
                upsertedCount: 0,
                upsertedId: null
              };

              assert.deepEqual(actual, expected);
              done();
            } catch (error) {
              done(error);
            }
          }
        );
      });
  });
  it('collection.update (promise)', async function() {
    const trees = db.collection('trees');
    await trees.insert({ title: 'birch' });
    await trees.insert({ title: 'oak' });

    const actual = await trees.update(
      {
        title: {
          $in: [ 'birch', 'oak' ]
        }
      },
      {
        $set: {
          age: 37
        }
      },
      {}
    );
    const expected = {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      result: {
        getInsertedIds: undefined,
        getUpsertedIds: undefined,
        n: 1,
        nInserted: undefined,
        nMatched: 1,
        nModified: 1,
        nRemoved: undefined,
        nUpserted: 0,
        ok: 1
      },
      upsertedCount: 0,
      upsertedId: null
    };

    assert.deepEqual(actual, expected);
  });
});
