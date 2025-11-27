"use strict";

const readline = require('readline');
const { EJSON } = require('bson');

const { createReadStream, createWriteStream } = require('fs');
const assert = require('assert');

module.exports = {
  async read(db, filename, { exclude = null } = {}) {
    const input = createReadStream(filename);
    const rl = readline.createInterface({
      input,
      crlfDelay: Infinity
    });

    let collectionName;
    let collection;
    let version;
    let skipCollection;

    for await (const line of rl) {
      const data = EJSON.parse(line);
      if (data.metaType === 'version') {
        assert.strictEqual(data.value, 1);
        version = data.value;
      } else if (data.metaType === 'collection') {
        assert(version);
        collectionName = data.value;
        collection = db.collection(collectionName);
        skipCollection = exclude && exclude.includes(collectionName);
      } else if (data.metaType === 'index') {
        assert(collection);
        if (skipCollection) {
          continue;
        }
        const {
          key,
          v,
          ...rest
        } = data.value;
        await collection.createIndex(key, rest);
      } else if (data.metaType === 'doc') {
        assert(collection);
        if (skipCollection) {
          continue;
        }
        await collection.insertOne(data.value);
      }
    }
  },
  async write(db, filename, { exclude = null, filters = {} } = {}) {
    const output = createWriteStream(filename);
    const collectionsInfo = await db.listCollections().toArray();
    const collectionNames = collectionsInfo.map(({ name }) => name);
    await write('version', 1);
    for (const name of collectionNames) {
      if (exclude && exclude.includes(name)) {
        continue;
      }
      const collection = db.collection(name);
      await write('collection', name);
      const indexes = await collection.listIndexes().toArray();
      const filter = Object.hasOwn(filters, name) ? filters[name] : {};
      for (const index of indexes) {
        await write('index', index);
      }
      // Get all the _id properties in one go. In theory, we could run out of RAM
      // here, but that is very unlikely at a database size that would be encountered
      // in Apostrophe.
      const idsInfo = await collection.find({}, { _id: 1 }).toArray();
      const _ids = idsInfo.map(({ _id }) => _id);
      for (const _id of _ids) {
        const doc = await collection.findOne({
          _id,
          $and: [
            filter
          ]
        });
        if (doc) {
          await write('doc', doc);
        } else {
          // This is not an error, documents do go away between operations sometimes
        }
      }
    }
    async function write(metaType, value) {
      const ready = output.write(EJSON.stringify({
        metaType,
        value
      }) + '\n');
      // Handle backpressure so we don't buffer the entire database into RAM
      if (!ready) {
        await new Promise(resolve => {
          output.once('drain', () => resolve());
        });
      }
    }
    output.end();
    await new Promise((resolve, reject) => {
      output.on('finish', () => resolve());
      output.on('error', e => reject(e));
    });
  },
  async erase(db) {
    const collectionsInfo = await db.listCollections().toArray();
    const collectionNames = collectionsInfo.map(({ name }) => name);
    for (const name of collectionNames) {
      const collection = db.collection(name);
      await collection.drop();
    }
  }
}
