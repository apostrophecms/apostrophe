const glob = require('glob');
const fs = require('fs');
let keys = Object.keys(require('../modules/@apostrophecms/i18n/i18n/en.json'));
// Core apostrophe events look like keys
keys = [ ...keys, 'destroy', 'ready', 'modulesRegistered', 'afterInit', 'modulesReady', 'run' ];
const files = glob.sync('**/*.@(js|vue|html)', { ignore: [ '**/node_modules/**/*', 'coverage/**/*' ] });

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

const unused = keys.filter(key => !used.has(key) && !used.has(key.replace('_plural', '')));
if ((!undeclared.size) && (!unused.length)) {
  process.exit(0);
}

console.error('Undefined:\n');
console.error([ ...undeclared ].join('\n'));
console.error('\nUnused:\n');
console.error(unused.join('\n'));
process.exit(1);
