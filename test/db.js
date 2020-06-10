const t = require('../test-lib/test.js');
const assert = require('assert');

let apos, apos2;

describe('Db', function() {

  after(async function () {
    await t.destroy(apos);
    await t.destroy(apos2);
  });

  this.timeout(t.timeout);

  it('should exist on the apos object', async function() {
    apos = await t.create({
      root: module
    });

    assert(apos.db);
    // Verify a normal, boring connection to localhost without the db option worked
    const doc = await apos.docs.db.findOne();

    assert(doc);
  });
  it('should be able to launch a second instance reusing the connection', async function() {
    apos2 = await t.create({
      root: module,
      modules: {
        '@apostrophecms/db': {
          options: {
            client: apos.dbClient,
            uri: 'mongodb://this-will-not-work-unless-db-successfully-overrides-it/fail'
          }
        }
      }
    });

    const doc = await apos2.docs.db.findOne();

    assert(doc);
  });
});
