#!/usr/bin/env node

const fs = require('fs');
const dump = require('../lib/dump');

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

  // Stream NDJSON lines directly to the sink so a large dump never sits
  // fully in memory.
  const sink = output
    ? fs.createWriteStream(output)
    : process.stdout;

  try {
    for await (const line of dump(uri)) {
      if (!sink.write(line + '\n')) {
        await new Promise(resolve => sink.once('drain', resolve));
      }
    }
  } finally {
    if (output) {
      await new Promise((resolve, reject) => {
        sink.end(err => err ? reject(err) : resolve());
      });
    }
  }
}
