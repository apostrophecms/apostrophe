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
      root: module,
      modules: {
        '@apostrophecms/login': {
          requirements(self) {
            return {
              add: {
                WeakCaptcha: {
                  phase: 'beforeSubmit',
                  async verify(req) {
                    if (req.body.requirements.WeakCaptcha !== 'xyz') {
                      throw self.apos.error('invalid', 'captcha code incorrect');
                    }
                  }
                },
                MathProblem: {
                  phase: 'afterSubmit',
                  async verify(req) {
                    if (req.body.requirements.MathProblem !== 10) {
                      throw self.apos.error('invalid', 'math problem incorrect');
                    }
                  }
                },
                ExtraSecret: {
                  phase: 'afterPasswordVerified',
                  async verify(req, user) {
                    if (req.body.requirements.ExtraSecret !== user.extraSecret) {
                      throw self.apos.error('invalid', 'extra secret incorrect');
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

    try {
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
      assert(false);
    } catch (e) {
      assert(e.status === 400);
      assert.strictEqual(e.body.message, 'captcha code incorrect');
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
              WeakCaptcha: 'abc'
            }
          },
          jar
        }
      );
      assert(false);
    } catch (e) {
      assert(e.status === 400);
      assert.strictEqual(e.body.message, 'captcha code incorrect');
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

  it('should graduate to the afterSubmit requirement when meeting the beforeSubmit requirement', async function() {

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
              WeakCaptcha: 'xyz'
            }
          },
          jar
        }
      );
    } catch (e) {
      assert(e.status === 400);
      assert.strictEqual(e.body.message, 'math problem incorrect');
      assert.strictEqual(e.body.data.requirement, 'MathProblem');
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

  it('initial login should produce an incompleteToken, convertible with the afterPasswordVerified requirements', async function() {

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
            MathProblem: 10
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
      await apos.http.post(
        '/api/v1/@apostrophecms/login/login',
        {
          method: 'POST',
          body: {
            incompleteToken: token,
            session: true,
            requirements: {
              ExtraSecret: 'roll-off'
            }
          },
          jar
        }
      );
    } catch (e) {
      assert(e.status === 400);
      assert.strictEqual(e.body.message, 'extra secret incorrect');
      assert.strictEqual(e.body.data.requirement, 'ExtraSecret');
    }

    // Make sure it did not create a login session prematurely
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged out/));

    // Now convert token to an actual login session
    // by providing the post-password-verification requirements,
    // correctly

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          incompleteToken: token,
          session: true,
          requirements: {
            ExtraSecret: 'roll-on'
          }
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
