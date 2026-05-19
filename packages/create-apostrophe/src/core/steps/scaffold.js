// Step: minimal imprint of the cloned starter.

import { join } from 'node:path';
import {
  existsSync, readFileSync, writeFileSync
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { StageError } from '../errors.js';
import { assertSafeShortName } from '../validate.js';
import { writeIfAbsent, upsertEnv } from '../env-file.js';
import {
  standaloneEnv, externalBackendEnv, externalFrontendEnv, SECRET_KEYS
} from '../env-templates.js';

const STAGE = 'scaffold';

/** Frontend names with a delivered `.env` template. Supporting another is a
 * deliberate change here + a new template, not a new boolean elsewhere. */
const SUPPORTED_FRONTENDS = new Set([ 'astro' ]);

/** 32 random bytes as hex (256-bit). */
function secret() {
  return randomBytes(32).toString('hex');
}

function replaceInFile(file, regex, replacement) {
  const content = readFileSync(file, 'utf8');
  writeFileSync(file, content.replace(regex, replacement));
}

/** Fresh generated value for each secret key. */
function generatedSecrets() {
  return Object.fromEntries(SECRET_KEYS.map((k) => [ k, secret() ]));
}

/**
 * @param {{
 *   projectDir: string,
 *   shortName: string,
 *   frontend?: ('astro'|null)
 * }} opts `frontend` is the kit's external-frontend name (null = standalone).
 * @returns {{ frontend: ('astro'|null), appRoot: string, envFiles: string[] }}
 * @throws {StageError} stage 'scaffold' on a missing required file or I/O.
 * @throws {TypeError} for an unsupported `frontend` name (validation error).
 */
export function scaffold({
  projectDir, shortName, frontend = null
}) {
  assertSafeShortName(shortName);

  if (frontend !== null && !SUPPORTED_FRONTENDS.has(frontend)) {
    throw new TypeError(
      `Unsupported frontend: ${JSON.stringify(frontend)}. ` +
      `Expected null or one of: ${[ ...SUPPORTED_FRONTENDS ].join(', ')}.`
    );
  }

  // An external-frontend kit nests the Apostrophe app under backend/;
  // standalone keeps it at the project root. The frontend NAME (from the kit)
  // decides the layout.
  const external = frontend !== null;
  const appRoot = external ? join(projectDir, 'backend') : projectDir;
  const resolve = (rel) => join(appRoot, rel);

  const appJs = resolve('app.js');
  const packageJson = resolve('package.json');
  for (const required of [ appJs, packageJson ]) {
    if (!existsSync(required)) {
      throw new StageError(STAGE, {
        code: 'missing_scaffold_file',
        cause: new Error(`expected ${required} in the cloned starter`)
      });
    }
  }

  try {
    // Non-secret identity only.
    replaceInFile(appJs, /(shortName:).*?,/gi, `$1 '${shortName}',`);
    replaceInFile(packageJson, /("name":).*?,/g, `$1 "${shortName}",`);

    // Deliver our own .env template(s) and fill the generated secrets.
    const envFiles = [];
    const appEnv = join(appRoot, '.env');
    writeIfAbsent(
      appEnv, external ? externalBackendEnv(frontend) : standaloneEnv()
    );
    upsertEnv(appEnv, generatedSecrets());
    envFiles.push(appEnv);

    if (external) {
      const frontendDir = join(projectDir, 'frontend');
      if (existsSync(frontendDir)) {
        const frontEnv = join(frontendDir, '.env');
        writeIfAbsent(frontEnv, externalFrontendEnv(frontend));
        envFiles.push(frontEnv);
      }
    }

    return {
      frontend,
      appRoot,
      envFiles
    };
  } catch (err) {
    if (err instanceof StageError) {
      throw err;
    }
    throw new StageError(STAGE, {
      code: 'scaffold_io',
      cause: err
    });
  }
}
