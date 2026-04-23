// Minimal test to isolate what causes the hang.
// Must reference the test/ directory as root for proper module resolution.
const t = require('../test-lib/test.js');
const path = require('path');

// Fake a module object rooted in test/ like the real tests do
const fakeModule = {
  id: path.join(__dirname, '../test/fake'),
  filename: path.join(__dirname, '../test/fake.js'),
  paths: [path.join(__dirname, '../test/node_modules')]
};

describe('Minimal hang test', function() {
  this.timeout(60000);
  let apos;

  after(async function() {
    await t.destroy(apos);
    console.log('after: destroy complete');
  });

  it('should create and use apos without hanging', async function() {
    apos = await t.create({
      root: fakeModule
    });
    console.log('apos created successfully');
  });
});
