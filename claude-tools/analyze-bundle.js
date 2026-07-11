#!/usr/bin/env node
// Byte-attribution bundle analyzer (source-map-explorer style).
// Usage: node claude-tools/analyze-bundle.js <bundle.js> [bundle.js.map]
//
// Parses the source map and attributes each byte of the minified bundle to
// the original source that produced it, then groups by npm package and by
// Apostrophe module so we can see where the weight is.
const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

const bundlePath = process.argv[2];
const mapPath = process.argv[3] || `${bundlePath}.map`;
if (!bundlePath) {
  console.error('Usage: analyze-bundle.js <bundle.js> [bundle.js.map]');
  process.exit(1);
}

const code = fs.readFileSync(bundlePath, 'utf8');
const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const lines = code.split('\n');
// Byte length of each generated line (utf8) for tail attribution.
const lineLengths = lines.map((l) => Buffer.byteLength(l, 'utf8'));

const consumer = new SourceMapConsumer(rawMap);

// Collect mappings grouped by generated line.
const byLine = new Map();
consumer.eachMapping((m) => {
  if (!byLine.has(m.generatedLine)) {
    byLine.set(m.generatedLine, []);
  }
  byLine.get(m.generatedLine).push(m);
});

const perSource = new Map();
let unmapped = 0;

function add(map, key, n) {
  map.set(key, (map.get(key) || 0) + n);
}

for (let line = 1; line <= lines.length; line++) {
  const lineLen = lineLengths[line - 1] + 1; // include the '\n'
  const maps = byLine.get(line);
  if (!maps || maps.length === 0) {
    unmapped += lineLen;
    continue;
  }
  maps.sort((a, b) => a.generatedColumn - b.generatedColumn);
  // Bytes before the first mapping on this line are unmapped.
  if (maps[0].generatedColumn > 0) {
    unmapped += maps[0].generatedColumn;
  }
  for (let i = 0; i < maps.length; i++) {
    const start = maps[i].generatedColumn;
    const end = i + 1 < maps.length ? maps[i + 1].generatedColumn : lineLen;
    const n = Math.max(0, end - start);
    if (maps[i].source == null) {
      unmapped += n;
    } else {
      add(perSource, maps[i].source, n);
    }
  }
}

consumer.destroy && consumer.destroy();

// ---- Grouping helpers ----
function normalize(src) {
  return src.replace(/\\/g, '/');
}

// Group by npm package or apostrophe module.
function bucketOf(src) {
  const s = normalize(src);
  // node_modules dependency
  const nm = s.lastIndexOf('node_modules/');
  if (nm !== -1) {
    let rest = s.slice(nm + 'node_modules/'.length);
    // pnpm layout: .pnpm/<pkg>@<ver>/node_modules/<realpkg>/...
    const parts = rest.split('/');
    let pkg;
    if (parts[0].startsWith('@')) {
      pkg = parts[0] + '/' + parts[1];
    } else {
      pkg = parts[0];
    }
    return { group: 'npm', name: pkg };
  }
  // Apostrophe admin UI source: .../<module>/ui/apos/...
  const m = s.match(/\/((?:@[^/]+\/)?[^/]+)\/ui\/(apos|src)\//);
  if (m) {
    return { group: 'aposui', name: m[1] };
  }
  // apos-build generated src copies: src/@apostrophecms/<module>/...
  const b = s.match(/\/src\/(@[^/]+\/[^/]+|[^/@][^/]*)\//);
  if (b) {
    return { group: 'aposbuild', name: b[1] };
  }
  return { group: 'other', name: s.split('/').slice(-2).join('/') };
}

const perPackage = new Map();
const perModule = new Map();
for (const [ src, n ] of perSource) {
  const b = bucketOf(src);
  if (b.group === 'npm') {
    add(perPackage, b.name, n);
  } else {
    add(perModule, b.name, n);
  }
}

function report(title, map, limit) {
  const rows = [ ...map.entries() ].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [ , n ]) => s + n, 0);
  console.log(`\n=== ${title} (total ${(total / 1024).toFixed(1)} KB across ${rows.length}) ===`);
  for (const [ name, n ] of rows.slice(0, limit)) {
    console.log(`${(n / 1024).toFixed(1).padStart(9)} KB  ${(100 * n / bundleBytes).toFixed(1).padStart(5)}%  ${name}`);
  }
}

const bundleBytes = Buffer.byteLength(code, 'utf8');
console.log(`Bundle: ${bundlePath}`);
console.log(`Minified size: ${(bundleBytes / 1024).toFixed(1)} KB (${bundleBytes} bytes)`);
console.log(`Unmapped/runtime bytes: ${(unmapped / 1024).toFixed(1)} KB`);

report('NPM DEPENDENCIES', perPackage, 40);
report('APOSTROPHE MODULES / UI', perModule, 40);

// Top individual sources
const topSources = [ ...perSource.entries() ]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40);
console.log('\n=== TOP INDIVIDUAL SOURCE FILES ===');
for (const [ src, n ] of topSources) {
  const short = normalize(src).replace(/.*\/node_modules\//, 'nm:').replace(/.*\/apos-build\/[^/]+\/[^/]+\/[^/]+\//, '');
  console.log(`${(n / 1024).toFixed(1).padStart(9)} KB  ${short}`);
}
