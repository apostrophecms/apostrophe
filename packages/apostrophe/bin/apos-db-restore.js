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
  const inputArg = args.find(a => a.startsWith('--input='));
  const input = inputArg ? inputArg.split('=')[1] : null;

  if (!uri) {
    throw new Error('Usage: apos-db-restore <uri> [--input=filename]');
  }

  const client = await dbConnect(uri);
  try {
    const db = client.db();
    const lines = readLines(input);
    let currentCollection = null;
    let col = null;
    let batch = [];

    for (const line of lines) {
      const entry = JSON.parse(line);

      if (entry._doc) {
        // Document line
        batch.push(deserializeValue(entry._doc));
        if (batch.length >= BATCH_SIZE) {
          await col.insertMany(batch);
          batch = [];
        }
      } else if (entry._collection) {
        // Collection header — flush previous batch and set up new collection
        if (batch.length > 0) {
          await col.insertMany(batch);
          batch = [];
        }

        currentCollection = entry._collection;
        col = db.collection(currentCollection);

        try {
          await col.drop();
        } catch (e) {
          // Collection may not exist, ignore
        }

        // Restore indexes
        if (entry._indexes && entry._indexes.length > 0) {
          for (const idx of entry._indexes) {
            const options = {};
            if (idx.name) {
              // Sanitize for cross-backend compatibility: replace characters
              // that are valid in MongoDB index names but not in PostgreSQL,
              // and truncate to 63 characters (PostgreSQL identifier limit)
              options.name = idx.name
                .replace(/[^a-zA-Z0-9_]/g, '_')
                .substring(0, 63);
            }
            if (idx.unique) {
              options.unique = true;
            }
            if (idx.sparse) {
              options.sparse = true;
            }
            if (idx.type) {
              options.type = idx.type;
            }
            await col.createIndex(idx.key, options);
          }
        }
      }
    }

    // Flush remaining batch
    if (batch.length > 0 && col) {
      await col.insertMany(batch);
    }
  } finally {
    await client.close();
  }
}

function * readLines(input) {
  const content = input
    ? fs.readFileSync(input, 'utf8')
    : fs.readFileSync('/dev/stdin', 'utf8');
  for (const line of content.split('\n')) {
    if (line.trim()) {
      yield line;
    }
  }
}

function deserializeValue(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj.$date) {
    return new Date(obj.$date);
  }
  if (Array.isArray(obj)) {
    return obj.map(deserializeValue);
  }
  const result = {};
  for (const [ k, v ] of Object.entries(obj)) {
    result[k] = deserializeValue(v);
  }
  return result;
}
