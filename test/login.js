const t = require('../test-lib/test.js');
const assert = require('assert').strict;

describe('Login', function () {
  let apos;
  let resetUserId;
  let resetToken;

  this.timeout(20000);

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              adminApiKey: {
                role: 'admin'
              }
            }
          }
        },
        '@apostrophecms/login': {
          options: {
            passwordReset: true,
            environmentLabel: 'test'
          }
        }
      }
    });
  });

  after(function () {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async function () {
    assert(apos);

    assert(apos.modules['@apostrophecms/login']);
    assert(apos.user.safe.remove);
    const response = await apos.user.safe.removeMany({});
    assert(response.result.ok === 1);

    const loginModule = apos.modules['@apostrophecms/login'];
    const context = await loginModule.getContext();
    assert(context.env === 'test');
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

    const user2 = apos.user.newInstance();
    user2.title = 'Bob Smith';
    user2.username = 'BobSmith';
    user2.password = 'bobsmith';
    user2.email = 'bobsmith@aol.com';
    user2.role = 'guest';
    await apos.user.insert(apos.task.getReq(), user2);
  });

  it('should throttle login attempts and show a proper error when the limit is reached', async function () {
    const loginModule = apos.modules['@apostrophecms/login'];
    const { allowedAttempts } = loginModule.options.throttle;
    const jar = apos.http.jar();
    const username = 'HarryPutter';
    // establish session
    const page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    for (let index = 0; index <= allowedAttempts; index++) {
      try {
        await apos.http.post(
          '/api/v1/@apostrophecms/login/login',
          {
            method: 'POST',
            body: {
              username,
              password: 'badpassword',
              session: true
            },
            jar
          }
        );

      } catch ({ body }) {
        if (index < allowedAttempts) {
          assert(body.message === 'Your credentials are incorrect, or there is no such user');
        } else {
          assert(body.message === 'Too many attempts. You may try again in a minute.');
        }
      }
    }

    await loginModule.clearLoginAttempts(username);
  });

  it('should be able to login a user with their username', async function () {
    const getLoggedInCookieValue =
      jar => jar.toJSON().cookies.find(cookie => cookie.key === `${apos.options.shortName}.loggedIn`).value;

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
    assert(page.match(/Harry Putter/));
    assert(getLoggedInCookieValue(jar) === 'true');

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
    assert(getLoggedInCookieValue(jar) === 'false');
  });

  it('should be able to login a user with their email', async function () {

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

  it('changing a user\'s password should invalidate sessions for that user', async function () {

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

  it('changing a user\'s password should invalidate bearer tokens for that user', async function () {

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

  it('api key should beat session when both are present', async function () {
    const jar = apos.http.jar();
    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'BobSmith',
          password: 'bobsmith',
          session: true
        },
        jar
      }
    );

    const page = await apos.http.get(
      '/',
      {
        jar
      }
    );
    assert(page.match(/logged in/));
    assert(page.match(/Bob Smith/));

    const page2 = await apos.http.get(
      '/',
      {
        jar,
        headers: {
          Authorization: 'ApiKey adminApiKey'
        }
      }
    );
    assert(page2.match(/logged in/));
    assert(!page2.match(/Bob Smith/));
    assert(page2.match(/System Task/));
  });

  it('should validate POST /login/reset-request', async function () {
    const jar = apos.http.jar();
    await apos.http.get(
      '/',
      {
        jar
      }
    );

    await assert.rejects(() => apos.http.post(
      '/api/v1/@apostrophecms/login/reset-request',
      {
        body: {
          session: true
        },
        jar
      }
    ), {
      status: 400
    });
  });

  it('should hide sensitive exceptions POST /login/reset-request', async function () {
    let log;
    const orig = apos.util.error;
    apos.util.error = (m) => {
      log = m;
    };
    const jar = apos.http.jar();
    await apos.http.get(
      '/',
      {
        jar
      }
    );
    await apos.http.post(
      '/api/v1/@apostrophecms/login/reset-request',
      {
        body: {
          email: 'invalidUser',
          session: true
        },
        jar
      }
    );
    assert.match(log, /invalidUser/);

    const user = apos.user.newInstance();
    user.title = 'noEmail';
    user.username = 'noEmail';
    user.password = 'secret';
    user.role = 'guest';
    await apos.user.insert(apos.task.getReq(), user);

    await apos.http.post(
      '/api/v1/@apostrophecms/login/reset-request',
      {
        body: {
          email: 'noEmail',
          session: true
        },
        jar
      }
    );
    assert.match(log, /noEmail/);

    apos.util.error = orig;
  });

  it('should reset password POST /login/reset-request (request)', async function () {
    let args;
    const orig = apos.login.email;
    apos.login.email = (req, ...a) => {
      args = a;
    };
    const jar = apos.http.jar();
    await apos.http.get(
      '/',
      {
        jar
      }
    );

    let user = apos.user.newInstance();
    user.title = 'resetUser';
    user.email = 'resetUser@example.com';
    user.username = 'resetUser';
    user.password = 'secret';
    user.role = 'guest';
    user = await apos.user.insert(apos.task.getReq(), user);
    resetUserId = user._id;

    await apos.http.post(
      '/api/v1/@apostrophecms/login/reset-request',
      {
        body: {
          email: 'resetUser',
          session: true
        },
        jar
      }
    );

    {
      assert(Array.isArray(args));
      const [ template, data, opts ] = args;
      assert(template);
      assert.deepEqual(data.user._id, user._id);
      assert(data.user.passwordResetAt);
      assert.match(data.url, /\/login\?reset=/);
      assert.match(data.url, /&email=/);
      assert(data.site);
      assert.equal(opts.to, user.email);
      assert(opts.subject);
    }

    await apos.http.post(
      '/api/v1/@apostrophecms/login/reset-request',
      {
        body: {
          email: 'resetUser@example.com',
          session: true
        },
        jar
      }
    );

    {
      assert(Array.isArray(args));
      const [ template, data, opts ] = args;
      assert(template);
      assert.deepEqual(data.user._id, user._id);
      assert(data.user.passwordResetAt);
      assert.match(data.url, /\/login\?reset=/);
      assert.match(data.url, /&email=/);
      assert(data.site);
      assert.equal(opts.to, user.email);
      assert(opts.subject);

      // Safe the token for the reset tests
      const url = new URL(data.url);
      resetToken = url.searchParams.get('reset');
    }

    apos.login.email = orig;
  });

  it('should reset password GET /login/reset (validate)', async function () {
    const user = await apos.doc.db.findOne({ _id: resetUserId });

    // Fail
    await assert.rejects(() => apos.http.get(
      '/api/v1/@apostrophecms/login/reset',
      {
        qs: {}
      }
    ), {
      status: 400
    });
    await assert.rejects(() => apos.http.get(
      '/api/v1/@apostrophecms/login/reset',
      {
        qs: {
          reset: 'invalid',
          email: user.username
        }
      }
    ), {
      status: 400
    });
    await assert.rejects(() => apos.http.get(
      '/api/v1/@apostrophecms/login/reset',
      {
        qs: {
          reset: resetToken,
          email: 'invalid'
        }
      }
    ), {
      status: 400
    });

    // Success
    await apos.http.get(
      '/api/v1/@apostrophecms/login/reset',
      {
        qs: {
          reset: resetToken,
          email: user.username
        }
      }
    );

    await apos.http.get(
      '/api/v1/@apostrophecms/login/reset',
      {
        qs: {
          reset: resetToken,
          email: user.email
        }
      }
    );
  });

  it('should reset password POST /login/reset (validate & reset)', async function () {
    const jar = apos.http.jar();
    const user = await apos.doc.db.findOne({ _id: resetUserId });
    await apos.http.get(
      '/',
      {
        jar
      }
    );

    // Validate
    await assert.rejects(() => apos.http.post(
      '/api/v1/@apostrophecms/login/reset',
      {
        body: {
          session: true
        },
        jar
      }
    ), {
      status: 400
    });
    await assert.rejects(() => apos.http.post(
      '/api/v1/@apostrophecms/login/reset',
      {
        body: {
          reset: 'invalid',
          email: user.email,
          password: 'new more secret',
          session: true
        },
        jar
      }
    ), {
      status: 400
    });
    await assert.rejects(() => apos.http.post(
      '/api/v1/@apostrophecms/login/reset',
      {
        body: {
          reset: resetToken,
          email: 'invalid',
          password: 'new more secret',
          session: true
        },
        jar
      }
    ), {
      status: 400
    });
    await assert.rejects(() => apos.http.post(
      '/api/v1/@apostrophecms/login/reset',
      {
        body: {
          reset: resetToken,
          email: user.email,
          password: '',
          session: true
        },
        jar
      }
    ), {
      status: 400
    });
    await assert.rejects(() => apos.http.post(
      '/api/v1/@apostrophecms/login/reset',
      {
        body: {
          // explicit check for boolean cheat!
          reset: false,
          email: user.email,
          password: 'new more secret',
          session: true
        },
        jar
      }
    ), {
      status: 400
    });

    // Reset
    await apos.http.post(
      '/api/v1/@apostrophecms/login/reset',
      {
        body: {
          reset: resetToken,
          email: user.email,
          password: 'new more secret',
          session: true
        },
        jar
      }
    );

    // Can not reset anymore
    await assert.rejects(() => apos.http.post(
      '/api/v1/@apostrophecms/login/reset',
      {
        body: {
          reset: resetToken,
          email: user.email,
          password: 'new even more secret',
          session: true
        },
        jar
      }
    ), {
      status: 400
    });

    // Login with the new password
    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        body: {
          username: user.email,
          password: 'new more secret',
          session: true
        },
        jar
      }
    );
    const page = await apos.http.get(
      '/',
      {
        jar
      }
    );
    assert(page.match(/logged in/));
  });

  it('should find user by reset data', async function () {
    let user = apos.user.newInstance();
    user.title = 'getResetUser';
    user.email = 'getResetUser@example.com';
    user.username = 'getResetUser';
    user.password = 'secret';
    user.role = 'guest';
    user = await apos.user.insert(apos.task.getReq(), user);

    // Find by email
    {
      const found = await apos.login.getPasswordResetUser(user.email);
      assert.equal(found._id, user._id);
    }
    // Find by username
    {
      const found = await apos.login.getPasswordResetUser(user.username);
      assert.equal(found._id, user._id);
    }
    // Fail with no token
    await assert.rejects(
      () => apos.login.getPasswordResetUser(user.username, ''),
      {
        message: 'invalid'
      }
    );
    await assert.rejects(
      () => apos.login.getPasswordResetUser(user.username, null),
      {
        message: 'invalid'
      }
    );
    await assert.rejects(
      () => apos.login.getPasswordResetUser(user.username, 'invalid'),
      {
        message: 'notfound'
      }
    );

    user.passwordReset = 'secret';
    user.passwordResetAt = new Date();
    user = await apos.user.update(apos.task.getReq(), user);
    // Find by email and validate token
    {
      const found = await apos.login.getPasswordResetUser(user.email, 'secret');
      assert.equal(found._id, user._id);
    }
    // // Find by username and validate token
    {
      const found = await apos.login.getPasswordResetUser(user.username, 'secret');
      assert.equal(found._id, user._id);
    }
    await assert.rejects(
      () => apos.login.getPasswordResetUser(user.username, 'invalid'),
      {
        message: 'Incorrect passwordReset'
      }
    );

    // Expired
    user.passwordResetAt = new Date(0);
    user = await apos.user.update(apos.task.getReq(), user);
    await assert.rejects(
      () => apos.login.getPasswordResetUser(user.username, 'invalid'),
      {
        message: 'notfound'
      }
    );
  });

  it('should return an error with code 404 at GET login/whoami when user is not logged in', async function () {
    try {
      const jar = apos.http.jar();
      await apos.http.get(
        '/',
        {
          jar
        }
      );
      await apos.http.post('/api/v1/@apostrophecms/login/whoami',
        {
          method: 'POST',
          body: {
            session: true
          },
          jar
        }
      );
      assert.fail('Expected error but got success');
    } catch (err) {
      assert.strictEqual(err.status, 404);
    }
  });

  it('should return user data at GET login/whoami when user is logged in', async function () {

    const jar = apos.http.jar();
    await apos.http.get(
      '/',
      {
        jar
      }
    );

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'AnotherLovelyPassword',
          session: true
        },
        jar
      }
    );

    const whoamiResponse = await apos.http.post('/api/v1/@apostrophecms/login/whoami', {
      method: 'POST',
      body: {
        session: true
      },
      jar
    });
    assert.ok(whoamiResponse._id);
    assert.strictEqual(whoamiResponse.username, 'HarryPutter');
    assert.strictEqual(whoamiResponse.title, 'Extra Cool Putter');
    assert.strictEqual(whoamiResponse.email, 'hputter@aol.com');
  });

  it('should return user data with additional whoamiFields if explicitly added to the login module options when user is logged in', async function () {

    const jar = apos.http.jar();
    await apos.http.get(
      '/',
      {
        jar
      }
    );

    apos.modules['@apostrophecms/login'].options.whoamiFields = [ 'role' ];

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'AnotherLovelyPassword',
          session: true
        },
        jar
      }
    );

    const whoamiResponse = await apos.http.post('/api/v1/@apostrophecms/login/whoami', {
      method: 'POST',
      body: {
        session: true
      },
      jar
    });
    assert.strictEqual(whoamiResponse.role, 'admin');
  });

  it('should not return user data with additional whoamiFields if not explicitly added to the login module options when user is logged in', async function () {

    const jar = apos.http.jar();
    await apos.http.get(
      '/',
      {
        jar
      }
    );

    // Reset the whoamiFields to default (empty)
    apos.modules['@apostrophecms/login'].options.whoamiFields = [];

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'AnotherLovelyPassword',
          session: true
        },
        jar
      }
    );

    const whoamiResponse = await apos.http.post('/api/v1/@apostrophecms/login/whoami', {
      method: 'POST',
      body: {
        session: true
      },
      jar
    });
    assert.ok(!('role' in whoamiResponse));
  });
});
