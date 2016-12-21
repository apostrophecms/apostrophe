var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var t = require('./testUtils');

var apos;

describe('Login', function() {

  this.timeout(5000);

  after(function() {
    apos.db.dropDatabase();
  });

  //////
  // EXISTENCE
  //////

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7948,
          csrf: false
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
      },
    });
  });

  it('should be able to insert test user', function(done){
    assert(apos.users.newInstance);
    var user = apos.users.newInstance();
    assert(user);

    user.firstName = 'Harry';
    user.lastName = 'Putter';
    user.title = 'Harry Putter';
    user.username = 'HarryPutter';
    user.password = 'crookshanks';
    user.email = 'hputter@aol.com';

    assert(user.type === 'apostrophe-user');
    assert(apos.users.insert);
    apos.users.insert(t.req.admin(apos), user, function(err) {
      assert(!err);
      done();
    });
  });

  it('should not see logout link yet', function(done){
    // otherwise logins are not remembered in a session
    var jar = request.jar();
    return request('http://localhost:7948/', function(err, response, body) {
      assert(!err);
      //Is our status code good?
      assert.equal(response.statusCode, 200);
      //Did we get our page back?
      assert(body.match(/login/));
      assert(!body.match(/logout/));
      return done();
    });

  });

  var loginLogoutJar = request.jar();
  var loginEmailLogoutJar = request.jar();

  it('should be able to login a user', function(done){
    // otherwise logins are not remembered in a session
    return request.post('http://localhost:7948/login', {
      form: { username: 'HarryPutter', password: 'crookshanks' },
      followAllRedirects: true,
      jar: loginLogoutJar
    }, function(err, response, body){
      assert(!err);
      //Is our status code good?
      assert.equal(response.statusCode, 200);
      //Did we get our page back?
      assert(body.match(/logout/));
      return done();
    });
  });

  it('should be able to login a user with their email', function(done){
    // otherwise logins are not remembered in a session
    return request.post('http://localhost:7948/login', {
      form: { username: 'hputter@aol.com', password: 'crookshanks' },
      followAllRedirects: true,
      jar: loginEmailLogoutJar
    }, function(err, response, body){
      assert(!err);
      //Is our status code good?
      assert.equal(response.statusCode, 200);
      //Did we get our page back?
      assert(body.match(/logout/));
      return done();
    });
  });

  it('should be able to log out', function(done){
    // otherwise logins are not remembered in a session
    return request('http://localhost:7948/logout', {
      followAllRedirects: true,
      jar: loginLogoutJar
    }, function(err, response, body){
      assert(!err);
      //Is our status code good?
      assert.equal(response.statusCode, 200);
      // are we back to being able to log in?
      assert(body.match(/login/));
      return done();
    });
  });

  it('should be able to log out after having logged in with email', function(done){
    // otherwise logins are not remembered in a session
    return request('http://localhost:7948/logout', {
      followAllRedirects: true,
      jar: loginEmailLogoutJar
    }, function(err, response, body){
      assert(!err);
      //Is our status code good?
      assert.equal(response.statusCode, 200);
      // are we back to being able to log in?
      assert(body.match(/login/));
      return done();
    });
  });


});
