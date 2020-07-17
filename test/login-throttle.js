const t = require('../test-lib/test.js');
const assert = require('assert');
const Promise = require('bluebird');

let apos;

describe('Login', function() {

  this.timeout(20000);

  after(function(done) {
    return t.destroy(apos, done);
  });

  // EXISTENCE

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7901,
          csrf: false
        },
        'apostrophe-users': {
          groups: [
            {
              title: 'guest',
              permissions: ['guest']
            },
            {
              title: 'admin',
              permissions: ['admin']
            }
          ],
          disableInactiveAccounts: {
            inactivityDuration: 0
          }
        },
        'apostrophe-login': {
          throttle: {
            attempts: 3,
            per: 0.25,
            lockout: 0.25
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-login']);
        apos.argv._ = [];
        assert(apos.users.safe.remove);
        return apos.users.safe.remove({}, callback);
        // return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('should be able to insert test user', function(done) {
    assert(apos.users.newInstance);
    const user = apos.users.newInstance();
    assert(user);

    user.firstName = 'Harry';
    user.lastName = 'Putter';
    user.title = 'Harry Putter';
    user.username = 'HarryPutter';
    user.password = 'crookshanks';
    user.email = 'hputter@aol.com';
    user.groupIds = [ apos.users.options.groups[1]._id ];

    assert(user.type === 'apostrophe-user');
    assert(apos.users.insert);
    apos.users.insert(apos.tasks.getReq(), user, function(err) {
      assert(!err);
      done();
    });
  });

  it('should be able to verify a login', async function() {
    const req = apos.tasks.getReq();
    const user = await apos.users.find(req, {
      username: 'HarryPutter'
    }).toObject();
    const verify = Promise.promisify(apos.login.verifyPassword);
    await verify(user, 'crookshanks');
  });

  it('third failure in a row should cause a lockout', async function() {
    const req = apos.tasks.getReq();
    const user = await apos.users.find(req, {
      username: 'HarryPutter'
    }).toObject();
    const verify = Promise.promisify(apos.login.verifyPassword);
    try {
      await verify(user, 'bad');
      assert(false);
    } catch (e) {
      assert(e);
      assert.notEqual(e.message, 'throttle');
    }
    try {
      await verify(user, 'bad');
      assert(false);
    } catch (e) {
      assert(e);
      assert.notEqual(e.message, 'throttle');
    }
    // third attempt triggers lockout
    try {
      await verify(user, 'bad');
      assert(false);
    } catch (e) {
      assert(e);
      assert.equal(e.message, 'throttle');
    }
    // fourth attempt is throttled (by lockout)
    try {
      await verify(user, 'bad');
      assert(false);
    } catch (e) {
      assert(e);
      assert.equal(e.message, 'throttle');
    }
    // still throttled even if the password is good
    try {
      await verify(user, 'crookshanks');
      assert(false);
    } catch (e) {
      assert(e);
      assert.equal(e.message, 'throttle');
    }
  });

  it('should succeed after suitable pause', async function() {
    const req = apos.tasks.getReq();
    const user = await apos.users.find(req, {
      username: 'HarryPutter'
    }).toObject();
    const verify = Promise.promisify(apos.login.verifyPassword);
    this.timeout(60000);
    await Promise.delay(16000);
    await verify(user, 'crookshanks');
  });

});
