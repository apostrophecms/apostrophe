const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Login', function() {

  let apos;

  const extraSecretErr = 'extra secret incorrect';
  const captchaErr = 'captcha code incorrect';
  const uponSubmitErr = 'uponSubmit incorrect';

  this.timeout(20000);

  this.beforeEach(async function() {
    if (apos && apos.modules && apos.modules['@apostrophecms/login']) {
      const loginModule = apos.modules['@apostrophecms/login'];
      await loginModule.clearLoginAttempts('HarryPutter');
    }
  });

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/login': {
          requirements(self) {
            return {
              add: {
                WeakCaptcha: {
                  phase: 'beforeSubmit',
                  async props(req) {
                    return {
                      hint: 'xyz'
                    };
                  },
                  async verify(req, data) {
                    if (data !== 'xyz') {
                      throw self.apos.error('invalid', captchaErr);
                    }
                  }
                },

                UponSubmit: {
                  phase: 'uponSubmit',
                  async props(req) {
                    return {
                      hint: 'abc'
                    };
                  },
                  async verify(req, data) {
                    if (data !== 'abc') {
                      throw self.apos.error('invalid', uponSubmitErr);
                    }
                  }
                },

                ExtraSecret: {
                  phase: 'afterPasswordVerified',
                  async props(req, user) {
                    return {
                      // Verify we had access to the user here
                      hint: user.username
                    };
                  },
                  async verify(req, data, user) {
                    if (data !== user.extraSecret) {
                      throw self.apos.error('invalid', extraSecretErr);
                    }
                  }
                }
              }
            };
          }
        }
      }
    });

    assert(apos.modules['@apostrophecms/login']);
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
    user.extraSecret = 'roll-on';

    assert(user.type === '@apostrophecms/user');
    assert(apos.user.insert);
    const doc = await apos.user.insert(apos.task.getReq(), user);
    assert(doc._id);
  });

  it('should not be able to login a user without meeting a beforeSubmit requirement', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    const context = await apos.http.post(
      '/api/v1/@apostrophecms/login/context',
      {
        method: 'POST',
        body: {},
        jar
      }
    );
    assert(context.requirementProps);
    assert(context.requirementProps.WeakCaptcha);
    assert.strictEqual(context.requirementProps.WeakCaptcha.hint, 'xyz');

    try {
      await apos.http.post(
        '/api/v1/@apostrophecms/login/login',
        {
          method: 'POST',
          body: {
            username: 'HarryPutter',
            password: 'crookshanks',
            session: true,
            requirements: {
              UponSubmit: 'abc'
            }
          },
          jar
        }
      );
      assert(false);
    } catch (e) {
      assert(e.status === 400);
      assert.strictEqual(e.body.message, captchaErr);
      assert.strictEqual(e.body.data.requirement, 'WeakCaptcha');
    }

    // Make sure it really didn't work
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));
  });

  it('should not be able to login a user with the wrong value for a beforeSubmit requirement', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    try {
      await apos.http.post(
        '/api/v1/@apostrophecms/login/login',
        {
          method: 'POST',
          body: {
            username: 'HarryPutter',
            password: 'crookshanks',
            session: true,
            requirements: {
              WeakCaptcha: 'abc',
              UponSubmit: 'abc'
            }
          },
          jar
        }
      );
      assert(false);
    } catch (e) {
      assert(e.status === 400);
      assert.strictEqual(e.body.message, captchaErr);
      assert.strictEqual(e.body.data.requirement, 'WeakCaptcha');
    }

    // Make sure it really didn't work
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));
  });

  it('should not be able to login a user without meeting an uponSubmit requirement', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    const context = await apos.http.post(
      '/api/v1/@apostrophecms/login/context',
      {
        method: 'POST',
        body: {},
        jar
      }
    );
    assert(context.requirementProps);
    assert(context.requirementProps.UponSubmit);
    assert(context.requirementProps.WeakCaptcha);
    assert.strictEqual(context.requirementProps.UponSubmit.hint, 'abc');

    try {
      await apos.http.post(
        '/api/v1/@apostrophecms/login/login',
        {
          method: 'POST',
          body: {
            username: 'HarryPutter',
            password: 'crookshanks',
            session: true,
            requirements: {
              WeakCaptcha: 'xyz'
            }
          },
          jar
        }
      );
      assert(false);
    } catch (e) {
      assert(e.status === 400);
      assert.strictEqual(e.body.message, uponSubmitErr);
      assert.strictEqual(e.body.data.requirement, 'UponSubmit');
    }

    // Make sure it really didn't work
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));
  });

  it('should not be able to login a user with the wrong value for a uponSubmit requirement', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    try {
      await apos.http.post(
        '/api/v1/@apostrophecms/login/login',
        {
          method: 'POST',
          body: {
            username: 'HarryPutter',
            password: 'crookshanks',
            session: true,
            requirements: {
              WeakCaptcha: 'xyz',
              UponSubmit: 'xyz'
            }
          },
          jar
        }
      );
      assert(false);
    } catch (e) {
      assert(e.status === 400);
      assert.strictEqual(e.body.message, uponSubmitErr);
      assert.strictEqual(e.body.data.requirement, 'UponSubmit');
    }

    // Make sure it really didn't work
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));
  });

  it('should throttle requirements verify attemps and show a proper error when the limit is reached', async function () {
    const loginModule = apos.modules['@apostrophecms/login'];
    const { allowedAttempts } = loginModule.options.throttle;
    const namespace = '@apostrophecms/loginAttempt/ExtraSecret';

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    const result = await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'crookshanks',
          session: true,
          requirements: {
            WeakCaptcha: 'xyz',
            UponSubmit: 'abc'
          }
        },
        jar
      }
    );

    assert(result.incompleteToken);

    // Make sure it did not create a login session prematurely
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    const token = result.incompleteToken;

    for (let index = 0; index <= allowedAttempts; index++) {
      try {
        await apos.http.post('/api/v1/@apostrophecms/login/requirement-verify', {
          body: {
            incompleteToken: token,
            session: true,
            name: 'ExtraSecret',
            value: 'roll-off'
          },
          jar
        });
      } catch ({ status, body }) {
        if (index < allowedAttempts) {
          assert(body.message === extraSecretErr);
        } else {
          assert(body.message === 'Too many attempts. You may try again in a minute.');
        }
      }
    }

    await loginModule.clearLoginAttempts('HarryPutter', namespace);
  });

  it('initial login should produce an incompleteToken, convertible with the afterPasswordVerified requirements', async function() {

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    const result = await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: 'HarryPutter',
          password: 'crookshanks',
          session: true,
          requirements: {
            WeakCaptcha: 'xyz',
            UponSubmit: 'abc'
          }
        },
        jar
      }
    );

    assert(result.incompleteToken);

    // Make sure it did not create a login session prematurely
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    // Make sure it won't convert with an incorrect ExtraSecret

    const token = result.incompleteToken;

    try {
      await apos.http.post('/api/v1/@apostrophecms/login/requirement-verify', {
        body: {
          incompleteToken: token,
          session: true,
          name: 'ExtraSecret',
          value: 'roll-off'
        },
        jar
      });
    } catch ({ status, body }) {
      assert(status === 400);
      assert.strictEqual(body.message, extraSecretErr);
      assert.strictEqual(body.data.requirement, 'ExtraSecret');
    }

    // If we try the final login without
    // having successfully verified all requirements we get an error
    try {
      await apos.http.post(
        '/api/v1/@apostrophecms/login/login',
        {
          method: 'POST',
          body: {
            incompleteToken: token,
            session: true
          },
          jar
        }
      );
    } catch ({ status, body }) {
      assert(status === 403);
      assert.strictEqual(body.message, 'All requirements must be verified');
    }

    // Make sure it did not create a login session prematurely
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    // Fetch props for afterPasswordVerified component

    const props = await apos.http.post(
      '/api/v1/@apostrophecms/login/requirement-props',
      {
        method: 'POST',
        body: {
          incompleteToken: token,
          name: 'ExtraSecret'
        },
        jar
      }
    );

    assert.strictEqual(props.hint, 'HarryPutter');

    // Now convert token to an actual login session
    // by providing the post-password-verification requirements,
    // correctly

    await apos.http.post('/api/v1/@apostrophecms/login/requirement-verify', {
      body: {
        incompleteToken: token,
        session: true,
        name: 'ExtraSecret',
        value: 'roll-on'
      },
      jar
    });

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          incompleteToken: token,
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
  });

});
