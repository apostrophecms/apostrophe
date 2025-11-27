const assert = require('assert/strict');
const mongo = require('../index.js');

describe('find-cursor', function() {
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

  it('findCursor.count (callback)', function(done) {
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

        trees.find({ type: 'shrub' }).count(
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
  it('findCursor.count (promise)', async function() {
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
      tree: await trees.find({ type: 'tree' }).count(),
      shrub: await trees.find({ type: 'shrub' }).count(),
      all: await trees.find().count()
    };
    const expected = {
      tree: 2,
      shrub: 1,
      all: 3
    };

    assert.deepEqual(actual, expected);
  });

  it('findCursor.sort (callback)', function(done) {
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

        trees
          .find({ type: 'tree' })
          .sort('title', -1)
          .toArray(
            (err, result) => {
              try {
                assert.ifError(err);
                const actual = result;
                const expected = [
                  {
                    _id: actual.at(0)._id,
                    title: 'oak',
                    type: 'tree'
                  },
                  {
                    _id: actual.at(1)._id,
                    title: 'birch',
                    type: 'tree'
                  }
                ];

                assert.deepEqual(actual, expected);
                done();
              } catch (error) {
                done(error);
              }
            }
          );
      }
    );
  });
  it('findCursor.sort (promise)', async function() {
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

    const actual = await trees
      .find({ type: 'tree' }, { title: 1 })
      .sort('title', -1)
      .toArray();
    const expected = [
      {
        _id: actual.at(0)._id,
        title: 'oak',
        type: 'tree'
      },
      {
        _id: actual.at(1)._id,
        title: 'birch',
        type: 'tree'
      }
    ];

    assert.deepEqual(actual, expected);
  });
});
