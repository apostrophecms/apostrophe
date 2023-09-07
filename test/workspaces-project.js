const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const app = require('./workspaces-project/app.js');

describe.only('workspaces dependencies', function() {
  this.timeout(t.timeout);

  it('should allow workspace dependencies in the project', async function() {
    let apos;

    try {
      apos = await t.create(app);

      const actual = {
        debug: apos.util.info('debug'),
        info: apos.util.info('info'),
        warn: apos.util.info('warn'),
        error: apos.util.info('error')
      };
      const expected = {
        debug: [ 'debug' ],
        info: [ 'Listening at http://localhost:xxxxx', 'info' ],
        warn: [ 'warn' ],
        error: [ 'error' ]
      };

      assert.deepEqual(actual, expected);
    } catch (error) {
      assert.fail(error.message);
    } finally {
      apos && await t.destroy(apos);
    }
  });
});
