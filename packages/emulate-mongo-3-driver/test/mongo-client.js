const assert = require('assert/strict');
const mongo = require('../index.js');

describe('mongo-client', function() {
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

  it('mongoClient.constructor removes warnings', function() {
    const warningListener = warning => {
      if (warning.includes('[MONGODB DRIVER] Warning:')) {
        assert.fail('should not throws warning for deprecated options');
      }
    };
    process.on('warning', warningListener);

    try {
      const options = {
        useUnifiedTopology: true,
        useNewUrlParser: true
      };
      const currentClient = new mongo.MongoClient('mongodb://localhost:27017/testdb', options);
      currentClient.close();
    } finally {
      process.removeListener('warning', warningListener);
    }
  });

  it('mongoClient.connect static (callback)', function(done) {
    mongo.MongoClient.connect(
      'mongodb://localhost:27017/testdb',
      {},
      (err, currentClient) => {
        try {
          assert.ifError(err);
          const actual = currentClient.constructor;
          const expected = mongo.MongoClient;

          assert.deepEqual(actual, expected);
          done();
        } catch (error) {
          done(error);
        } finally {
          currentClient.close();
        }
      }
    );
  });
  it('mongoClient.connect static (promise)', async function() {
    const currentClient = await mongo.MongoClient.connect('mongodb://localhost:27017/testdb', {});

    try {
      const actual = currentClient.constructor;
      const expected = mongo.MongoClient;

      assert.deepEqual(actual, expected);
    } finally {
      currentClient.close();
    }
  });

  it('mongoClient.connect (callback)', function(done) {
    const newClient = new mongo.MongoClient('mongodb://localhost:27017/testdb', {});
    newClient.connect(
      (err, currentClient) => {
        try {
          assert.ifError(err);
          const actual = currentClient.constructor;
          const expected = mongo.MongoClient;

          assert.deepEqual(actual, expected);
          done();
        } catch (error) {
          done(error);
        } finally {
          currentClient.close();
        }
      }
    );
  });
  it('mongoClient.connect (promise)', async function() {
    const newClient = new mongo.MongoClient('mongodb://localhost:27017/testdb', {});
    const currentClient = await newClient.connect();

    try {
      const actual = currentClient.constructor;
      const expected = mongo.MongoClient;

      assert.deepEqual(actual, expected);
    } finally {
      currentClient.close();
    }
  });

  it('mongoClient.db', function() {
    const currentDb = client.db('testdb', {});

    const actual = currentDb.constructor;
    const expected = mongo.Db;

    assert.deepEqual(actual, expected);
  });
});
