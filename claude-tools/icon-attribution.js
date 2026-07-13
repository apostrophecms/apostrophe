#!/usr/bin/env node
// For each global catch-all icon (globalIcons.js), find which module(s)
// reference it (excluding registration lines). Answers: can each used global
// icon be attributed to a module's `icons:` section? Categorizes by fan-out.
const fs = require('fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.join(__dirname, '../packages/apostrophe/modules');
const globalIconsFile = path.join(ROOT, '@apostrophecms/asset/lib/globalIcons.js');

// global icon names
const names = [];
{
  const re = /['"]([a-z0-9][a-z0-9-]*)['"]\s*:\s*['"][A-Z][A-Za-z0-9]*['"]/g;
  const text = fs.readFileSync(globalIconsFile, 'utf8');
  let m;
  while ((m = re.exec(text)) !== null) names.push(m[1]);
}

// Icons referenced only via runtime-built names (can't be grepped literally).
const DYNAMIC = new Set([ 'dock-left-icon', 'dock-right-icon', 'dock-window-icon' ]);

const moduleOf = (p) => {
  const m = p.replace(/\\/g, '/').match(/\/modules\/((?:@[^/]+\/)?[^/]+)\//);
  return m ? m[1] : '(unknown)';
};
const isRegLine = (line, name) => new RegExp(`['"]${name}['"]\\s*:\\s*['"][A-Z]`).test(line);

const attribution = new Map(); // name -> Set(modules)
for (const name of names) {
  let lines = [];
  try {
    lines = execSync(
      `grep -rnF "${name}" "${ROOT}" --include=*.js --include=*.vue --include=*.html`,
      { encoding: 'utf8' }
    ).trim().split('\n').filter(Boolean);
  } catch (e) { /* no hits */ }
  const mods = new Set();
  for (const line of lines) {
    const file = line.split(':')[0];
    if (file.endsWith('globalIcons.js')) continue;
    if (isRegLine(line, name)) continue; // skip a module's own icons: registration
    mods.add(moduleOf(file));
  }
  if (DYNAMIC.has(name)) mods.add('@apostrophecms/widget-type (dynamic dock-*)');
  attribution.set(name, mods);
}

const unused = [ ...attribution ].filter(([ , m ]) => m.size === 0).map(([ n ]) => n);
const single = [ ...attribution ].filter(([ , m ]) => m.size === 1);
const multi = [ ...attribution ].filter(([ , m ]) => m.size > 1);

console.log(`Global icons: ${names.length}`);
console.log(`  used by exactly ONE module: ${single.length}  (trivially movable)`);
console.log(`  used by MULTIPLE modules:   ${multi.length}  (common; declare in each, or keep small shared set)`);
console.log(`  used by NO module (dead):   ${unused.length}`);

console.log('\n=== single-module icons (icon -> module) ===');
for (const [ n, m ] of single.sort((a, b) => [ ...a[1] ][0].localeCompare([ ...b[1] ][0]))) {
  console.log(`  ${n.padEnd(34)} ${[ ...m ][0]}`);
}
console.log('\n=== multi-module icons (fan-out) ===');
for (const [ n, m ] of multi.sort((a, b) => b[1].size - a[1].size)) {
  console.log(`  ${n.padEnd(34)} (${m.size}) ${[ ...m ].join(', ')}`);
}
console.log('\n=== dead (no reference) ===');
console.log('  ' + unused.sort().join('\n  '));
