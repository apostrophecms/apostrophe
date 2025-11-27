const assert = require('assert');
const testUtil = require('apostrophe/test-lib/test');

const getSiteConfig = function () {
  return {
    // reCAPTCHA test keys
    // https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha-what-should-i-do
    site: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
    secret: '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe',
    // The reCAPTCHA test keys accept any token value.
    response: 'valid-token'
  };
};

const getAppConfig = function (siteConfig = getSiteConfig()) {
  return {
    '@apostrophecms/express': {
      options: {
        port: 4242,
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
    '@apostrophecms/login-recaptcha': {
      options: {
        testOption: 'surprise'
      }
    },
    '@apostrophecms/login': {
      options: {
        recaptcha: {
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

describe.only('@apostrophecms/login-recaptcha', function () {
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

  it('should not be able to login a user without meeting the uponSubmit requirement', async function () {
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

      assert.equal(context.requirementProps.AposRecaptcha.sitekey, siteConfig.site);

      const post = apos.http.post;
      try {
        // intercept http
        apos.http.post = async function () {
          return {
            success: false
          };
        };
        await apos.login.checkRecaptcha(
          apos.task.getReq({
            ip: '1.1.1.1'
          })
        );
      } finally {
        apos.http.post = post;
      }

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
      message: 'The reCAPTCHA verification system may be down or incorrectly configured. Please try again or notify the site owner.',
      name: 'error'
    };

    await assert.rejects(actual, expected);

    // Make sure it really didn't work
    const page = await apos.http.get('/', { jar });
    assert.ok(page.match(/logged out/), 'page contains logged out in body');
  });

  it('should log in with a recaptcha token', async function () {
    const mary = getUserConfig();
    const siteConfig = getSiteConfig();

    const jar = apos.http.jar();

    // establish session
    let page = await apos.http.get('/', { jar });
    assert.ok(page.match(/logged out/), 'page contains logged out in body');

    // intecept the logger
    let savedArgs = [];
    apos.login.logInfo = (...args) => {
      if (args[1] === 'recaptcha-complete') {
        // Do not get confused by unrelated events
        savedArgs = args;
      }
    };

    await apos.login.checkRecaptcha(
      apos.task.getReq({
        ip: '1.1.1.1'
      }),
      'valid-token'
    );

    await apos.http.post(
      '/api/v1/@apostrophecms/login/login',
      {
        method: 'POST',
        body: {
          username: mary.username,
          password: mary.pw,
          session: true,
          requirements: {
            AposRecaptcha: siteConfig.response
          }
        },
        jar
      }
    );

    // the fancy way to detect `req`
    assert.equal(typeof savedArgs[0].t, 'function');
    assert.equal(savedArgs[1], 'recaptcha-complete');

    page = await apos.http.get('/', { jar });
    assert.ok(page.match(/logged in/), 'page contains logged in in body');
  });

  it('should log bad token request', async function () {
    // intercept http
    const post = apos.http.post;
    try {
      apos.http.post = async function () {
        return {
          success: false,
          foo: 'bar'
        };
      };

      // intecept the logger
      let savedArgs = [];
      apos.login.logInfo = (...args) => {
        savedArgs = args;
      };

      try {
        await apos.login.checkRecaptcha(
          apos.task.getReq({
            ip: '1.1.1.1'
          }),
          'invalid-token'
        );
      } catch (e) {
        //
      }
      // the fancy way to detect `req`
      assert.equal(typeof savedArgs[0].t, 'function');
      assert.equal(savedArgs[1], 'recaptcha-invalid-token');
      assert.deepEqual(savedArgs[2], {
        data: {
          success: false,
          foo: 'bar'
        }
      });
    } finally {
      apos.http.post = post;
    }
  });
});
