const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Db', function() {
  after(async function () {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should exist on the apos object', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      }
    });

    assert(apos.db);
    // Verify a normal, boring connection to localhost without the db option worked
    const doc = await apos.docs.db.findOne();

    assert(doc);
  });

  it('should be able to launch a second instance reusing the connection', async function() {
    const apos2 = await require('../index.js')({
      root: module,
      shortName: 'test2',
      argv: {
        _: []
      },
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7777
          }
        },
        '@apostrophecms/db': {
          db: apos.db,
          uri: 'mongodb://this-will-not-work-unless-db-successfully-overrides-it/fail'
        }
      }
    });

    const doc = await apos.docs.db.findOne();

    assert(doc);

    return t.destroy(apos2);
  });
});
