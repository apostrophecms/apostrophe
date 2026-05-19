// Step: clone the starter kit and detach it from the starter's git history.
// Failure → FailStage 'clone'.

import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { run as defaultRun } from '../spawn.js';
import { StageError } from '../errors.js';
import { assertSafeShortName } from '../validate.js';

const STAGE = 'clone';

/**
 * `git clone -- <repo> <shortName>` (no shell, via {@link run}), then strip
 * the cloned `.git/` so the new project starts with clean history.
 *
 * The `--` end-of-options marker means a repo URL or shortName beginning with
 * `-` is treated as an operand, not a git flag — defense in depth alongside
 * the no-shell spawn.
 *
 * @param {{ repo: string, shortName: string, cwd?: string }} opts
 * @param {{ run?: typeof defaultRun }} [deps] Inject `run` for unit tests.
 * @returns {Promise<{ projectDir: string }>}
 * @throws {StageError} stage 'clone' on spawn failure or non-zero exit.
 */
export async function clone(
  {
    repo, shortName, cwd = process.cwd()
  },
  { run = defaultRun } = {}
) {
  // Path-traversal guard before shortName is used as a clone target / path
  // base. Defense in depth even though the caller is contracted to validate.
  assertSafeShortName(shortName);

  const result = await run('git', [ 'clone', '--', repo, shortName ], { cwd });

  if (result.error) {
    const code = result.error.code === 'ENOENT' ? 'git_missing' : 'git_spawn_failed';
    throw new StageError(STAGE, {
      code,
      cause: result.error
    });
  }
  if (result.code !== 0) {
    throw new StageError(STAGE, {
      code: 'git_clone_failed',
      cause: new Error(`git clone exited with code ${result.code}`)
    });
  }

  const projectDir = join(cwd, shortName);
  rmSync(join(projectDir, '.git'), {
    recursive: true,
    force: true
  });

  return { projectDir };
}
