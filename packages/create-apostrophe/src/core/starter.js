// Custom-starter support for the `--starter` option. A "starter" escapes the
// fixed kit registry (core/kits.js): instead of one of the six known kits, the
// installer clones an arbitrary git repository the developer names directly.
// This module owns the two things that differ from a registry kit — turning the
// `--starter` value into a clone URL, and discovering the project layout after
// the clone (a registry kit declares its frontend up front; a custom one can't).

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** @typedef {import('./kits.js').Frontend} Frontend */

/**
 * Telemetry kitId reported for a custom `--starter` install. Deliberately NOT a
 * member of the kit registry — `getKit`/`isKnownKit` still reject it — so the
 * six-kit invariants hold; the telemetry schema allowlists it on its own so the
 * "which kit?" question stays answerable as "a custom one".
 * @type {'custom'}
 */
export const CUSTOM_KIT_ID = 'custom';

/**
 * A `--starter` value resolved to something clonable.
 * @typedef {object} ResolvedStarter
 * @property {string} repo    Clone URL handed to `git clone`.
 * @property {string} source  The original `--starter` input, kept verbatim for
 *                            display in the review/summary screens.
 */

/**
 * Resolve a `--starter` value to a git clone URL. Three forms, matched in order
 * (the grammar the legacy `@apostrophecms/cli` accepted, preserved exactly):
 *
 *   1. A URL with a scheme (`https:`, `git:`, …) — used verbatim.
 *      e.g. `https://github.com/apostrophecms/apostrophe-open-museum.git`
 *   2. A value containing `/` — treated as a GitHub `org/repo` (a leading `/`
 *      is dropped). e.g. `mycoolcompany/my-starter` →
 *      `https://github.com/mycoolcompany/my-starter`
 *   3. A bare name — a shorthand for an official starter kit, expanded to
 *      `starter-kit-<name>`. e.g. `ecommerce` →
 *      `https://github.com/apostrophecms/starter-kit-ecommerce.git`
 *
 * @param {string} input  The raw `--starter` value.
 * @returns {ResolvedStarter}
 * @throws {TypeError} when `input` is missing or blank.
 */
export function resolveStarter(input) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new TypeError(
      'A --starter value is required (a starter-kit name, an org/repo, or a git URL).'
    );
  }
  const value = input.trim();
  let repo;
  if (/^\w+:/.test(value)) {
    repo = value;
  } else if (value.includes('/')) {
    repo = `https://github.com/${value.startsWith('/') ? value.slice(1) : value}`;
  } else {
    repo = `https://github.com/apostrophecms/starter-kit-${value}.git`;
  }
  return {
    repo,
    source: value
  };
}

/**
 * Discover a freshly cloned custom starter's frontend. A hybrid Astro project
 * nests the Apostrophe app under `backend/`; a standalone project keeps it at
 * the root. Mirrors the legacy CLI's auto-detection, and the README's promise
 * that hybrid projects are "automatically detected by the presence of a
 * `backend/` directory."
 *
 * @param {string} projectDir  The cloned project's root.
 * @returns {Frontend} `'astro'` when a `backend/` directory exists, else `null`.
 */
export function detectFrontend(projectDir) {
  return existsSync(join(projectDir, 'backend')) ? 'astro' : null;
}
