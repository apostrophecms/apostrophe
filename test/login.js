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
    apos = await t.create({
      root: module
    });

    assert(apos.modules['@apostrophecms/login']);
    assert(apos.user.safe.remove);
    const response = await apos.user.safe.removeMany({});
    assert(response.result.ok === 1);
  });

  it('should be able to insert test user', async function() {
    assert(apos.user.newInstance);
    const user = apos.user.newInstance();
    assert(user);

    user.title = 'Harry Putter';
    user.username = 'HarryPutter';
    user.password = 'crookshanks';
    user.email = 'hputter@aol.com';
    user.role = 'admin';

    assert(user.type === '@apostrophecms/user');
    assert(apos.user.insert);
    const doc = await apos.user.insert(apos.task.getReq(), user);
    assert(doc._id);
  });

  it('should be able to login a user with their username', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'crookshanks',
          session: true
        },
        jar
      }
    );

    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged in/));

    // otherwise logins are not remembered in a session
    await apos.http.post(
      '/api/v1/@apostrophecms/login/logout',
      {
        body: {
          username: 'hputter@aol.com',
          password: 'crookshanks',
          session: true
        },
        jar
      }
    );

    page = await apos.http.get(
      '/',
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
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        body: {
          username: 'hputter@aol.com',
          password: 'crookshanks',
          session: true
        },
        jar
      }
    );

    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    // Did we get our page back?
    assert(page.match(/logged in/));

    // otherwise logins are not remembered in a session
    await apos.http.post(
      '/api/v1/@apostrophecms/login/logout',
      {
        body: {
          username: 'hputter@aol.com',
          password: 'crookshanks',
          session: true
        },
        jar
      }
    );

    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    // are we back to being able to log in?
    assert(page.match(/logged out/));
  });

  it('Changing a user\'s password should invalidate sessions for that user', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'crookshanks',
          session: true
        },
        jar
      }
    );

    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged in/));

    const req = apos.task.getReq();
    let user = await apos.user.find(req, {
      username: 'HarryPutter'
    }).toObject();
    assert(user);
    user.password = 'VeryPasswordManySecure🐶';
    await apos.user.update(req, user);

    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(!page.match(/logged in/));
    assert(page.match(/logged out/));

    // Make sure we can come back from that
    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'VeryPasswordManySecure🐶',
          session: true
        },
        jar
      }
    );

    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged in/));

    // So we do not have a stale _passwordUpdated flag
    user = await apos.user.find(req, {
      _id: user._id
    }).toObject();

    // Unrelated writes to user should not invalidate sessions
    user.title = 'Extra Cool Putter';
    await apos.user.update(req, user);

    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged in/));

    // Marking a user account as disabled should invalidate sessions
    user.disabled = true;
    await apos.user.update(req, user);

    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    // Restore access for next test
    user.disabled = false;
    await apos.user.update(req, user);

  });

  it('Changing a user\'s password should invalidate bearer tokens for that user', async function() {

    // Log in
    let response = await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'HarryPutter',
        password: 'VeryPasswordManySecure🐶'
      }
    });
    assert(response.token);
    let token = response.token;

    // For verification: can't do this without an admin bearer token
    await apos.http.get(
      '/api/v1/@apostrophecms/user',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const req = apos.task.getReq();
    const user = await apos.user.find(req, {
      username: 'HarryPutter'
    }).toObject();
    assert(user);
    user.password = 'AnotherLovelyPassword';
    await apos.user.update(req, user);

    let failed = false;
    try {
      await apos.http.get(
        '/api/v1/@apostrophecms/user',
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      // Should NOT work
      assert(false);
    } catch (e) {
      failed = true;
      assert.strictEqual(e.status, 401);
    }
    assert(failed);

    // Make sure we can come back from that
    response = await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'HarryPutter',
        password: 'AnotherLovelyPassword'
      }
    });
    assert(response.token);
    token = response.token;

    await apos.http.get(
      '/api/v1/@apostrophecms/user',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

  });

});
