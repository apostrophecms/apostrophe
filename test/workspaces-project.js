const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const app = require('./workspaces-project/app.js');

describe('workspaces dependencies', function() {
  this.timeout(t.timeout);

  it('should allow workspaces dependency in the project', async function() {
    let apos;

    try {
      apos = await t.create(app);
      const { server } = apos.modules['@apostrophecms/express'];
      const { port } = server.address();

      const actual = apos.util.logger.getMessages();
      const expected = {
        debug: [],
        info: [ `Listening at http://localhost:${port}` ],
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
