// Quick syntax check for every .jsx template under public-demo. Loads
// each via the same JSX loader used in production and reports compile
// errors with proper file/line info.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const apostropheRoot = path.resolve(here, '..');
const require = createRequire(path.join(apostropheRoot, 'packages/apostrophe/index.js'));

const { install } = require(path.join(apostropheRoot, 'packages/apostrophe/modules/@apostrophecms/template/lib/jsxLoader.js'));
install();

const demoRoot = '/srv/workspace/apostrophecms/public-demo';

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'data') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.name.endsWith('.jsx')) {
      yield full;
    }
  }
}

let failed = 0;
for (const file of walk(demoRoot)) {
  try {
    require(file);
    console.log('OK ', file);
  } catch (err) {
    failed += 1;
    console.error('FAIL', file);
    console.error('   ', err.message);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 5).join('\n'));
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) failed to compile/load.`);
  process.exit(1);
}
console.log(`\nAll JSX templates loaded successfully.`);
