#!/usr/bin/env node
// Detect packages bundled more than once (via different node_modules roots
// or CJS+ESM copies). Usage: node claude-tools/bundle-dupes.js <bundle.js>
const fs = require('fs');
const { SourceMapConsumer } = require('source-map');
const bundlePath = process.argv[2];
const code = fs.readFileSync(bundlePath, 'utf8');
const rawMap = JSON.parse(fs.readFileSync(`${bundlePath}.map`, 'utf8'));
const lines = code.split('\n');
const lineLengths = lines.map((l) => Buffer.byteLength(l, 'utf8'));
const consumer = new SourceMapConsumer(rawMap);
const byLine = new Map();
consumer.eachMapping((m) => {
  if (!byLine.has(m.generatedLine)) byLine.set(m.generatedLine, []);
  byLine.get(m.generatedLine).push(m);
});
const perSource = new Map();
for (let line = 1; line <= lines.length; line++) {
  const lineLen = lineLengths[line - 1] + 1;
  const maps = byLine.get(line);
  if (!maps) continue;
  maps.sort((a, b) => a.generatedColumn - b.generatedColumn);
  for (let i = 0; i < maps.length; i++) {
    const start = maps[i].generatedColumn;
    const end = i + 1 < maps.length ? maps[i + 1].generatedColumn : lineLen;
    if (maps[i].source != null) {
      perSource.set(maps[i].source, (perSource.get(maps[i].source) || 0) + Math.max(0, end - start));
    }
  }
}

// For each package, track distinct "roots" (node_modules dir) and bytes.
const pkgRoots = new Map(); // pkg -> Map(root -> bytes)
for (const [ src, n ] of perSource) {
  const s = src.replace(/\\/g, '/');
  const idx = s.lastIndexOf('node_modules/');
  if (idx === -1) continue;
  const root = s.slice(0, idx + 'node_modules/'.length);
  let rest = s.slice(idx + 'node_modules/'.length).split('/');
  const pkg = rest[0].startsWith('@') ? rest[0] + '/' + rest[1] : rest[0];
  if (!pkgRoots.has(pkg)) pkgRoots.set(pkg, new Map());
  const rm = pkgRoots.get(pkg);
  rm.set(root, (rm.get(root) || 0) + n);
}

const dupes = [];
for (const [ pkg, roots ] of pkgRoots) {
  if (roots.size > 1) {
    const total = [ ...roots.values() ].reduce((a, b) => a + b, 0);
    const min = Math.min(...roots.values());
    dupes.push({ pkg, roots, total, wasted: total - Math.max(...roots.values()) });
  }
}
dupes.sort((a, b) => b.wasted - a.wasted);
console.log('=== DUPLICATED PACKAGES (bundled from >1 location) ===');
let totalWasted = 0;
for (const d of dupes) {
  totalWasted += d.wasted;
  console.log(`\n${d.pkg}  — total ${(d.total / 1024).toFixed(1)} KB, ~${(d.wasted / 1024).toFixed(1)} KB duplicated`);
  for (const [ root, n ] of [ ...d.roots.entries() ].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${(n / 1024).toFixed(1).padStart(8)} KB  ${root}`);
  }
}
console.log(`\n=== Approx total duplicated waste: ${(totalWasted / 1024).toFixed(1)} KB ===`);
