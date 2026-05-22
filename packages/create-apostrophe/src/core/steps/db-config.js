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
 *   appRoot: string, dbChoice: DbChoice, dbUri?: string, shortName: string,
 *   dbReset?: ('keep' | 'drop')
 * }} opts `dbReset: 'drop'` drops the database after a successful check (the
 *   user's confirmed "start fresh" consent for a non-empty, non-seed target).
 * @param {{
 *   verifyConnection?: (uri: string) => Promise<{
 *     reachable: boolean, reason?: string, message?: string
 *   }>,
 *   dropDatabase?: (uri: string) => Promise<void>
 * }} [deps] When `verifyConnection` is provided, the resolved URI is checked
 *   and an unreachable / auth / unknown verdict maps to the matching `db_*`
 *   StageError code. `dropDatabase` performs the `dbReset: 'drop'` drop.
 * @returns {Promise<{ dbChoice: DbChoice }>}
 * @throws {StageError} stage 'db_connect' on a failed check or drop.
 * @throws {TypeError} for an unknown dbChoice (validation).
 */
export async function dbConfig(
  {
    appRoot, dbChoice, dbUri, shortName, dbReset = 'keep'
  },
  { verifyConnection, dropDatabase } = {}
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

  // The resolved URI is needed for both the check and the optional drop.
  if (verifyConnection || dbReset === 'drop') {
    const uri = resolveDbUri({
      dbChoice,
      dbUri,
      appRoot,
      shortName
    });

    if (verifyConnection) {
      const result = await verifyConnection(uri);
      if (!result.reachable) {
        throw new StageError(STAGE, {
          code: REASON_CODE[result.reason] ?? 'db_connect_failed',
          cause: result.message ? new Error(result.message) : undefined
        });
      }
    }

    // Honour the user's "start fresh" consent: drop after we know the
    // connection is good, so an unreachable/auth failure reports precisely
    // rather than masquerading as a drop failure.
    if (dbReset === 'drop' && dropDatabase) {
      try {
        await dropDatabase(uri);
      } catch (err) {
        throw new StageError(STAGE, {
          code: 'db_drop_failed',
          cause: err
        });
      }
    }
  }

  return { dbChoice };
}
