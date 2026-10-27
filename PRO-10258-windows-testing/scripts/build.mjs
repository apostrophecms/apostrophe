// Production asset build of a test project, from a clean state.
//
//   node build.mjs <project-dir> <label> [--sourcemaps]
//
// Uses its own MongoDB database (pro10258-<label>) and a fixed release id.
// Writes the full output to <project-dir>/build.log and exits with the
// build's exit code. --sourcemaps needs the asset module edit from the
// README (SOURCEMAPS env var).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [ dir, label ] = process.argv.slice(2);
if (!dir || !label) {
  console.error('usage: node build.mjs <project-dir> <label> [--sourcemaps]');
  process.exit(2);
}
const project = path.resolve(dir);
for (const sub of [ 'apos-build', 'public/apos-frontend' ]) {
  fs.rmSync(path.join(project, sub), {
    recursive: true,
    force: true
  });
}
const result = spawnSync(process.execPath, [ 'app', '@apostrophecms/asset:build' ], {
  cwd: project,
  encoding: 'utf8',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    APOS_RELEASE_ID: 'pro10258',
    APOS_MONGODB_URI: `mongodb://localhost:27017/pro10258-${label}`,
    SOURCEMAPS: process.argv.includes('--sourcemaps') ? '1' : ''
  }
});
const log = `${result.stdout}${result.stderr}`;
fs.writeFileSync(path.join(project, 'build.log'), log);
console.log(`[${label}] exit ${result.status}`);
if (result.status !== 0) {
  const errors = log.split('\n')
    .filter((line) => /error|failed to resolve|can't find/i.test(line))
    .slice(0, 3);
  for (const line of errors) {
    console.log('  ' + line.slice(0, 500));
  }
}
process.exit(result.status ?? 1);
