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

  it('should be able to log in when meeting all requirements', async function() {

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
          session: true,
          requirements: {
            WeakCaptcha: 'xyz',
            MathProblem: 10
          }
        },
        jar
      }
    );

    // Make sure it really worked
    page = await apos.http.get(
      '/',
      {
        jar
      }
    );

    assert(page.match(/logged in/));
  });

});
