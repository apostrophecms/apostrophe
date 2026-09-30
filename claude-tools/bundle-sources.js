#!/usr/bin/env node
// Dump per-source byte attribution with FULL paths, optionally filtered.
// Usage: node claude-tools/bundle-sources.js <bundle.js> [filterSubstring]
const fs = require('fs');
const { SourceMapConsumer } = require('source-map');

const bundlePath = process.argv[2];
const filter = process.argv[3];
const mapPath = `${bundlePath}.map`;
const code = fs.readFileSync(bundlePath, 'utf8');
const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
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
let rows = [ ...perSource.entries() ].sort((a, b) => b[1] - a[1]);
if (filter) rows = rows.filter(([ s ]) => s.includes(filter));
for (const [ src, n ] of rows) {
  console.log(`${(n / 1024).toFixed(2).padStart(9)} KB  ${src}`);
}
