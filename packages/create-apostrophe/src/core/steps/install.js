// Step: install dependencies with npm. Standalone installs once in the app
// root; an external-frontend project installs in backend/ and frontend/, and
// — if the project root ships its own package.json — also at the root (some
// Astro kits put orchestration deps like `concurrently` there to power a
// single `npm run dev`). npm is used even when pnpm launched us; yarn is
// rejected up front. Failure → 'dependency_install'.
//
// When pnpm launched us, each installed package.json also gets a
// `packageManager: "npm@<version>"` field. A pnpm user's habit is to run
// `pnpm install` next, which silently converts the npm layout and skips
// native builds (better-sqlite3), so the new site stops starting. pnpm
// refuses to run in a project whose packageManager names another manager.
//
// Each folder then gets a second `npm install`. Without a lockfile (the kits
// ship none), npm's first install is not final: it drops `fsevents` on macOS
// (its registry metadata advertises a `node-gyp rebuild` script the tarball
// doesn't ship, so the build fails and npm discards the optional package) and
// places `gcp-metadata` differently from where it settles (npm 10 leaves out
// the version `mongodb` wants; npm 11 and 12 add one nothing needs). A second
// run fixes both, and a third reports "up to date". The second run is best
// effort: the project already works without it.

import { join } from 'node:path';
import {
  existsSync, readFileSync, writeFileSync
} from 'node:fs';
import { run as defaultRun, tail } from '../spawn.js';
import { StageError } from '../errors.js';
import {
  detectPackageManager,
  assertSupportedPackageManager,
  installsWithNpmInstead
} from '../pm.js';

/** @typedef {import('../kits.js').Frontend}            Frontend       */
/** @typedef {import('../../index.js').PackageManager}  PackageManager */

const STAGE = 'dependency_install';

// cmd.exe's "not recognized as an internal or external command" exit status —
// the Windows equivalent of the ENOENT we'd see spawning npm directly.
const CMD_NOT_FOUND = 9009;

/**
 * The argv that runs `npm <args>`, per platform.
 *
 * On Windows `npm` is not an executable: the Node install directory ships
 * `npm.cmd` (plus a `npm` sh script only Cygwin/MSYS can use). `CreateProcess`
 * cannot execute a batch file, and libuv's PATH search only tries the bare
 * name, `.com` and `.exe` — so a plain `spawn('npm')` fails with ENOENT no
 * matter what the PATH holds, and no matter which shell the user launched us
 * from, since node.exe resolves children by Win32 rules rather than bash's.
 * Naming `npm.cmd` outright doesn't help either: since the CVE-2024-27980 fix
 * (Node 18.20.2) spawning a .bat/.cmd without a shell throws EINVAL. So the
 * call has to go through the command interpreter.
 *
 * cmd.exe is named explicitly rather than passed to spawn as `shell: true`
 * because {@link defaultRun} keeps `shell: false` for every caller — see
 * spawn.js. Nothing user-supplied is exposed by doing so: the argv below is a
 * constant, and `cwd` reaches CreateProcess as its own parameter rather than
 * as part of the command line.
 *
 * @param {string[]} args  Constant arguments for npm.
 * @param {string} [platform] Defaults to `process.platform`.
 * @returns {[ string, string[] ]} `[ command, args ]` for {@link defaultRun}.
 */
export function npmCommand(args, platform = process.platform) {
  return platform === 'win32'
    ? [ process.env.ComSpec || 'cmd.exe', [ '/d', '/s', '/c', 'npm', ...args ] ]
    : [ 'npm', [ ...args ] ];
}

/**
 * The argv that runs `npm install`, per platform. See {@link npmCommand}.
 *
 * @param {string} [platform] Defaults to `process.platform`.
 * @returns {[ string, string[] ]}
 */
export function npmInstallCommand(platform = process.platform) {
  return npmCommand([ 'install' ], platform);
}

/**
 * @param {{
 *   projectDir: string,
 *   appRoot: string,
 *   frontend?: Frontend,
 *   packageManager?: PackageManager
 * }} opts
 * @param {{ run?: typeof defaultRun }} [deps]
 * @returns {Promise<{ packageManager: PackageManager }>}
 *   The detected manager (may be `'pnpm'` or `'unknown'`); the install
 *   runs with npm.
 * @throws {import('../errors.js').UnsupportedPackageManagerError} yarn etc.
 * @throws {StageError} stage 'dependency_install'.
 */
export async function install(
  {
    projectDir, appRoot, frontend = null, packageManager
  },
  { run = defaultRun } = {}
) {
  const detected = packageManager || detectPackageManager();
  assertSupportedPackageManager(detected);

  const dirs = [ appRoot ];
  if (frontend !== null) {
    const frontendDir = join(projectDir, 'frontend');
    if (existsSync(frontendDir)) {
      dirs.push(frontendDir);
    }
    if (existsSync(join(projectDir, 'package.json'))) {
      dirs.push(projectDir);
    }
  }

  const [ command, args ] = npmInstallCommand();

  for (const cwd of dirs) {
    const result = await run(command, args, { cwd });
    if (result.error) {
      throw new StageError(STAGE, {
        code: result.error.code === 'ENOENT'
          ? 'npm_missing'
          : 'npm_spawn_failed',
        cause: result.error
      });
    }
    if (result.code !== 0) {
      // Going through cmd.exe means a missing npm is an exit status rather
      // than a spawn error; keep reporting it as 'npm_missing' either way.
      const missing = command !== 'npm' && result.code === CMD_NOT_FOUND;
      throw new StageError(STAGE, {
        code: missing ? 'npm_missing' : 'install_failed',
        cause: new Error(`npm install exited with code ${result.code}`),
        details: tail([ result.stderr, result.stdout ].filter(Boolean).join('\n'))
      });
    }
  }

  if (!existsSync(join(appRoot, 'node_modules', 'apostrophe'))) {
    throw new StageError(STAGE, {
      code: 'apostrophe_missing',
      cause: new Error('apostrophe not present after install')
    });
  }

  for (const cwd of dirs) {
    // Best effort; see the header comment.
    await run(command, args, { cwd });
  }

  if (installsWithNpmInstead(detected)) {
    await pinNpm(dirs, run);
  }

  return { packageManager: detected };
}

const NPM_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Write `packageManager: "npm@<version>"` into each installed package.json,
 * using the npm that just ran the install. Best effort: the project already
 * works, so a failure here leaves it as it is rather than failing the step.
 *
 * @param {string[]} dirs
 * @param {typeof defaultRun} run
 */
async function pinNpm(dirs, run) {
  const [ command, args ] = npmCommand([ '--version' ]);
  const result = await run(command, args, { cwd: dirs[0] });
  const version = result.code === 0 ? String(result.stdout ?? '').trim() : '';
  if (!NPM_VERSION.test(version)) {
    return;
  }
  for (const cwd of dirs) {
    setPackageManager(join(cwd, 'package.json'), `npm@${version}`);
  }
}

/**
 * Add a `packageManager` field, keeping the file's indentation, line endings
 * (a Windows checkout may be CRLF) and trailing newline. Never replaces a
 * field the kit already declares.
 *
 * @param {string} file
 * @param {string} value
 */
function setPackageManager(file, value) {
  try {
    const text = readFileSync(file, 'utf8');
    const pkg = JSON.parse(text);
    if (pkg === null || typeof pkg !== 'object' || pkg.packageManager) {
      return;
    }
    pkg.packageManager = value;
    const indent = text.match(/^[ \t]+(?=")/m)?.[0] ?? 2;
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    const body = JSON.stringify(pkg, null, indent).replace(/\n/g, newline);
    writeFileSync(file, body + (text.endsWith('\n') ? newline : ''));
  } catch {
    // Missing or unreadable package.json: nothing to guard.
  }
}
