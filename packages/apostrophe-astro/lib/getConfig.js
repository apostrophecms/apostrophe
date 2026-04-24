// Runtime config reader for server-side .js files that may be loaded
// by Node.js natively (externalized) during Astro v6 static builds.
// In that context Vite's plugin system is not active, so
// `virtual:apostrophe-config` cannot be resolved — hence this file.
//
// .astro components are always processed by Vite and continue to use
// `virtual:apostrophe-config` directly so HMR and build-time inlining
// still work for them.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const configPath = join(
  process.cwd(),
  'node_modules',
  '.apostrophe-astro',
  '_runtime-config.json'
);

let cachedConfig;

function load() {
  if (cachedConfig) {
    return cachedConfig;
  }
  try {
    cachedConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    return cachedConfig;
  } catch (error) {
    if (process.env.APOS_HOST && error.code === 'ENOENT') {
      return {
        aposHost: process.env.APOS_HOST,
        aposPrefix: process.env.APOS_PREFIX || ''
      };
    }
    const reason = error instanceof SyntaxError
      ? `invalid JSON in ${configPath}`
      : `missing runtime config at ${configPath}`;
    throw new Error(
      `Apostrophe Astro runtime config is unavailable: ${reason}. ` +
      'Ensure the Apostrophe Astro integration is registered in astro.config and its astro:config:setup hook runs before server helpers are used.'
    );
  }
}

const config = new Proxy({}, {
  get(_target, prop) {
    return load()[prop];
  },
  has(_target, prop) {
    return prop in load();
  },
  ownKeys() {
    return Reflect.ownKeys(load());
  },
  getOwnPropertyDescriptor(_target, prop) {
    const loaded = load();
    if (prop in loaded) {
      return {
        enumerable: true,
        configurable: true
      };
    }
  }
});

export function getConfig() {
  return load();
}

export default config;
