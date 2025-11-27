const assert = require('assert');
const testUtil = require('apostrophe/test-lib/test');
const totp = require('totp-generator');

describe('totp module', function () {
  let apos;

  this.timeout(25000);

  after(async function () {
    testUtil.destroy(apos);
  });

  // Improving
  it('should improve the login module', async function () {
    apos = await testUtil.create({
      shortname: 'loginTest',
      testModule: true,
      modules: {
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
        '@apostrophecms/login-totp': {
          options: {
            testOption: 'suprise'
          }
        },
        '@apostrophecms/login': {
          options: {
            totp: {
              // Should be a random string, exactly 10 characters long
              secret: 'totpsecret'
            }
          }
        }
      }
    });
    const login = apos.modules['@apostrophecms/login'];
    assert(login.options.testOption === 'suprise');
  });

  const mary = {
    username: 'marygold',
    pw: 'asdfjkl;',
    hash: '1234567890'
  };

  it('should be able to insert test user', async function() {
    assert(apos.user.newInstance);
    const user = apos.user.newInstance();
    assert(user);

    user.title = 'Mary Gold';
    user.username = mary.username;
    user.password = mary.pw;
    user.email = 'mary@gold.rocks';
    user.role = 'editor';

    const doc = await apos.user.insert(apos.task.getReq(), user);
    apos.user.safe.updateOne({
      _id: doc._id
    }, {
      $set: {
        totp: {
          activated: true,
          hash: mary.hash
        }
      }
    });
    assert(doc._id);
    mary._id = doc._id;
  });

  it('should log success', async function() {
    const req = apos.task.getReq({
      ip: '1.1.1.1'
    });
    const totpToken = totp(
      apos.login.generateToken(mary.hash, apos.login.getSecret())
    );
    // intecept the logger
    let savedArgs = [];
    apos.login.logInfo = (...args) => {
      savedArgs = args;
    };

    await apos.login.requirements.AposTotp.verify(req, totpToken, mary);

    // the fancy way to detect `req`
    assert.equal(typeof savedArgs[0].t, 'function');
    assert.equal(savedArgs[1], 'totp-complete');
    assert.deepEqual(savedArgs[2], {
      username: mary.username
    });
  });

  it('should log bad token request', async function () {
    const req = apos.task.getReq({
      ip: '1.1.1.1'
    });
    // intecept the logger
    let savedArgs = [];
    apos.login.logInfo = (...args) => {
      savedArgs = args;
    };

    try {
      await apos.login.requirements.AposTotp.verify(req, 'bad', mary);
    } catch (err) {
      //
    }
    // the fancy way to detect `req`
    assert.equal(typeof savedArgs[0].t, 'function');
    assert.equal(savedArgs[1], 'totp-invalid-token');
    assert.deepEqual(savedArgs[2], {
      username: mary.username
    });
  });
});
