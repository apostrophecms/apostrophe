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

  const data = await dump(uri);

  if (output) {
    fs.writeFileSync(output, data);
  } else {
    process.stdout.write(data);
  }
}
