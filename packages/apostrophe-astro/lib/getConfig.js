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

function load() {
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {
      aposHost: process.env.APOS_HOST || '',
      aposPrefix: process.env.APOS_PREFIX || '',
    };
  }
}

export default load();
