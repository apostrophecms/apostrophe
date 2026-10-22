// The shared configuration with its advisory rules promoted to errors, for a
// codebase that is already clean and wants to stay that way:
//
// ```js
// import apostrophe from 'eslint-config-apostrophe/strict';
// ```
//
// Program output - a task's own listing, help text or report - is the one
// legitimate reason for `console` on the server, and says so at the call site
// with `// eslint-disable-next-line no-console`.

import { defineConfig } from 'eslint/config';
import config from './eslint.config.js';

export default defineConfig([
  config,
  {
    rules: {
      'no-console': 'error'
    }
  }
]);
