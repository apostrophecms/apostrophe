const assert = require('assert').strict;
const testUtil = require('apostrophe/test-lib/test');

const getSiteConfig = function () {
  return {
    // hCaptcha test keys
    // https://docs.hcaptcha.com/#integration-testing-test-keys
    site: '10000000-ffff-ffff-ffff-000000000001',
    secret: '0x0000000000000000000000000000000000000000',
    response: '10000000-aaaa-bbbb-cccc-000000000001'
  };
};

const getAppConfig = function (siteConfig = getSiteConfig()) {
  return {
    '@apostrophecms/express': {
      options: {
        // csrf: {
        //   exceptions: [ '/api/v1/@apostrophecms/form/submit' ]
        // },
        session: {
          secret: 'test-this-module'
        },
        apiKeys: {
          skeleton_key: { role: 'admin' }
        }
      }
    },
    '@apostrophecms/login-hcaptcha': {
      options: {
        testOption: 'surprise'
      }
    },
    '@apostrophecms/login': {
      options: {
        hcaptcha: {
          site: siteConfig.site,
          secret: siteConfig.secret
        }
      }
    }
  };
};

const getUserConfig = function () {
  return {
    username: 'marygold',
    pw: 'asdfjkl;'
  };
};

describe('@apostrophecms/login-hcaptcha', function () {
  let apos;

  this.timeout(25000);

  before(async function () {
    apos = await testUtil.create({
      shortname: 'loginTest',
      testModule: true,
      modules: getAppConfig()
    });
  });

  after(async function () {
    await testUtil.destroy(apos);
  });

  // Improving
  it('should improve the login module', function () {
    const login = apos.modules['@apostrophecms/login'];

    const actual = login.options.testOption;
    const expected = 'surprise';

    assert.equal(actual, expected);
  });

  it('should be able to insert test user', async function () {
    const mary = getUserConfig();

    const user = apos.user.newInstance();
    user.title = 'Mary Gold';
    user.username = mary.username;
    user.password = mary.pw;
    user.email = 'mary@gold.rocks';
    user.role = 'editor';

    const doc = await apos.user.insert(apos.task.getReq(), user);

    const actual = !!doc._id;
    const expected = true;

    assert.equal(actual, expected);
  });

  it('should not be able to login a user without meeting the beforeSubmit requirement', async function () {
    const jar = apos.http.jar();
    const siteConfig = getSiteConfig();
    const mary = getUserConfig();

    const actual = async function () {
      // establish session
      const page = await apos.http.get('/', { jar });
      assert.ok(page.match(/logged out/), 'page contains logged out in body');

      const context = await apos.http.post(
        '/api/v1/@apostrophecms/login/context',
        {
          method: 'POST',
          body: {},
          jar
        }
      );

      assert.equal(context.requirementProps.AposHcaptcha.sitekey, siteConfig.site);

      await apos.http.post(
        '/api/v1/@apostrophecms/login/login',
        {
          method: 'POST',
          body: {
            username: mary.username,
            password: mary.pw,
            session: true
          },
          jar
        }
      );
    };
    const expected = {
      name: 'Error',
      message: 'HTTP error 400',
      status: 400,
      body: {
        message: 'The hCaptcha token was missing while verifying login.',
        name: 'invalid',
        data: {
          requirement: 'AposHcaptcha'
        }
      }
    };

    await assert.rejects(actual, expected);

    // Make sure it really didn't work
    const page = await apos.http.get('/', { jar });
    assert.ok(page.match(/logged out/), 'page contains logged out in body');
  });

  it('should log in with a hcaptcha token', async function () {
    const mary = getUserConfig();
    const siteConfig = getSiteConfig();

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get('/', { jar });
    assert.ok(page.match(/logged out/), 'page contains logged out in body');

    // intecept the logger
    let savedArgs = [];
    apos.login.logInfo = (...args) => {
      // Don't get confused by unrelated events from the login module,
      // capture the one we care about
      if (args[1] === 'hcaptcha-complete') {
        savedArgs = args;
      }
    };

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: mary.username,
          password: mary.pw,
          session: true,
          requirements: {
            AposHcaptcha: siteConfig.response
          }
        },
        jar
      }
    );

    // the fancy way to detect `req`
    assert.equal(typeof savedArgs[0].t, 'function');
    assert.equal(savedArgs[1], 'hcaptcha-complete');

    page = await apos.http.get('/', { jar });
    assert.ok(page.match(/logged in/), 'page contains logged in in body');
  });

  it('should log bad token request', async function () {
    const mary = getUserConfig();

    const jar = apos.http.jar();

    // establish session
    const page = await apos.http.get('/', { jar });
    assert.ok(page.match(/logged out/), 'page contains logged out in body');

    // intecept the logger
    let savedArgs = [];
    apos.login.logInfo = (...args) => {
      savedArgs = args;
    };

    try {
      await apos.http.post(
        '/api/v1/@apostrophecms/login/login',
        {
          method: 'POST',
          body: {
            username: mary.username,
            password: mary.pw,
            session: true,
            requirements: {
              AposHcaptcha: 'bad-token'
            }
          },
          jar
        }
      );
    } catch (error) {
      //
    }

    // the fancy way to detect `req`
    assert.equal(typeof savedArgs[0].t, 'function');
    assert.equal(savedArgs[1], 'hcaptcha-invalid-token');
    assert.deepEqual(savedArgs[2], {
      data: {
        success: false,
        'error-codes': [ 'invalid-input-response' ]
      }
    });
  });
});
