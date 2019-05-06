const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');
const request = require('request-promise');
let jar;
let apos;

describe('Express', function() {

  this.timeout(t.timeout);

  it('express should exist on the apos object', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          port: 7900,
          address: 'localhost',
          session: {
            secret: 'xxx'
          }
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {}
      },
      afterInit: function(callback) {
        assert(apos.express);

        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
      }
    });
  });

  it('app should exist on the apos object', function() {
    assert(apos.app);
  });

  it('baseApp should exist on the apos object', function() {
    assert(apos.baseApp);
  });

  it('app and baseApp should be the same in the absence of a prefix', function() {
    assert(apos.baseApp === apos.app);
  });

  function getCsrfToken(jar) {
    const csrfCookie = _.find(jar.getCookies('http://localhost:7900/'), {
      key: apos.csrfCookieName
    });

    if (!csrfCookie) {
      return null;
    }

    const csrfToken = csrfCookie.value;
    return csrfToken;
  }

  it('should successfully make a GET request to establish CSRF', async function() {
    // otherwise request does not track cookies
    jar = request.jar();
    await request({
      method: 'GET',
      url: 'http://localhost:7900/tests/welcome',
      jar: jar
    }, function(err, response, body) {
      assert(!err);
      assert(body.toString() === 'ok');
    });
  });

  it('should flunk a POST request with no X-XSRF-TOKEN header', async function() {
    try {
      await request({
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
      });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should flunk a POST request with no cookies at all', async function() {
    try {
      await request({
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
      });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should flunk a POST request with the wrong CSRF token', async function() {
    const csrfToken = 'BOGOSITY';

    try {
      await request({
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
      });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should use the extended bodyParser for submitted forms', async function() {
    const csrfToken = getCsrfToken(jar);
    assert(csrfToken);

    const response = await request({
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
    });

    assert(response.toString() === '30');
  });

  it('should allow us to implement a route that requires the JSON bodyParser', async function() {
    const csrfToken = getCsrfToken(jar);
    const response = await request({
      method: 'POST',
      url: 'http://localhost:7900/tests/body',
      json: {
        person: {
          age: '30'
        }
      },
      jar: jar,
      headers: {
        'X-XSRF-TOKEN': csrfToken
      }
    });

    assert(response.toString() === '30');
  });

  it('should be able to implement a route with apostrophe-module.route', async function() {
    const csrfToken = getCsrfToken(jar);
    const response = await request({
      method: 'POST',
      url: 'http://localhost:7900/modules/express-test/test2',
      json: {
        person: {
          age: '30'
        }
      },
      jar: jar,
      headers: {
        'X-XSRF-TOKEN': csrfToken
      }
    });

    assert(response.toString() === '30');

    // Last one before a new apos object
    t.destroy(apos);
  });

  // PREFIX STUFF

  it('should set prefix on the apos object if passed in', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      prefix: '/prefix',
      modules: {
        'apostrophe-express': {
          port: 7900,
          csrf: false,
          address: 'localhost',
          session: {
            secret: 'Ullamcorper'
          }
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {}
      },
      afterInit: function(callback) {
        assert(apos.prefix);
        assert(apos.prefix === '/prefix');
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      }
    });

    assert(apos.prefix === '/prefix');
  });

  it('should have different baseApp and app properties with a prefix', function() {
    assert(apos.app !== apos.baseApp);
  });

  // it('should take same requests at the prefix', function(done) {
  //   request({
  //     method: 'POST',
  //     url: 'http://localhost:7900/prefix/tests/body',
  //     form: {
  //       person: {
  //         age: '30'
  //       }
  //     }
  //   }, function(err, response, body) {
  //     assert(!err);
  //     assert(body.toString() === '30');
  //     // Last one before a new apos object
  //     return t.destroy(apos, done);
  //   });
  // });

  // it('should provide reasonable absolute and base URLs in tasks reqs if baseUrl option is set on apos object', function(done) {

  //   apos = require('../index.js')({
  //     root: module,
  //     shortName: 'test',
  //     baseUrl: 'https://example.com',
  //     modules: {
  //       'apostrophe-express': {
  //         port: 7900,
  //         csrf: false
  //       },
  //       'express-test': {},
  //       'templates-test': {},
  //       'templates-subclass-test': {}
  //     },
  //     afterInit: function(callback) {
  //       assert(apos.baseUrl);
  //       assert(apos.baseUrl === 'https://example.com');
  //       // In tests this will be the name of the test file,
  //       // so override that in order to get apostrophe to
  //       // listen normally and not try to run a task. -Tom
  //       apos.argv._ = [];
  //       return callback(null);
  //     },
  //     afterListen: function(err) {
  //       assert(!err);
  //       let req = apos.tasks.getReq({ url: '/test' });
  //       assert(req.baseUrl === 'https://example.com');
  //       assert(req.absoluteUrl === 'https://example.com/test');
  //       // Last one before a new apos object
  //       return t.destroy(apos, done);
  //     }
  //   });
  // });

  // it('should provide reasonable absolute and base URLs in tasks reqs if baseUrl and prefix options are set on apos object', function(done) {

  //   apos = require('../index.js')({
  //     root: module,
  //     shortName: 'test',
  //     baseUrl: 'https://example.com',
  //     prefix: '/subdir',
  //     modules: {
  //       'apostrophe-express': {
  //         port: 7900,
  //         csrf: false
  //       },
  //       'express-test': {},
  //       'templates-test': {},
  //       'templates-subclass-test': {}
  //     },
  //     afterInit: function(callback) {
  //       assert(apos.baseUrl);
  //       assert(apos.baseUrl === 'https://example.com');
  //       assert(apos.prefix === '/subdir');
  //       // In tests this will be the name of the test file,
  //       // so override that in order to get apostrophe to
  //       // listen normally and not try to run a task. -Tom
  //       apos.argv._ = [];
  //       return callback(null);
  //     },
  //     afterListen: function(err) {
  //       assert(!err);
  //       let req = apos.tasks.getReq({ url: '/test' });
  //       assert(req.baseUrl === 'https://example.com');
  //       assert(req.baseUrlWithPrefix === 'https://example.com/subdir');
  //       assert(req.absoluteUrl === 'https://example.com/subdir/test');
  //       // Last use of this apos object
  //       return t.destroy(apos, done);
  //     }
  //   });
  // });
});
