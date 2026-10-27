// Check a production build made with `build.mjs ... --sourcemaps` for the
// same file bundled more than once (the symlink duplication bug), and
// report the size and the test extension's markers.
//
//   node bundle-check.mjs <project-dir>
//
// Exits 1 if any file is bundled twice.
import fs from 'node:fs';
import path from 'node:path';

const project = path.resolve(process.argv[2] ?? '.');
const dist = path.join(project, 'apos-build/@apostrophecms/vite/default/dist');
let failed = false;

for (const name of [ 'apos', 'src' ]) {
  const mapFile = path.join(dist, `${name}-build.js.map`);
  if (!fs.existsSync(mapFile)) {
    console.log(`${name}: no source map (build with --sourcemaps)`);
    continue;
  }
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const byReal = new Map();
  for (const source of map.sources) {
    const abs = path.resolve(path.dirname(mapFile), source);
    let real;
    try {
      // Normalize case too: Windows paths may differ only by drive letter case
      real = fs.realpathSync(abs).toLowerCase();
    } catch {
      real = abs.toLowerCase();
    }
    byReal.set(real, [ ...(byReal.get(real) ?? []), source ]);
  }
  const dups = [ ...byReal.values() ].filter((sources) => sources.length > 1);
  const size = fs.statSync(mapFile.replace(/\.map$/, '')).size;
  console.log(`${name}: ${size} bytes, ${map.sources.length} sources, ${byReal.size} files, ${dups.length} bundled more than once`);
  for (const sources of dups.slice(0, 5)) {
    console.log('  ' + sources.join('\n    '));
  }
  failed ||= dups.length > 0;
}

const bundleDir = path.join(project, 'public/apos-frontend/default');
if (fs.existsSync(bundleDir)) {
  const all = fs.readdirSync(bundleDir)
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => fs.readFileSync(path.join(bundleDir, f), 'utf8'))
    .join('\n');
  const markers = [ 'PRO10258_MITT', 'PRO10258_NANO', 'c0ffee' ]
    .map((m) => `${m}: ${all.includes(m) ? 'yes' : 'no'}`);
  console.log('test extension markers (only expected with the extension installed): ' + markers.join(', '));
}
process.exit(failed ? 1 : 0);
