const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;

describe('Login', function() {

  this.timeout(20000);

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7901,
            address: 'localhost',
            session: {
              secret: 'Cursus'
            }
          }
        }
      }
    });

    assert(apos.modules['@apostrophecms/login']);
    assert(apos.users.safe.remove);
    const response = await apos.users.safe.remove({});
    assert(response.result.ok === 1);
  });

  it('should be able to insert test user', async function() {
    assert(apos.users.newInstance);
    const user = apos.users.newInstance();
    assert(user);

    user.firstName = 'Harry';
    user.lastName = 'Putter';
    user.title = 'Harry Putter';
    user.username = 'HarryPutter';
    user.password = 'crookshanks';
    user.email = 'hputter@aol.com';

    assert(user.type === '@apostrophecms/user');
    assert(apos.users.insert);
    const doc = await apos.users.insert(apos.tasks.getReq(), user);
    assert(doc._id);
  });

  it('should be able to login a user with their username', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      'http://localhost:7901/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    await apos.http.post(
      'http://localhost:7901/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'crookshanks'
        },
        jar
      }
    );

    page = await apos.http.get(
      'http://localhost:7901/',
      {
        jar
      }
    );

    assert(page.match(/logged in/));

    // otherwise logins are not remembered in a session
    await apos.http.post(
      'http://localhost:7901/api/v1/@apostrophecms/login/logout',
      {
        body: {
          username: 'hputter@aol.com',
          password: 'crookshanks'
        },
        jar
      }
    );

    page = await apos.http.get(
      'http://localhost:7901/',
      {
        jar
      }
    );

    // are we back to being able to log in?
    assert(page.match(/logged out/));
  });

  it('should be able to login a user with their email', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      'http://localhost:7901/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    await apos.http.post(
      'http://localhost:7901/api/v1/@apostrophecms/login/login',
      {
        body: {
          username: 'hputter@aol.com',
          password: 'crookshanks'
        },
        jar
      }
    );

    page = await apos.http.get(
      'http://localhost:7901/',
      {
        jar
      }
    );

    // Did we get our page back?
    assert(page.match(/logged in/));

    // otherwise logins are not remembered in a session
    await apos.http.post(
      'http://localhost:7901/api/v1/@apostrophecms/login/logout',
      {
        body: {
          username: 'hputter@aol.com',
          password: 'crookshanks'
        },
        jar
      }
    );

    page = await apos.http.get(
      'http://localhost:7901/',
      {
        jar
      }
    );

    // are we back to being able to log in?
    assert(page.match(/logged out/));
  });

});

