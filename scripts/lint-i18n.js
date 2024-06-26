const { globSync } = require('glob');
const fs = require('fs');
let keys = Object.keys(require('../modules/@apostrophecms/i18n/i18n/en.json'));
// Core apostrophe events look like keys
keys = [ ...keys, 'destroy', 'ready', 'modulesRegistered', 'afterInit', 'modulesReady', 'run', 'boot', 'beforeExit' ];
const files = globSync('**/*.@(js|vue|html)', { ignore: [ './index.js', '**/node_modules/**/*', 'coverage/**/*' ] }).sort();

const undeclared = new Set();
const used = new Set([ 'afterInit', 'modulesReady' ]);

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const found = code.matchAll(/apostrophe:\w+/g);
  for (const match of found) {
    const key = match[0].replace('apostrophe:', '');
    if (!keys.includes(key)) {
      undeclared.add(key);
    } else {
      used.add(key);
    }
  }
}

const ignoreUnused = [ 'boot', 'beforeExit' ];

const unused = keys.filter(key => !used.has(key)).filter(key => !used.has(key.replace('_plural', ''))).filter(key => !ignoreUnused.includes(key));
if ((!undeclared.size) && (!unused.length)) {
  process.exit(0);
}

console.error('Undefined:\n');
console.error([ ...undeclared ].join('\n'));
console.error('\nUnused:\n');
for (const key of unused) {
  console.log(key, used.has(key), used.has(key.replace('_plural', '')), ignoreUnused.includes(key));
}
console.error(unused.join('\n'));
process.exit(1);
