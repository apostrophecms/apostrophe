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

  it('should disable an inactive user', function(done) {
    var user = apos.users.newInstance();

    user.firstName = 'Random';
    user.lastName = 'Test';
    user.title = 'Random Test';
    user.username = 'random-test';
    user.password = 'nikanj';
    user.email = 'randomtest@aol.com';
    user.lastLogin = new Date();
    user.groupIds = [ apos.users.options.groups[0]._id ]; // guest group

    apos.users.insert(apos.tasks.getReq(), user, function(err) {
      assert(!err);
      return request.post('http://localhost:7901/login', {
        form: { username: 'random-test', password: 'nikanj' },
        followAllRedirects: true,
        jar: loginLogoutJar
      }, function(err, response, body) {
        assert(!err);
        assert.equal(response.statusCode, 200);
        assert(body.match(/Account disabled due to inactivity. Please, refer to the administrator of the site for assistance./));
        return done();
      });
    });
  });

  it('should log a whitelisted user', function(done) {
    var user = apos.users.newInstance();

    user.firstName = 'Admin';
    user.lastName = 'Test';
    user.title = 'Admin Test';
    user.username = 'admin-test';
    user.password = 'nikanj';
    user.email = 'admintest@aol.com';
    user.lastLogin = new Date();
    user.groupIds = [ apos.users.options.groups[1]._id ]; // admin group

    apos.users.insert(apos.tasks.getReq(), user, function(err) {
      assert(!err);
      return request.post('http://localhost:7901/login', {
        form: { username: 'admin-test', password: 'nikanj' },
        followAllRedirects: true,
        jar: loginLogoutJar
      }, function(err, response, body) {
        assert(!err);
        assert.equal(response.statusCode, 200);
        assert(body.match(/logout/));
        return done();
      });
    });
  });

  it('should log a non-timed out user', function(done) {
    apos2 = require('../index.js')({
      root: module,
      shortName: 'test2',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7902,
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
            inactivityDuration: 90
          }
        }
      },
      afterInit: function(callback) {
        apos2.argv._ = [];
        return apos2.users.safe.remove({}, callback);
      },
      afterListen: function(err) {
        if (err) {
          console.error('* * * caught error ', err);
        }
        assert(!err);

        var user = apos2.users.newInstance();
        var lastLogin = new Date();

        user.firstName = 'Random';
        user.lastName = 'Test';
        user.title = 'Random Test';
        user.username = 'random-test';
        user.password = 'nikanj';
        user.email = 'randomtest@aol.com';
        user.lastLogin = lastLogin.setDate(lastLogin.getDate() - 3); // last login was 3 days ago
        user.groupIds = [ apos2.users.options.groups[0]._id ]; // guest group

        apos2.users.insert(apos2.tasks.getReq(), user, function(err) {
          assert(!err);
          return request.post('http://localhost:7902/login', {
            form: { username: 'random-test', password: 'nikanj' },
            followAllRedirects: true,
            jar: loginLogoutJar
          }, function(err, response, body) {
            assert(!err);
            assert.equal(response.statusCode, 200);
            assert(body.match(/logout/));
            return done();
          });
        });
      }
    });
  });

});
