var t = require('../test-lib/test.js');
var assert = require('assert');
var _ = require('@sailshq/lodash');
var apos;
var sessionShouldBeEmpty;

describe('Express', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('express should exist on the apos object', function(done) {
    sessionShouldBeEmpty = true;
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900,
          csrf: {
            disableAnonSession: true
          }
        },
        'express-test': {},
        'templates-test': {
          ignoreNoCodeWarning: true
        },
        'templates-subclass-test': {
          ignoreNoCodeWarning: true
        },
        'check-session-empty': {
          construct: function(self, options) {
            self.on('apostrophe-pages:beforeSend', 'verifyEmptySession', function(req) {
              // The session should be empty as the only thing in
              // default Apostrophe that forces a session to exist
              // when logged out is the csrf token we disabled above
              if (sessionShouldBeEmpty) {
                assert(Object.keys(req.session).length === 0);
              } else {
                assert(Object.keys(req.session).length);
              }
            });
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.express);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  var request = require('request');

  var jar;

  function getCsrfToken(jar) {
    var csrfCookie = _.find(jar.getCookies('http://localhost:7900/'), { key: apos.csrfCookieName });
    if (!csrfCookie) {
      return 'csrf-fallback';
    }
    var csrfToken = csrfCookie.value;
    return csrfToken;
  }

  it('should successfully make a GET request to establish CSRF', function(done) {
    // otherwise request does not track cookies
    jar = request.jar();
    request({
      method: 'GET',
      url: 'http://localhost:7900/tests/welcome',
      jar: jar
    }, function(err, response, body) {
      assert(!err);
      assert(body.toString() === 'ok');
      done();
    });
  });

  it('should flunk a POST request with no X-XSRF-TOKEN header', function(done) {
    request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      form: {
        person: {
          age: '30'
        }
      },
      jar: jar,
      headers: {}
    }, function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 403);
      done();
    });
  });

  it('should flunk a POST request with no cookies at all', function(done) {
    request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      form: {
        person: {
          age: '30'
        }
      },
      headers: {}
    }, function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 403);
      done();
    });
  });

  it('should flunk a POST request with the wrong CSRF token', function(done) {
    var csrfToken = 'BOGOSITY';
    request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      form: {
        person: {
          age: '30'
        }
      },
      jar: jar,
      headers: {
        'X-XSRF-TOKEN': csrfToken
      }
    }, function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 403);
      done();
    });
  });

  it('should use the extended bodyParser for submitted forms', function(done) {
    var csrfToken = getCsrfToken(jar);
    assert(csrfToken);
    // Should be the fallback token since disableAnonSession is active
    assert(csrfToken === 'csrf-fallback');
    request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      form: {
        person: {
          age: '30'
        }
      },
      jar: jar,
      headers: {
        'X-XSRF-TOKEN': csrfToken
      }
    }, function(err, response, body) {
      assert(!err);
      assert(body.toString() === '30');
      done();
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

    assert(user.type === 'apostrophe-user');
    assert(apos.users.insert);
    apos.users.insert(apos.tasks.getReq(), user, function(err) {
      assert(!err);
      done();
    });
  });

  it('should be able to login a user', function(done) {
    sessionShouldBeEmpty = false;
    return request.post('http://localhost:7900/login', {
      form: { username: 'HarryPutter', password: 'crookshanks' },
      followAllRedirects: true,
      jar: jar
    }, function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get our page back?
      assert(body.match(/logout/));
      return done();
    });
  });

  it('should successfully make a GET request to establish CSRF', function(done) {
    request({
      method: 'GET',
      url: 'http://localhost:7900/tests/welcome',
      jar: jar
    }, function(err, response, body) {
      assert(!err);
      assert(body.toString() === 'ok');
      done();
    });
  });

  it('should flunk a POST request with no X-XSRF-TOKEN header', function(done) {
    request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      form: {
        person: {
          age: '30'
        }
      },
      jar: jar,
      headers: {}
    }, function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 403);
      done();
    });
  });

  it('should flunk a POST request with no cookies at all', function(done) {
    request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      form: {
        person: {
          age: '30'
        }
      },
      headers: {}
    }, function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 403);
      done();
    });
  });

  it('should flunk a POST request with the wrong CSRF token', function(done) {
    var csrfToken = 'BOGOSITY';
    request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      form: {
        person: {
          age: '30'
        }
      },
      jar: jar,
      headers: {
        'X-XSRF-TOKEN': csrfToken
      }
    }, function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 403);
      done();
    });
  });

  it('should use the extended bodyParser for submitted forms', function(done) {
    var csrfToken = getCsrfToken(jar);
    assert(csrfToken);
    // Should be a true randomized token since
    // we are no longer anonymous
    assert(csrfToken !== 'csrf-fallback');
    request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      form: {
        person: {
          age: '30'
        }
      },
      jar: jar,
      headers: {
        'X-XSRF-TOKEN': csrfToken
      }
    }, function(err, response, body) {
      assert(!err);
      assert(body.toString() === '30');
      done();
    });
  });

});
