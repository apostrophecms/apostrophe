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
          options: {
            port: 7900,
            address: 'localhost',
            session: {
              secret: 'xxx'
            }
          }
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {}
      }
    });
    assert(apos.express);
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
    const body = await request({
      method: 'GET',
      url: 'http://localhost:7900/tests/welcome',
      jar: jar
    });
    assert(body.toString() === 'ok');
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
      });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should flunk a POST request with the wrong CSRF token', async function() {
    const csrfToken = 'BOGOSITY';

    try {
      const body = await request({
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
    // Last one before a new apos object
    await t.destroy(apos);
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
          options: {
            port: 7900,
            csrf: false,
            address: 'localhost',
            session: {
              secret: 'Ullamcorper'
            }
          }
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {}
      }
    });
    assert(apos.prefix);
    assert(apos.prefix === '/prefix');
    // In tests this will be the name of the test file,
    // so override that in order to get apostrophe to
    // listen normally and not try to run a task. -Tom
    apos.argv._ = [];
  });

  it('should have different baseApp and app properties with a prefix', function() {
    assert(apos.app !== apos.baseApp);
  });

  it('should take same requests at the prefix', async function() {
    const body = await request({
      method: 'POST',
      url: 'http://localhost:7900/prefix/tests/body',
      form: {
        person: {
          age: '30'
        }
      }
    });

    assert(body.toString() === '30');
    await t.destroy(apos);
  });

  it('should provide reasonable absolute and base URLs in tasks reqs if baseUrl option is set on apos object', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      baseUrl: 'https://example.com',
      modules: {
        'apostrophe-express': {
          options: {
            port: 7900,
            csrf: false,
            address: 'localhost',
            session: {
              secret: 'Commodo'
            }
          }
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {}
      }
    });
    assert(apos.baseUrl);
    assert(apos.baseUrl === 'https://example.com');

    const req = apos.tasks.getReq({ url: '/test' });
    assert(req.baseUrl === 'https://example.com');
    assert(req.absoluteUrl === 'https://example.com/test');

    // Last one before a new apos object
    await t.destroy(apos);
  });

  it('should provide reasonable absolute and base URLs in tasks reqs if baseUrl and prefix options are set on apos object', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      baseUrl: 'https://example.com',
      prefix: '/subdir',
      modules: {
        'apostrophe-express': {
          options: {
            port: 7900,
            csrf: false,
            address: 'localhost',
            session: {
              secret: 'Ligula'
            }
          }
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {}
      }
    });
    assert(apos.baseUrl);
    assert(apos.baseUrl === 'https://example.com');
    assert(apos.prefix === '/subdir');
    const req = apos.tasks.getReq({ url: '/test' });
    assert(req.baseUrl === 'https://example.com');
    assert(req.baseUrlWithPrefix === 'https://example.com/subdir');
    assert(req.absoluteUrl === 'https://example.com/subdir/test');

    // Last use of this apos object
    await t.destroy(apos);
  });
});
