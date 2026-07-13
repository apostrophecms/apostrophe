#!/usr/bin/env node
// Categorized breakdown of the admin bundle: groups npm deps into logical
// subsystems and apostrophe UI by module.
// Usage: node claude-tools/bundle-breakdown.js <bundle.js>
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
let unmapped = 0;
for (let line = 1; line <= lines.length; line++) {
  const lineLen = lineLengths[line - 1] + 1;
  const maps = byLine.get(line);
  if (!maps) { unmapped += lineLen; continue; }
  maps.sort((a, b) => a.generatedColumn - b.generatedColumn);
  if (maps[0].generatedColumn > 0) unmapped += maps[0].generatedColumn;
  for (let i = 0; i < maps.length; i++) {
    const start = maps[i].generatedColumn;
    const end = i + 1 < maps.length ? maps[i + 1].generatedColumn : lineLen;
    const n = Math.max(0, end - start);
    if (maps[i].source == null) unmapped += n;
    else perSource.set(maps[i].source, (perSource.get(maps[i].source) || 0) + n);
  }
}
const bundleBytes = Buffer.byteLength(code, 'utf8');

// Categorize each source.
const CATEGORIES = [
  [ 'Vue framework', /node_modules\/(@vue\/|vue\/|pinia\/|@vue$)/ ],
  [ 'Rich text editor (tiptap/prosemirror)', /node_modules\/(@tiptap\/|prosemirror-|tippy\.js|@popperjs|linkifyjs|rope-sequence|w3c-keyname|orderedmap|crelt)/ ],
  [ 'Material design icons', /vue-material-design-icons/ ],
  [ 'Image cropper', /vue-advanced-cropper/ ],
  [ 'Drag & drop (sortable)', /node_modules\/(sortablejs)/ ],
  [ 'Floating UI (tooltips/menus)', /node_modules\/@floating-ui/ ],
  [ 'i18n (i18next)', /node_modules\/(i18next|void-elements)/ ],
  [ 'Color (tinycolor)', /node_modules\/@ctrl\/tinycolor/ ],
  [ 'Date (dayjs)', /node_modules\/dayjs/ ],
  [ 'Breakpoint preview', /node_modules\/postcss-viewport-to-container-toggle/ ],
  [ 'lodash shims', /lodash-shims/ ],
  [ 'cuid2 shim', /cuid2-browser-shim/ ]
];

const npmBuckets = new Map();
const otherNpm = new Map();
const aposModules = new Map();
let aposTotal = 0;
let npmTotal = 0;

function add(map, key, n) { map.set(key, (map.get(key) || 0) + n); }

for (const [ src, n ] of perSource) {
  const s = src.replace(/\\/g, '/');
  if (s.includes('node_modules/') || s.includes('/lib/lodash-shims/') || s.includes('cuid2-browser-shim')) {
    npmTotal += n;
    const cat = CATEGORIES.find(([ , re ]) => re.test(s));
    if (cat) {
      add(npmBuckets, cat[0], n);
    } else {
      // bucket by package name
      const idx = s.lastIndexOf('node_modules/');
      if (idx !== -1) {
        const rest = s.slice(idx + 13).split('/');
        const pkg = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
        add(otherNpm, pkg, n);
      } else {
        add(otherNpm, 'misc', n);
      }
    }
  } else {
    // apostrophe UI
    const m = s.match(/\/((?:@[^/]+\/)?[^/]+)\/(?:ui\/(?:apos|src)|apos|src)\//) ||
      s.match(/\/src\/(@[^/]+\/[^/]+)\//);
    const name = m ? m[1] : (s.match(/\/([^/]+)$/) || [ '', 'misc' ])[1];
    add(aposModules, name, n);
    aposTotal += n;
  }
}

const kb = (n) => (n / 1024).toFixed(1);
const pct = (n) => (100 * n / bundleBytes).toFixed(1);

console.log(`\n╔══ ADMIN BUNDLE BREAKDOWN — ${kb(bundleBytes)} KB minified (${bundleBytes} B) ══╗`);
console.log(`  npm dependencies:  ${kb(npmTotal).padStart(8)} KB  (${pct(npmTotal)}%)`);
console.log(`  apostrophe UI:     ${kb(aposTotal).padStart(8)} KB  (${pct(aposTotal)}%)`);
console.log(`  unmapped/runtime:  ${kb(unmapped).padStart(8)} KB  (${pct(unmapped)}%)`);

console.log('\n── npm by subsystem ──');
const catRows = [ ...npmBuckets.entries() ].sort((a, b) => b[1] - a[1]);
for (const [ name, n ] of catRows) {
  console.log(`  ${kb(n).padStart(8)} KB  ${pct(n).padStart(5)}%  ${name}`);
}
console.log('  -- other individual npm packages --');
const otherRows = [ ...otherNpm.entries() ].sort((a, b) => b[1] - a[1]);
let otherSum = 0;
for (const [ name, n ] of otherRows) {
  otherSum += n;
  if (n / 1024 >= 3) console.log(`  ${kb(n).padStart(8)} KB  ${pct(n).padStart(5)}%  ${name}`);
}
console.log(`  ${kb(otherSum).padStart(8)} KB  ${pct(otherSum).padStart(5)}%  (all "other npm" combined)`);

console.log('\n── apostrophe UI by module (top 20) ──');
const aposRows = [ ...aposModules.entries() ].sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [ name, n ] of aposRows) {
  console.log(`  ${kb(n).padStart(8)} KB  ${pct(n).padStart(5)}%  ${name}`);
}
