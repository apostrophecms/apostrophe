#!/usr/bin/env node

const nodeVersion = process && process.versions && process.versions.node;
const major = nodeVersion ? parseInt(nodeVersion.split('.')[0], 10) : NaN;
// Only hard-fail a positively-identified old Node. An unknown/non-Node
// runtime (no process.versions.node) is unsupported but is not crashed or
// false-blocked here — it proceeds best-effort.
if (Number.isFinite(major) && major < 20) {
  process.stderr.write(
    'create-apostrophe requires Node.js 20 or newer. ' +
    'You are running Node ' + nodeVersion + '.\n' +
    'Please upgrade Node (https://nodejs.org) and try again.\n'
  );
  process.exit(1);
}

// Skeleton placeholder. argv parsing + the guided flow wire up later, loaded
// via dynamic import so nothing newer than the guard runs before the check.
console.log('create-apostrophe: skeleton placeholder. Nothing to do yet.');
process.exit(0);
