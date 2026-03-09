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
  const outputArg = args.find(a => a.startsWith('--output='));
  const output = outputArg ? outputArg.split('=')[1] : null;

  if (!uri) {
    throw new Error('Usage: apos-db-dump <uri> [--output=filename]');
  }

  const client = await dbConnect(uri);
  try {
    const db = client.db();
    const collections = await db.listCollections().toArray();
    const lines = [];

    for (const collInfo of collections) {
      const name = collInfo.name;
      const docs = await db.collection(name).find({}).toArray();
      lines.push(JSON.stringify({
        _collection: name,
        _docs: docs.map(serializeValue)
      }));
    }

    const content = lines.join('\n') + '\n';
    if (output) {
      fs.writeFileSync(output, content);
    } else {
      process.stdout.write(content);
    }
  } finally {
    await client.close();
  }
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
