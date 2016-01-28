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


describe('Users', function() {

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
          port: 7947
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-users']);
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


  // Test pieces.newInstance()
  it('should be able to insert a new user', function(done) {
    assert(apos.users.newInstance);
    var user = apos.users.newInstance();
    assert(user);

    user.firstName = 'Jane';
    user.lastName = 'Doe';
    user.title = 'Jane Doe';
    user.username = 'JaneD';
    user.password = '123password';
    user.email = 'jane@aol.com';

    assert(user.type === 'apostrophe-user');
    assert(apos.users.insert);
    apos.users.insert(adminReq(), user, function(err) {
      assert(!err);
      done();
    });

  });

  // verify a user's password
  // fail to verify the wrong password
  // fail to insert another user with the same email address
  // succeed in updating a user's property
  // verify a user's password after that user has been updated
  // change an existing user's password and verify the new password
  // verify that the user doc does not contain a password property at all

  // retrieve a user by their username
  it('should be able to retrieve a user by their username', function(done){
    apos.users.find(adminReq(), { username: 'JaneD' })
      .toObject(function(err, user){
        assert(!err);
        assert(user);
        assert(user.username == 'JaneD');
        done();
      });
  });

  it('should verify a user password', function(done){
    apos.users.find(adminReq(), { username: 'JaneD' })
      .toObject(function(err, user){
        assert(!err);
        assert(user);
        assert(user.username == 'JaneD');

        apos.users.verifyPassword(user, '123password', function(err){
          assert(!err);
          done();
        });
      });
  });

  it('should not verify an incorrect user password', function(done){
    apos.users.find(adminReq(), { username: 'JaneD' })
      .toObject(function(err, user){
        assert(!err);
        assert(user);
        assert(user.username == 'JaneD');

        apos.users.verifyPassword(user, '321password', function(err){
          assert(err);
          done();
        });
      });
  });

  it('should not be able to insert a new user if their email already exists', function(done) {
    assert(apos.users.newInstance);
    var user = apos.users.newInstance();
    assert(user);

    user.firstName = 'Dane';
    user.lastName = 'Joe';
    user.title = 'Dane Joe';
    user.username = 'DaneJ';
    user.password = '321password';
    user.email = 'jane@aol.com';
    assert(user.type === 'apostrophe-user');

    assert(apos.users.insert);
    apos.users.insert(adminReq(), user, function(err) {
      assert(err);
      done();
    });
  });

  it('should succeed in updating a users property', function(done){
    apos.users.find(adminReq(), { username: 'JaneD' })
    .toObject(function(err, user){
      assert(!err);
      assert(user);
      assert(user.username == 'JaneD');
      user.firstName = 'Jill';
      apos.users.update(adminReq(), user, function(err){
        assert(!err);
        apos.users.find(adminReq(), { _id: user._id })
        .toObject(function(err, user){
          assert(!err);
          assert(user);
          assert(user.firstName == 'Jill');
          done();
        });
      });
    });
  });

  it('should verify a user password after their info has been updated', function(done){
    apos.users.find(adminReq(), { username: 'JaneD' })
    .toObject(function(err, user){
      assert(!err);
      assert(user);
      assert(user.username == 'JaneD');

      apos.users.verifyPassword(user, '123password', function(err){
        assert(!err);
        done();
      });
    });
  });

  // change an existing user's password and verify the new password
  it('should change an existing user password and verify the new password', function(done){
    apos.users.find(adminReq(), { username: 'JaneD' })
    .toObject(function(err, user){
      assert(!err);
      assert(user);
      assert(user.username == 'JaneD');
      assert(!user.password);
      user.password = 'password123';
      apos.users.update(adminReq(), user, function(err){
        assert(!err);
        apos.users.find(adminReq(), { username: 'JaneD' })
        .toObject(function(err, user){
          assert(!err);
          assert(user);
          apos.users.verifyPassword(user, 'password123', function(err){
            assert(!err);
            done();
          });
        });
      });
    });
  });

});
