#!/usr/bin/env node

const fs = require('fs');
const dbConnect = require('../lib/db-connect');

const BATCH_SIZE = 100;

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err.message || err);
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);
  const uri = args.find(a => !a.startsWith('--'));
  const outputArg = args.find(a => a.startsWith('--output='));
  const output = outputArg ? outputArg.split('=')[1] : null;

  if (!uri) {
    throw new Error('Usage: apos-db-dump <uri> [--output=filename]');
  }

  const client = await dbConnect(uri);
  const stream = output ? fs.createWriteStream(output) : process.stdout;
  try {
    const db = client.db();
    const collections = await db.listCollections().toArray();

    for (const collInfo of collections) {
      const name = collInfo.name;
      const col = db.collection(name);
      const indexes = await col.indexes();
      const customIndexes = indexes.filter(idx => idx.name !== '_id_');

      // Write collection header
      const header = { _collection: name };
      if (customIndexes.length > 0) {
        header._indexes = customIndexes;
      }
      write(stream, JSON.stringify(header));

      // Write docs in batches, sorted by _id for deterministic output
      let lastId = null;
      while (true) {
        const query = lastId ? { _id: { $gt: lastId } } : {};
        const batch = await col.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).toArray();
        if (batch.length === 0) {
          break;
        }
        for (const doc of batch) {
          write(stream, JSON.stringify({
            _collection: name,
            _doc: serializeValue(doc)
          }));
        }
        lastId = batch[batch.length - 1]._id;
        if (batch.length < BATCH_SIZE) {
          break;
        }
      }
    }

    // Wait for output stream to finish if writing to file
    if (output) {
      await new Promise((resolve, reject) => {
        stream.end(resolve);
        stream.on('error', reject);
      });
    }
  } finally {
    await client.close();
  }
}

function write(stream, line) {
  stream.write(line + '\n');
}

function serializeValue(obj) {
  if (obj instanceof Date) {
    return { $date: obj.toISOString() };
  }
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeValue);
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [ k, v ] of Object.entries(obj)) {
      result[k] = serializeValue(v);
    }
    return result;
  }
  return obj;
}
