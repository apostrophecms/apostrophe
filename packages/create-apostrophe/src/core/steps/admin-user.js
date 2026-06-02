// Step: create the admin user via the project's own
// `@apostrophecms/user:add` task. The password is written to the task's
// stdin (never an argv, never logged).
//
// Recovery: if `user:add` fails because the username already exists,
// retry as `user:change-password`.
//
// The `--` end-of-options marker before the user-supplied `username`
// stops Apostrophe's argv parser (`boring({ end: true })`) from
// re-interpreting a username like `--role=guest` as a flag — without it,
// the task would create a different user with a different role than asked.

import { run as defaultRun } from '../spawn.js';
import { StageError } from '../errors.js';

/** @typedef {import('../../index.js').AdminAccount} AdminAccount */

const STAGE = 'admin';

/**
 * @param {AdminAccount & { appRoot: string }} opts
 * @param {{ run?: typeof defaultRun }} [deps]
 * @returns {Promise<'created' | 'updated'>} `'updated'` only when the
 *   user already existed and we fell back to `user:change-password`.
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

  const add = await run(
    'node',
    [ 'app.js', '@apostrophecms/user:add', '--', username, 'admin' ],
    {
      cwd: appRoot,
      input: `${password ?? ''}\n`
    }
  );

  if (add.error) {
    throw new StageError(STAGE, {
      code: add.error.code === 'ENOENT' ? 'node_missing' : 'node_spawn_failed',
      cause: add.error
    });
  }
  if (add.code === 0) {
    return 'created';
  }

  if (isDuplicateUsername(add.stderr)) {
    const cp = await run(
      'node',
      [ 'app.js', '@apostrophecms/user:change-password', '--', username ],
      {
        cwd: appRoot,
        input: `${password ?? ''}\n`
      }
    );
    if (cp.error) {
      throw new StageError(STAGE, {
        code: cp.error.code === 'ENOENT' ? 'node_missing' : 'node_spawn_failed',
        cause: cp.error
      });
    }
    if (cp.code === 0) {
      return 'updated';
    }
    throw new StageError(STAGE, {
      code: 'admin_user_failed',
      cause: new Error(
        `@apostrophecms/user:change-password exited with code ${cp.code} ` +
        '(recovery from duplicate @apostrophecms/user:add)'
      )
    });
  }

  throw new StageError(STAGE, {
    code: 'admin_user_failed',
    cause: new Error(`@apostrophecms/user:add exited with code ${add.code}`)
  });
}

/**
 * Detect a duplicate-key failure across all three adapters Apostrophe
 * supports. `@apostrophecms/db-connect` normalizes the error *code* to
 * `11000` for mongo/postgres/sqlite, but `e.message` (what the task
 * runner prints) differs per adapter:
 *
 *   - mongo:    `E11000 duplicate key error collection: ... index: username_1 ...`
 *   - postgres: `Duplicate key error: username "admin" already exists`
 *   - sqlite:   `Duplicate key error: already exists`  (no field name)
 *
 * @param {string} stderr
 * @returns {boolean}
 */
function isDuplicateUsername(stderr) {
  if (!stderr) {
    return false;
  }
  return stderr.includes('E11000') || /duplicate\s+key/i.test(stderr);
}
