// This script was used to rename all the apostrophe module folders

const fs = require('fs');

const modules = fs.readdirSync('lib/modules');
for (const module of modules) {
  if (module.match(/^apostrophecms-/)) {
    const namespaced = module.replace(/^apostrophecms-/, '');
    rename(`lib/modules/${module}`, `lib/modules/@apostrophecms/${namespaced}`);
  }
}

function rename(from, to) {
  console.log(`${from} -> ${to}`);
  fs.renameSync(from, to);
}
