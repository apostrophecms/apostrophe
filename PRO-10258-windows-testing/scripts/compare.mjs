// Byte-compare the production output of two test projects.
//
//   node compare.mjs <project-a> <project-b>
//
// Compares public/apos-frontend recursively. Exits 1 on any difference.
import fs from 'node:fs';
import path from 'node:path';

const [ a, b ] = process.argv.slice(2).map((dir) => path.resolve(dir, 'public/apos-frontend'));
if (!a || !b) {
  console.error('usage: node compare.mjs <project-a> <project-b>');
  process.exit(2);
}

const list = (root) => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return out.sort();
};

const filesA = list(a);
const filesB = list(b);
const problems = [];
for (const file of new Set([ ...filesA, ...filesB ])) {
  const inA = filesA.includes(file);
  const inB = filesB.includes(file);
  if (!inA || !inB) {
    problems.push(`only in ${inA ? 'A' : 'B'}: ${file}`);
  } else if (!fs.readFileSync(path.join(a, file)).equals(fs.readFileSync(path.join(b, file)))) {
    const sizeA = fs.statSync(path.join(a, file)).size;
    const sizeB = fs.statSync(path.join(b, file)).size;
    problems.push(`differs: ${file} (${sizeA} vs ${sizeB} bytes)`);
  }
}
if (problems.length) {
  console.log(`DIFFERENT (${problems.length})`);
  problems.slice(0, 20).forEach((p) => console.log('  ' + p));
  process.exit(1);
}
console.log(`byte-identical (${filesA.length} files)`);
