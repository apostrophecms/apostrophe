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

  const data = input
    ? fs.readFileSync(input, 'utf8')
    : fs.readFileSync('/dev/stdin', 'utf8');

  await restore(uri, data);
}
