// Step: write the database selection into the project .env (core resolves the
// connection from APOS_DB_URI and/or APOS_DEFAULT_DB_ADAPTER), then verify the
// connection for real. This is the authoritative connection check — a wrong
// password or unreachable server fails here with a precise error code.

import { join } from 'node:path';
import { StageError } from '../errors.js';
import { upsertEnv } from '../env-file.js';
import { resolveDbUri } from '../db.js';

/** @typedef {import('../../index.js').DbChoice} DbChoice */

const STAGE = 'db_connect';

// DbChoice maps 1:1 to a core adapter name.
const DB_CHOICES = new Set([ 'sqlite', 'mongodb', 'postgres' ]);

// db module's classified failure reason → telemetry error code.
const REASON_CODE = {
  unreachable: 'db_unreachable',
  auth: 'db_auth_failed',
  unknown: 'db_connect_failed'
};

/**
 * @param {{
 *   appRoot: string, dbChoice: DbChoice, dbUri?: string, shortName: string
 * }} opts
 * @param {{
 *   verifyConnection?: (uri: string) => Promise<{
 *     reachable: boolean, reason?: string, message?: string
 *   }>
 * }} [deps] When provided, the resolved URI is checked and an unreachable /
 *   auth / unknown verdict maps to the matching `db_*` StageError code.
 * @returns {Promise<{ dbChoice: DbChoice }>}
 * @throws {StageError} stage 'db_connect' when the connection check fails.
 * @throws {TypeError} for an unknown dbChoice (validation).
 */
export async function dbConfig(
  {
    appRoot, dbChoice, dbUri, shortName
  },
  { verifyConnection } = {}
) {
  if (!DB_CHOICES.has(dbChoice)) {
    throw new TypeError(`Unknown dbChoice: ${JSON.stringify(dbChoice)}.`);
  }

  const env = { APOS_DEFAULT_DB_ADAPTER: dbChoice };
  // A connection string only applies to mongodb/postgres; SQLite is a file
  // path core derives from the project name.
  if (dbChoice !== 'sqlite' && dbUri) {
    env.APOS_DB_URI = dbUri;
  }
  upsertEnv(join(appRoot, '.env'), env);

  if (verifyConnection) {
    const uri = resolveDbUri({
      dbChoice,
      dbUri,
      appRoot,
      shortName
    });
    const result = await verifyConnection(uri);
    if (!result.reachable) {
      throw new StageError(STAGE, {
        code: REASON_CODE[result.reason] ?? 'db_connect_failed',
        cause: result.message ? new Error(result.message) : undefined
      });
    }
  }

  return { dbChoice };
}
