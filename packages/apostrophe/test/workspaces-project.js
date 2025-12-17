const assert = require('node:assert').strict;
const util = require('node:util');
const { exec } = require('node:child_process');
const path = require('node:path');
const t = require('../test-lib/test.js');
const app = require('./workspaces-project/app.js');

describe('workspaces dependencies', function() {
  this.timeout(t.timeout);

  before(async function() {
    await util.promisify(exec)('npm install', { cwd: path.resolve(process.cwd(), 'test/workspaces-project') });
  });

  it('should allow workspaces dependency in the project', async function() {
    let apos;

    try {
      apos = await t.create(app);
      const { server } = apos.modules['@apostrophecms/express'];
      const { address, port } = server.address();

      const actual = apos.util.logger.getMessages();
      const expected = {
        debug: [],
        info: [ `Listening at http://${address}:${port}` ],
        warn: [],
        error: []
      };

      assert.deepEqual(actual, expected);
    } catch (error) {
      assert.fail('Should have found @apostrophecms/sitemap hidden in workspace-a as a valid dependency. '.concat(error.message));
    } finally {
      apos && await t.destroy(apos);
    }
  });
});
