var t = require('../test-lib/test.js');
var assert = require('assert');
var request = require('request');

var apos, apos2;

describe('Login', function() {

  this.timeout(20000);

  after(function(done) {
    return t.destroy(apos, function() {
      return t.destroy(apos2, done);
    });
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
        if (err) {
          console.error('* * * caught error ', err);
        }
        assert(!err);
        done();
      }
    });
  });

  it('should be able to insert test user', function(done) {
    assert(apos.users.newInstance);
    var user = apos.users.newInstance();
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

  it('should not see logout link yet', function(done) {
    // otherwise logins are not remembered in a session
    request.jar();
    return request('http://localhost:7901/', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get our page back?
      assert(body.match(/login/));
      assert(!body.match(/logout/));
      return done();
    });

  });

  var loginLogoutJar = request.jar();
  var loginEmailLogoutJar = request.jar();

  it('should be able to login a user', function(done) {
    // otherwise logins are not remembered in a session
    return request.post('http://localhost:7901/login', {
      form: { username: 'HarryPutter', password: 'crookshanks' },
      followAllRedirects: true,
      jar: loginLogoutJar
    }, function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get our page back?
      assert(body.match(/logout/));
      return done();
    });
  });

  it('should be able to login a user with their email', function(done) {
    // otherwise logins are not remembered in a session
    return request.post('http://localhost:7901/login', {
      form: { username: 'hputter@aol.com', password: 'crookshanks' },
      followAllRedirects: true,
      jar: loginEmailLogoutJar
    }, function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get our page back?
      assert(body.match(/logout/));
      return done();
    });
  });

  it('should be able to log out', function(done) {
    // otherwise logins are not remembered in a session
    return request('http://localhost:7901/logout', {
      followAllRedirects: true,
      jar: loginLogoutJar
    }, function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // are we back to being able to log in?
      assert(body.match(/login/));
      return done();
    });
  });

  it('should be able to log out after having logged in with email', function(done) {
    // otherwise logins are not remembered in a session
    return request('http://localhost:7901/logout', {
      followAllRedirects: true,
      jar: loginEmailLogoutJar
    }, function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // are we back to being able to log in?
      assert(body.match(/login/));
      return done();
    });
  });

  it('should disable an inactive user', function(done) {
    var user = apos.users.newInstance();

    user.firstName = 'Random';
    user.lastName = 'Test';
    user.title = 'Random Test';
    user.username = 'random-test';
    user.password = 'crookshanks';
    user.email = 'randomtest@aol.com';
    user.lastLogin = new Date();
    user.groupIds = [ apos.users.options.groups[0]._id ]; // guest group

    apos.users.insert(apos.tasks.getReq(), user, function(err) {
      assert(!err);
      return request.post('http://localhost:7901/login', {
        form: { username: 'random-test', password: 'crookshanks' },
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
    user.password = 'crookshanks';
    user.email = 'admintest@aol.com';
    user.lastLogin = new Date();
    user.groupIds = [ apos.users.options.groups[1]._id ]; // admin group

    apos.users.insert(apos.tasks.getReq(), user, function(err) {
      assert(!err);
      return request.post('http://localhost:7901/login', {
        form: { username: 'admin-test', password: 'crookshanks' },
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
        user.password = 'crookshanks';
        user.email = 'randomtest@aol.com';
        user.lastLogin = lastLogin.setDate(lastLogin.getDate() - 3); // last login was 3 days ago
        user.groupIds = [ apos2.users.options.groups[0]._id ]; // guest group

        apos2.users.insert(apos2.tasks.getReq(), user, function(err) {
          assert(!err);
          return request.post('http://localhost:7902/login', {
            form: { username: 'random-test', password: 'crookshanks' },
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
