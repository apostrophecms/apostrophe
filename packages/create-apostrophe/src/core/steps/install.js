// Step: install dependencies with npm. Standalone installs once in the app
// root; an external-frontend project installs in backend/ and frontend/, and
// — if the project root ships its own package.json — also at the root (some
// Astro kits put orchestration deps like `concurrently` there to power a
// single `npm run dev`). A non-npm manager is rejected up front. Failure →
// 'dependency_install'.

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { run as defaultRun } from '../spawn.js';
import { StageError } from '../errors.js';
import { detectPackageManager, assertSupportedPackageManager } from '../pm.js';

/** @typedef {import('../kits.js').Frontend}            Frontend       */
/** @typedef {import('../../index.js').PackageManager}  PackageManager */

const STAGE = 'dependency_install';

// cmd.exe's "not recognized as an internal or external command" exit status —
// the Windows equivalent of the ENOENT we'd see spawning npm directly.
const CMD_NOT_FOUND = 9009;

/**
 * The argv that runs `npm install`, per platform.
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
 * @param {string} [platform] Defaults to `process.platform`.
 * @returns {[ string, string[] ]} `[ command, args ]` for {@link defaultRun}.
 */
export function npmInstallCommand(platform = process.platform) {
  return platform === 'win32'
    ? [ process.env.ComSpec || 'cmd.exe', [ '/d', '/s', '/c', 'npm', 'install' ] ]
    : [ 'npm', [ 'install' ] ];
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
 *   The detected manager (may be `'unknown'`); the install runs with npm.
 * @throws {import('../errors.js').UnsupportedPackageManagerError} non-npm.
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
        cause: new Error(`npm install exited with code ${result.code}`)
      });
    }
  }

  if (!existsSync(join(appRoot, 'node_modules', 'apostrophe'))) {
    throw new StageError(STAGE, {
      code: 'apostrophe_missing',
      cause: new Error('apostrophe not present after install')
    });
  }

  return { packageManager: detected };
}
