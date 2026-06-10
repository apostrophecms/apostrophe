#!/usr/bin/env node

const fs = require('fs');
const restore = require('../lib/restore');

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

  // Stream the dump into restore() line-by-line so a large dump never
  // sits fully in memory. restore() accepts any Readable stream.
  const source = input
    ? fs.createReadStream(input, { encoding: 'utf8' })
    : process.stdin;

  await restore(uri, source);
}
