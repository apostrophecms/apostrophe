// Pack the branch's @apostrophecms/vite into a tarball with a unique name.
//
//   node pack.mjs <out-dir>
//
// Prints the tarball path. The name must change on every pack: pnpm and
// yarn cache `file:` tarballs by name and would keep installing old code.
// Keep earlier tarballs; a project's lockfile may still point at one.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve(process.argv[2] ?? '.');
const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/vite');
fs.mkdirSync(outDir, { recursive: true });

const before = new Set(fs.readdirSync(outDir));
execFileSync('pnpm', [ 'pack', '--pack-destination', outDir ], {
  cwd: pkgDir,
  stdio: 'ignore',
  shell: process.platform === 'win32'
});
const packed = fs.readdirSync(outDir)
  .find((f) => !before.has(f) && f.startsWith('apostrophecms-vite-'));
if (!packed) {
  throw new Error('pnpm pack produced no tarball');
}
const target = path.join(outDir, `vite-fix-${Date.now()}.tgz`);
fs.renameSync(path.join(outDir, packed), target);
console.log(target);
