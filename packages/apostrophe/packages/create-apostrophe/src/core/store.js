// Local persistent key/value store.

import {
  mkdirSync, readFileSync, writeFileSync, renameSync, rmSync
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Keys this store is allowed to hold. Anything else is a programmer error
 * (a thrown TypeError).
 */
export const KNOWN_KEYS = Object.freeze([ 'telemetryConsent', 'anonymousId' ]);

const APP_DIR = 'create-apostrophe';

/**
 * Per-OS user config directory, replicating the env-paths/XDG conventions
 * with Node built-ins only (no dependency):
 *   - Windows: %APPDATA%            (…/AppData/Roaming fallback)
 *   - macOS:   ~/Library/Preferences
 *   - other:   $XDG_CONFIG_HOME     (~/.config fallback)
 * @returns {string}
 */
export function configDir() {
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(base, APP_DIR, 'Config');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Preferences', APP_DIR);
  }
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, APP_DIR);
}

/** Default backing-file path (…/create-apostrophe/store.json). */
export function defaultStorePath() {
  return join(configDir(), 'store.json');
}

function readAll(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  // Atomic replace on the same filesystem: a reader sees either the old or
  // the new file, never a half-written one.
  renameSync(tmp, file);
}

function assertKnown(key) {
  if (!KNOWN_KEYS.includes(key)) {
    throw new TypeError(
      `Unknown store key: ${key}. Allowed: ${KNOWN_KEYS.join(', ')}`
    );
  }
}

/**
 * Open the store. Pass `dir` to override the location — unit tests point it
 * at a temp dir; production uses the per-OS user config dir.
 * @param {{ dir?: string }} [opts]
 * @returns {{
 *   path: string,
 *   get(key: string): *,
 *   set(key: string, value: *): void,
 *   delete(key: string): void,
 *   clear(): void,
 *   all(): object
 * }}
 */
export function createStore({ dir } = {}) {
  const file = dir ? join(dir, 'store.json') : defaultStorePath();

  return {
    path: file,

    get(key) {
      assertKnown(key);
      return readAll(file)[key];
    },

    set(key, value) {
      assertKnown(key);
      const data = readAll(file);
      data[key] = value;
      writeAll(file, data);
    },

    delete(key) {
      assertKnown(key);
      const data = readAll(file);
      delete data[key];
      writeAll(file, data);
    },

    clear() {
      rmSync(file, { force: true });
    },

    all() {
      return readAll(file);
    }
  };
}
