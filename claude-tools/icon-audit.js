#!/usr/bin/env node
// Audit registered icons vs actual references in the apostrophe package.
// Occurrence-based: an icon is "used" if its name appears in any line that is
// NOT an icons-registration line (`'name': 'ComponentName'`). Catches
// `icon: 'x'`, icon="x", :icon="'x'" and <x-icon> component tags.
const fs = require('fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.join(__dirname, '../packages/apostrophe/modules');
const globalIconsFile = path.join(ROOT, '@apostrophecms/asset/lib/globalIcons.js');

// ---- collect registered icon names ----
const registered = new Map(); // name -> component
function collectFrom(text) {
  const re = /['"]([a-z0-9][a-z0-9-]*)['"]\s*:\s*['"]([A-Z][A-Za-z0-9]*)['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!registered.has(m[1])) registered.set(m[1], m[2]);
  }
}
collectFrom(fs.readFileSync(globalIconsFile, 'utf8'));
const indexFiles = execSync(`grep -rlE "icons:\\s*\\{" "${ROOT}" --include=index.js`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
for (const f of indexFiles) {
  const text = fs.readFileSync(f, 'utf8');
  const idx = text.indexOf('icons:');
  const brace = text.indexOf('{', idx);
  let depth = 0; let end = -1;
  for (let i = brace; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  collectFrom(text.slice(brace, end + 1));
}

// Known runtime-built names -> treat as used.
const DYNAMIC_USED = new Set();
for (const n of [ 'left', 'right', 'top', 'bottom', 'window' ]) DYNAMIC_USED.add(`dock-${n}-icon`);

// Is this line a registration of `name` (name: 'Component')?
const isRegLine = (line, name) =>
  new RegExp(`['"]${name}['"]\\s*:\\s*['"][A-Z]`).test(line);

const used = new Map();
const unused = [];
for (const [ name ] of registered) {
  let lines = [];
  try {
    lines = execSync(
      `grep -rnF "${name}" "${ROOT}" --include=*.js --include=*.vue --include=*.scss --include=*.html`,
      { encoding: 'utf8' }
    ).trim().split('\n').filter(Boolean);
  } catch (e) { lines = []; }
  // Keep only reference lines: contain the name but are NOT a registration of it.
  const refs = lines.filter((l) => !isRegLine(l, name));
  if (refs.length > 0 || DYNAMIC_USED.has(name)) {
    used.set(name, refs.length + (DYNAMIC_USED.has(name) ? 1 : 0));
  } else {
    unused.push(name);
  }
}

console.log(`Registered icons: ${registered.size} (globalIcons has 148)`);
console.log(`Referenced (used): ${used.size}`);
console.log(`Never referenced:  ${unused.length}\n`);
console.log('=== UNUSED (no non-registration reference anywhere in core) ===');
console.log(unused.sort().join('\n'));
