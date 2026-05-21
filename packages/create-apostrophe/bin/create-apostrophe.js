#!/usr/bin/env node

// Node version guard. Kept syntactically minimal so an engine too old to
// parse the rest of the file at least gets a useful message.

const nodeVersion = process && process.versions && process.versions.node;
const major = nodeVersion ? parseInt(nodeVersion.split('.')[0], 10) : NaN;
if (Number.isFinite(major) && major < 20) {
  process.stderr.write(
    'Node.js 20 or newer is required. ' +
    'You are running Node ' + nodeVersion + '.\n' +
    'Please upgrade Node (https://nodejs.org) and try again.\n'
  );
  process.exit(1);
}

// Past the guard — anything newer can run safely now.
const { runCli } = await import('../src/index.js');
const code = await runCli(process.argv);
process.exit(typeof code === 'number' ? code : 0);
