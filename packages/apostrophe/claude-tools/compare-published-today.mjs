#!/usr/bin/env node
//
// compare-published-today.mjs
//
// Detect packages in this monorepo whose LATEST npm release was published
// *today* (e.g. by an accidental `pnpm changeset publish` on the wrong branch)
// AND whose published contents differ from the source in `packages/<subdir>`.
//
// For every package under packages/*:
//   1. read its name from package.json
//   2. `npm view <name> --json` for the latest version + publish time
//   3. if that latest release was published today, download the tarball and
//      compare it, file by file, against `git archive <REF>:packages/<subdir>`
//      (git archive => only committed, non-gitignored files, honoring
//       .gitattributes export-ignore, just like a real export)
//   4. report every package published today that is NOT byte-identical to the
//      repo, with a unified diff of each differing file.
//
// Files in the tarball but not in git are reported (suspicious). Files in git
// but not the tarball (normal npmignored things like tests) are counted only.
//
// Deliberately simple + synchronous: one package at a time, prints progress.
//
// Usage:   node claude-tools/compare-published-today.mjs
//
// Env (all optional):
//   REF=<git ref>     tree to compare against            (default: HEAD)
//   SINCE_HOURS=<n>   treat "published within n hours" as "today"
//                     (default: since local midnight)
//   ONLY=a,b,c        restrict to these package dir names or npm names
//   EXCLUDE=a,b       skip these files when comparing (matches full relative
//                     path or basename), e.g. EXCLUDE=package.json
//   KEEP=1            keep temp dirs for debugging
//
// Requires: node, npm, git, curl, tar, diff.

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  lstatSync
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

// --- tiny helpers ----------------------------------------------------------

// Run a command synchronously without throwing on non-zero exit.
function run(cmd, args, { buffer = false } = {}) {
  try {
    const stdout = execFileSync(cmd, args, {
      maxBuffer: 512 * 1024 * 1024,
      encoding: buffer ? 'buffer' : 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return {
      code: typeof e.status === 'number' ? e.status : 1,
      stdout: e.stdout ?? (buffer ? Buffer.alloc(0) : ''),
      stderr: e.stderr ? String(e.stderr) : String(e)
    };
  }
}

// Recursively list regular files under `base`, relative to it.
function listFiles(base, sub = '', out = []) {
  let entries;
  try {
    entries = readdirSync(path.join(base, sub), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = sub ? path.join(sub, e.name) : e.name;
    if (e.isDirectory()) listFiles(base, rel, out);
    else out.push(rel);
  }
  return out;
}

function isBinary(file) {
  try {
    const buf = readFileSync(file);
    const n = Math.min(buf.length, 8000);
    for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
    return false;
  } catch {
    return false;
  }
}

function human(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return String(iso);
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// --- config ----------------------------------------------------------------

const REF = process.env.REF || 'HEAD';
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const EXCLUDE = (process.env.EXCLUDE || '').split(',').map((s) => s.trim()).filter(Boolean);
const isExcluded = (rel) => EXCLUDE.includes(rel) || EXCLUDE.includes(path.basename(rel));
const KEEP = !!process.env.KEEP;
const MAX_DIFF_LINES = 800;

const now = new Date();
const threshold = process.env.SINCE_HOURS
  ? Date.now() - Number(process.env.SINCE_HOURS) * 3600 * 1000
  : new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

const publishedInWindow = (iso) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= threshold;
};

// --- setup -----------------------------------------------------------------

const repoRoot = run('git', ['rev-parse', '--show-toplevel']).stdout.trim();
if (!repoRoot) {
  console.error('Not inside a git repo.');
  process.exit(1);
}
const packagesDir = path.join(repoRoot, 'packages');
const headSha = run('git', ['-C', repoRoot, 'rev-parse', '--short', REF]).stdout.trim();
const branch = run('git', ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();

// 1. collect packages
const pkgs = [];
for (const d of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  let pj;
  try {
    pj = JSON.parse(readFileSync(path.join(packagesDir, d.name, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  if (!pj.name || pj.private) continue;
  if (ONLY.length && !ONLY.includes(d.name) && !ONLY.includes(pj.name)) continue;
  pkgs.push({ dir: d.name, name: pj.name, localVersion: pj.version });
}
pkgs.sort((a, b) => a.name.localeCompare(b.name));

console.log(`Repo:   ${repoRoot}`);
console.log(`Ref:    ${REF} (${headSha}${branch ? ` on ${branch}` : ''})`);
console.log(
  `Window: published since ${new Date(threshold).toISOString()} ` +
    `(${process.env.SINCE_HOURS ? `last ${process.env.SINCE_HOURS}h` : 'local midnight'})`
);
console.log(`Packages: ${pkgs.length}\n`);

const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'pub-cmp-'));

// 2 + 3. iterate: check publish time, and for today's releases fetch + compare
for (let i = 0; i < pkgs.length; i++) {
  const p = pkgs[i];
  const tag = `[${i + 1}/${pkgs.length}] ${p.name}`;
  process.stdout.write(`${tag} ... `);

  const r = run('npm', ['view', p.name, '--json']);
  if (r.code !== 0 || !r.stdout.trim()) {
    p.status = 'not-published';
    console.log('not published on npm, skipping');
    continue;
  }
  let meta;
  try {
    meta = JSON.parse(r.stdout);
  } catch {
    p.status = 'view-parse-error';
    console.log('could not parse npm metadata, skipping');
    continue;
  }

  const distTags = meta['dist-tags'] || {};
  p.latest = distTags.latest || meta.version;
  const time = meta.time || {};
  p.latestTime = time[p.latest];
  p.tarball = meta.dist && meta.dist.tarball;
  p.publishedToday = !!(p.latestTime && publishedInWindow(p.latestTime));

  if (!p.publishedToday) {
    p.status = 'ok';
    console.log(`latest ${p.latest} published ${p.latestTime ? human(p.latestTime) : '?'} — not today`);
    continue;
  }

  console.log(`latest ${p.latest} published ${human(p.latestTime)} — TODAY, comparing`);

  // fetch + extract tarball
  const work = path.join(tmpRoot, p.dir);
  const npmDir = path.join(work, 'npm');
  const gitDir = path.join(work, 'git');
  mkdirSync(npmDir, { recursive: true });
  mkdirSync(gitDir, { recursive: true });
  const tgz = path.join(work, 'pkg.tgz');

  if (!p.tarball) {
    p.compare = { error: 'no tarball url in npm metadata' };
    console.log('    -> ERROR: no tarball url');
    continue;
  }
  const dl = run('curl', ['-fsSL', '-o', tgz, p.tarball]);
  if (dl.code !== 0) {
    p.compare = { error: `curl failed: ${dl.stderr.trim()}` };
    console.log('    -> ERROR: download failed');
    continue;
  }
  const ex = run('tar', ['-xzf', tgz, '-C', npmDir]);
  if (ex.code !== 0) {
    p.compare = { error: `tar extract failed: ${ex.stderr.trim()}` };
    console.log('    -> ERROR: extract failed');
    continue;
  }
  const npmPkg = path.join(npmDir, 'package'); // npm tarballs root at package/

  // export committed source subtree (no gitignored/untracked files)
  const gitTar = path.join(work, 'git.tar');
  const ga = run('git', [
    '-C',
    repoRoot,
    'archive',
    '--format=tar',
    '-o',
    gitTar,
    `${REF}:packages/${p.dir}`
  ]);
  if (ga.code !== 0) {
    p.compare = { error: `git archive failed: ${ga.stderr.trim()}` };
    console.log('    -> ERROR: git archive failed');
    continue;
  }
  run('tar', ['-xf', gitTar, '-C', gitDir]);

  // compare every file npm actually published
  const npmFiles = listFiles(npmPkg);
  const gitFiles = new Set(listFiles(gitDir));
  const differing = [];
  let identical = 0;
  let excluded = 0;

  for (const rel of npmFiles) {
    if (isExcluded(rel)) {
      excluded++;
      continue;
    }
    const npmFile = path.join(npmPkg, rel);
    const gitFile = path.join(gitDir, rel);
    const inGit = gitFiles.has(rel);

    const npmBuf = readFileSync(npmFile);
    if (inGit && readFileSync(gitFile).equals(npmBuf)) {
      identical++;
      continue;
    }

    const left = inGit ? gitFile : '/dev/null';
    let diffText;
    if (isBinary(npmFile) || (inGit && isBinary(gitFile))) {
      const gitSize = inGit ? lstatSync(gitFile).size : 0;
      diffText = `Binary files differ (git: ${inGit ? gitSize + ' bytes' : 'absent'}, npm: ${npmBuf.length} bytes)`;
    } else {
      const d = run('diff', ['-u', '-L', `a/${rel}`, '-L', `b/${rel}`, left, npmFile]);
      const lines = d.stdout.split('\n');
      diffText =
        lines.length > MAX_DIFF_LINES
          ? lines.slice(0, MAX_DIFF_LINES).join('\n') +
            `\n... [truncated, ${lines.length - MAX_DIFF_LINES} more lines]`
          : d.stdout;
    }
    differing.push({ rel, kind: inGit ? 'differs' : 'npm-only', diff: diffText.trimEnd() });
  }

  const gitOnly = [...gitFiles].filter((f) => !npmFiles.includes(f));
  p.compare = {
    identical,
    differing,
    excluded,
    npmFileCount: npmFiles.length,
    gitOnlyCount: gitOnly.length
  };
  console.log(
    `    -> ${differing.length} differing, ${identical} identical, ` +
      `${gitOnly.length} git-only (npmignored)` +
      (excluded ? `, ${excluded} excluded` : '')
  );
}

// 4. write report
const todays = pkgs.filter((p) => p.publishedToday);
const problems = todays.filter((p) => p.compare && (p.compare.error || p.compare.differing?.length));
const clean = todays.filter((p) => p.compare && !p.compare.error && !p.compare.differing?.length);

const stamp = now.toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
const logsDir = path.join(repoRoot, 'claude-tools', 'logs');
mkdirSync(logsDir, { recursive: true });
const reportPath = path.join(logsDir, `published-today-compare-${stamp}.md`);

const L = [];
L.push(`# Published-today vs \`packages/\` comparison`);
L.push('');
L.push(`- Repo: \`${repoRoot}\``);
L.push(`- Compared against ref: \`${REF}\` (\`${headSha}\`${branch ? ` on \`${branch}\`` : ''})`);
L.push(`- Window: published on/after \`${new Date(threshold).toISOString()}\``);
L.push(`- Generated: \`${now.toISOString()}\``);
L.push(`- Packages scanned: ${pkgs.length}; published in-window: ${todays.length}`);
L.push('');
L.push(
  `**${problems.length}** package(s) were published in-window AND differ from the repo (or errored). ` +
    `**${clean.length}** published in-window and are byte-identical.`
);
L.push('');
L.push(`## Summary`);
L.push('');
L.push(`| Package | Latest | Published | Verdict |`);
L.push(`| --- | --- | --- | --- |`);
for (const p of todays) {
  let verdict;
  if (!p.compare) verdict = 'not compared';
  else if (p.compare.error) verdict = `ERROR: ${p.compare.error}`;
  else if (p.compare.differing.length) verdict = `DIFFERS (${p.compare.differing.length} file(s))`;
  else verdict = 'identical';
  L.push(`| \`${p.name}\` | ${p.latest} | ${p.latestTime ? human(p.latestTime) : '?'} | ${verdict} |`);
}
L.push('');

if (problems.length) {
  L.push(`## Differences`);
  L.push('');
  for (const p of problems) {
    L.push(`### \`${p.name}@${p.latest}\``);
    L.push('');
    L.push(`- published: \`${p.latestTime}\` (${p.latestTime ? human(p.latestTime) : '?'})`);
    L.push(`- local version on \`${REF}\`: \`${p.localVersion}\``);
    L.push(`- source subtree: \`packages/${p.dir}\``);
    if (p.compare.error) {
      L.push(`- **error:** ${p.compare.error}`);
      L.push('');
      continue;
    }
    L.push(
      `- ${p.compare.differing.length} differing file(s), ${p.compare.identical} identical, ` +
        `${p.compare.gitOnlyCount} git-only (npmignored, ignored here)` +
        (p.compare.excluded ? `, ${p.compare.excluded} excluded via EXCLUDE` : '')
    );
    L.push('');
    for (const f of p.compare.differing) {
      L.push(`#### ${f.kind === 'npm-only' ? '(in npm tarball, NOT in git) ' : ''}\`${f.rel}\``);
      L.push('');
      L.push('```diff');
      L.push(f.diff);
      L.push('```');
      L.push('');
    }
  }
} else {
  L.push(`## Differences`);
  L.push('');
  L.push(`None — every package published in-window is byte-identical to \`${REF}\`.`);
  L.push('');
}

if (clean.length) {
  L.push(`## Published in-window but identical (no action needed)`);
  L.push('');
  for (const p of clean) L.push(`- \`${p.name}@${p.latest}\` (${human(p.latestTime)})`);
  L.push('');
}

writeFileSync(reportPath, L.join('\n'), 'utf8');

// 5. console summary
console.log(`\n${'='.repeat(70)}`);
if (problems.length) {
  console.log(`${problems.length} package(s) published in-window DIFFER from ${REF}:`);
  for (const p of problems) {
    const detail = p.compare.error
      ? `ERROR: ${p.compare.error}`
      : `${p.compare.differing.length} file(s) differ`;
    console.log(`   - ${p.name}@${p.latest}  (${detail})`);
  }
} else if (todays.length) {
  console.log(`All ${todays.length} package(s) published in-window are identical to ${REF}.`);
} else {
  console.log(`No packages had their latest release published in-window.`);
}
console.log(`\nFull report: ${reportPath}`);

if (!KEEP) rmSync(tmpRoot, { recursive: true, force: true });
else console.log(`Temp kept at: ${tmpRoot}`);
