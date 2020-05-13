const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;
let jar;

describe('Docs', function() {
  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        '@apostrophecms/express': {
          options: {
            session: {
              secret: 'Adipiscing'
            },
            port: 7900
          }
        },
        'test-people': {
          extend: '@apostrophecms/doc-type-manager',
          fields: {
            add: {
              _friend: {
                type: 'joinByOne',
                withType: 'test-people',
                idField: 'friendId',
                label: 'Friend'
              }
            }
          }
        }
      },
      argv: {
        _: []
      }
    });

    apos.argv._ = [];

    const testItems = [];
    let i;

    for (i = 0; (i < 100); i++) {
      testItems.push({
        _id: 'i' + i,
        slug: 'i' + i,
        published: true,
        type: 'test',
        title: 'title: ' + i
      });
    }
    await apos.docs.db.insertMany(testItems);

    const user = apos.users.newInstance();
    user.firstName = 'ad';
    user.lastName = 'min';
    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.permissions = [ 'admin' ];
    await apos.users.insert(apos.tasks.getReq(), user);

    jar = apos.http.jar();
    // establish session
    await apos.http.get('http://localhost:7900/', {
      jar
    });
    // Log in
    await apos.http.post('http://localhost:7900/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin'
      },
      jar
    });

    // Confirm login
    await apos.http.get('http://localhost:7900/', {
      jar
    });
  });

  it('should be able to lock a document', async function() {
    return apos.http.post('http://localhost:7900/api/v1/@apostrophecms/docs/lock', {
      body: {
        _id: 'i27',
        htmlPageId: 'abc'
      },
      jar
    });
  });

  it('should not be able to lock a document when not logged in', async function() {
    try {
      await apos.http.post('http://localhost:7900/api/v1/@apostrophecms/docs/lock', {
        body: {
          _id: 'i27',
          htmlPageId: 'abc'
        }
      });
      assert(false);
    } catch (error) {
      assert(error);
      assert(error.status === 403);
    }
  });

  it('should not be able to lock a document with a different contextId', async function() {
    try {
      await apos.http.post('http://localhost:7900/api/v1/@apostrophecms/docs/lock', {
        body: {
          _id: 'i27',
          htmlPageId: 'def'
        },
        jar
      });
      assert(false);
    } catch (error) {
      assert(error);
      assert(error.status === 409);
      assert(error.body.me);
    }
  });

  it('should be able to unlock a document', async function() {
    try {
      await apos.http.post('http://localhost:7900/api/v1/@apostrophecms/docs/unlock', {
        body: {
          _id: 'i27',
          htmlPageId: 'abc'
        },
        jar
      });
    } catch (error) {
      assert(false);
    }
  });

  it('should be able to re-lock an unlocked document', async function() {
    try {
      await apos.http.post('http://localhost:7900/api/v1/@apostrophecms/docs/lock', {
        body: {
          _id: 'i27',
          htmlPageId: 'def'
        },
        jar
      });
    } catch (error) {
      assert(false);
    }
  });

  it('should be able to lock a locked document with force: true', async function() {
    try {
      await apos.http.post('http://localhost:7900/api/v1/@apostrophecms/docs/lock', {
        body: {
          _id: 'i27',
          htmlPageId: 'abc',
          force: true
        },
        jar
      });
    } catch (error) {
      assert(false);
    }
  });
});
