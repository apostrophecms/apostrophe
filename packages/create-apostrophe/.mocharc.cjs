'use strict';

// ESM specs, discovered recursively under test/. Mocha 11 runs .mjs/.js
// ESM natively (package is "type": "module").
module.exports = {
  spec: [ 'test/**/*.test.js' ],
  recursive: true,
  timeout: 10000
};
