// WHITELIST OF ADVISORY IDs
//
// '1203': mongodb 2.x driver can crash if collection name is invalid.
//
// Justification for whitelisting: only the developer can pass a
// collection name to the MongoDB API from Apostrophe.

const whitelist = [ '1203' ];

const fs = require('fs');
const report = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
const advisories = report.advisories || {};
for (const whitelisted of whitelist) {
  delete advisories[whitelisted.toString()];
}
if (Object.keys(advisories).length) {
  // eslint-disable-next-line no-console
  console.error('FAILED npm audit after whitelist check:');
  // eslint-disable-next-line no-console
  console.error(advisories);
  process.exit(1);
}
process.exit(0);
