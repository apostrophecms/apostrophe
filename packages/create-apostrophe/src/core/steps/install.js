// Step: install dependencies with npm. Standalone installs once in the app
// root; an external-frontend project installs in backend/ and frontend/.
// A non-npm manager is rejected up front. Failure → 'dependency_install'.

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { run as defaultRun } from '../spawn.js';
import { StageError } from '../errors.js';
import { detectPackageManager, assertSupportedPackageManager } from '../pm.js';

/** @typedef {import('../kits.js').Frontend}            Frontend       */
/** @typedef {import('../../index.js').PackageManager}  PackageManager */

const STAGE = 'dependency_install';

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
  }

  for (const cwd of dirs) {
    const result = await run('npm', [ 'install' ], { cwd });
    if (result.error) {
      throw new StageError(STAGE, {
        code: result.error.code === 'ENOENT'
          ? 'npm_missing'
          : 'npm_spawn_failed',
        cause: result.error
      });
    }
    if (result.code !== 0) {
      throw new StageError(STAGE, {
        code: 'install_failed',
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
