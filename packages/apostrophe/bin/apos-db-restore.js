#!/usr/bin/env node

const fs = require('fs');
const dbConnect = require('../lib/db-connect');

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

  let content;
  if (input) {
    content = fs.readFileSync(input, 'utf8');
  } else {
    content = fs.readFileSync('/dev/stdin', 'utf8');
  }

  const lines = content.split('\n').filter(line => line.trim());

  const client = await dbConnect(uri);
  try {
    const db = client.db();

    for (const line of lines) {
      const { _collection, _docs } = JSON.parse(line);
      const col = db.collection(_collection);

      try {
        await col.drop();
      } catch (e) {
        // Collection may not exist, ignore
      }

      if (_docs && _docs.length > 0) {
        await col.insertMany(_docs.map(deserializeValue));
      }
    }
  } finally {
    await client.close();
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
