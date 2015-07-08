var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var request = require('request');

var apos;

function anonReq() {
  return {
    res: {
      __: function(x) { return x; }
    },
    browserCall: apos.app.request.browserCall,
    getBrowserCalls: apos.app.request.getBrowserCalls,
    query: {}
  };
}

function adminReq() {
  return _.merge(anonReq(), {
    user: {
      _permissions: {
        admin: true
      }
    }
  });
}

describe('Login', function() {

  //////
  // EXISTENCE
  //////

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7948
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
    apos.users.insert(adminReq(), user, function(err) {
      assert(!err);
      done();
    });
  });

  it('should be able to login a user', function(done){
    return request.post('http://localhost:7948/login', { form: { username: 'HarryPutter', password: 'crookshanks' }, followAllRedirects: true }, function(err, response, body){
      assert(!err);
      //Is our status code good?
      console.log(body);
      assert.equal(response.statusCode, 200);
      //Did we get our page back?
      assert(body.match(/logout/));
      return done();
    })

  });


});
