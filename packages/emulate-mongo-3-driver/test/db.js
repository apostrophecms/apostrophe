const assert = require('assert/strict');
const mongo = require('../index.js');

describe('db', function() {
  let client;
  let db;

  afterEach(async function() {
    const collections = await db.collections();
    await Promise.all(
      collections.map(collection => db.dropCollection(collection.collectionName))
    );
    await client.close();
  });

  beforeEach(async function() {
    client = new mongo.MongoClient('mongodb://localhost:27017/testdb', {});
    await client.connect();
    db = client.db();
  });

  it('db.collections (callback)', function(done) {
    db.collections(
      {},
      function(err, collections) {
        try {
          assert.ifError(err);
          const actual = collections.map(collection => collection.constructor);
          const expected = Array(collections.length).fill(mongo.Collection);

          assert.deepEqual(actual, expected);
          done();
        } catch (error) {
          done(error);
        }
      }
    );
  });
  it('db.collections (promise)', async function() {
    const collections = await db.collections();

    const actual = collections.map(collection => collection.constructor);
    const expected = Array(collections.length).fill(mongo.Collection);

    assert.deepEqual(actual, expected);
  });

  it('db.collection (callback)', function(done) {
    db.collection(
      'trees',
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
  it('db.collection (promise)', async function() {
    const collection = await db.collection('trees', {});

    const actual = collection.constructor;
    const expected = mongo.Collection;

    assert.deepEqual(actual, expected);
  });

  it('db.createCollection (callback)', function(done) {
    db.createCollection(
      'leaves',
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
  it('db.createCollection (promise)', async function() {
    const collection = await db.createCollection('leaves', {});

    const actual = collection.constructor;
    const expected = mongo.Collection;

    assert.deepEqual(actual, expected);
  });

  it('db.ensureIndex (callback)', function(done) {
    db.ensureIndex(
      'location_2dsphere',
      {
        location: '2dsphere'
      },
      {},
      (err, index) => {
        try {
          assert.ifError(err);
          const actual = index;
          const expected = 'location_2dsphere';

          assert.equal(actual, expected);
          done();
        } catch (error) {
          done(error);
        }
      }
    );
  });
  it('db.ensureIndex (promise)', async function() {
    const actual = await db.ensureIndex(
      'location_2dsphere',
      {
        location: '2dsphere'
      }
    );
    const expected = 'location_2dsphere';

    assert.equal(actual, expected);
  });

  it('db.renameCollection (callback)', function(done) {
    db.createCollection('leaves')
      .then(() => {
        db.renameCollection(
          'leaves',
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
  it('db.renameCollection (promise)', async function() {
    await db.createCollection('leaves');

    const collection = await db.renameCollection('leaves', 'branches', {});

    const actual = collection.constructor;
    const expected = mongo.Collection;

    assert.deepEqual(actual, expected);
  });
});
