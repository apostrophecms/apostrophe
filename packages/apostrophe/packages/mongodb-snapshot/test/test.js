"use strict";

const uri = 'mongodb://localhost:27017/mongodb-snapshot-test-only';

const { MongoClient } = require('mongodb');

const assert = require('assert');

const { read, write, erase } = require('../index.js');


let client, db;

describe('test mongodb-snapshot', function() {
  before(async function() {
    await connect();
    await erase(db);
  });
  after(async function() {
    await close();
  });
  it('can write a snapshot', async function() {
    const docs = db.collection('docs');
    await docs.insertOne({
      tull: '35 cents please'
    });
    await docs.insertOne({
      tull: 'jethro'
    });
    await docs.insertOne({
      tull: 'unwanted'
    });
    // Test whether indexes are included in shapshots
    await docs.createIndex({
      tull: 1
    }, {
      unique: true
    });
    const cookies = db.collection('cookies');
    await cookies.insertOne({
      name: 'chocolate chip'
    });
    const colors = db.collection('colors');
    await colors.insertOne({
      name: 'blue'
    });
    await write(db, `${__dirname}/test.snapshot`, {
      exclude: [ 'cookies' ],
      filters: {
        docs: {
          tull: {
            $ne: 'unwanted'
          }
        }
      }
    });
  });
  it('can read a snapshot', async function() {
    const docs = db.collection('docs');
    await docs.deleteMany({});
    await docs.dropIndexes();
    const cookies = db.collection('cookies');
    await cookies.deleteMany({});
    await cookies.dropIndexes();
    const colors = db.collection('colors');
    await colors.deleteMany({});
    await colors.dropIndexes();
    await read(db, `${__dirname}/test.snapshot`, { exclude: [ 'colors' ]});
    const result = await docs.find({}).sort({ tull: 1 }).toArray();
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].tull, '35 cents please');
    assert.strictEqual(result[1].tull, 'jethro');
    assert.rejects(async function() {
      // Should be blocked by the index if it was restored properly
      return docs.insertOne({
        tull: 'jethro'
      });
    });
    // Verify exclude option of "write" works
    const foundCookies = await cookies.find({}).toArray();
    assert.strictEqual(foundCookies.length, 0);
    // Verify exclude option of "read" works
    const foundColors = await cookies.find({}).toArray();
    assert.strictEqual(foundColors.length, 0);
  });
});

async function connect() {
  client = new MongoClient(uri);
  await client.connect();
  db = await client.db();
  return db;
}

async function close() {
  await client.close();
}
