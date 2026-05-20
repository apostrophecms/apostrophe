// Step: create the admin user via the project's own
// `@apostrophecms/user:add` task. The password is written to the task's
// stdin (never an argv, never logged).

import { run as defaultRun } from '../spawn.js';
import { StageError } from '../errors.js';

/** @typedef {import('../../index.js').AdminAccount} AdminAccount */

const STAGE = 'admin';

/**
 * @param {AdminAccount & { appRoot: string }} opts
 * @param {{ run?: typeof defaultRun }} [deps]
 * @returns {Promise<void>}
 * @throws {StageError} stage 'admin' if the task cannot run or exits non-zero.
 */
export async function addAdminUser(
  {
    appRoot, username, password
  },
  { run = defaultRun } = {}
) {
  if (!username) {
    throw new TypeError('admin.username is required');
  }

  const result = await run(
    'node',
    [ 'app.js', '@apostrophecms/user:add', username, 'admin' ],
    {
      cwd: appRoot,
      input: `${password ?? ''}\n`
    }
  );

  if (result.error) {
    throw new StageError(STAGE, {
      code: result.error.code === 'ENOENT' ? 'node_missing' : 'node_spawn_failed',
      cause: result.error
    });
  }
  if (result.code !== 0) {
    throw new StageError(STAGE, {
      code: 'admin_user_failed',
      cause: new Error(`@apostrophecms/user:add exited with code ${result.code}`)
    });
  }
}
