// Step: write the database selection into the project .env. Core resolves the
// connection from APOS_DB_URI (when given) and/or APOS_DEFAULT_DB_ADAPTER;

import { join } from 'node:path';
import { StageError } from '../errors.js';
import { upsertEnv } from '../env-file.js';

const STAGE = 'db_connect';

// DbChoice maps 1:1 to a core adapter name.
const DB_CHOICES = new Set([ 'sqlite', 'mongodb', 'postgres' ]);

/**
 * @param {{ appRoot: string, dbChoice: string, dbUri?: string }} opts
 * @param {{
 *   verifyConnection?: (info: { dbChoice: string, dbUri?: string }) => Promise<void>
 * }} [deps] When provided, a rejection maps to StageError 'db_connect'.
 * @returns {Promise<{ dbChoice: string }>}
 * @throws {StageError} stage 'db_connect' when the probe fails.
 * @throws {TypeError} for an unknown dbChoice (validation).
 */
export async function dbConfig(
  {
    appRoot, dbChoice, dbUri
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
    try {
      await verifyConnection({
        dbChoice,
        dbUri
      });
    } catch (err) {
      throw new StageError(STAGE, {
        code: 'db_connect_failed',
        cause: err
      });
    }
  }

  return { dbChoice };
}
