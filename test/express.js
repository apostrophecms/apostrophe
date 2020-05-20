const t = require('../test-lib/test.js');
const assert = require('assert');
let jar;
let apos;

describe('Express', function() {

  this.timeout(t.timeout);

  it('express should exist on the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
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

  it('should successfully make a GET request to establish CSRF', async function() {
    jar = apos.http.jar();
    const body = await apos.http.get('/tests/welcome', {
      jar
    });
    assert(body.toString() === 'ok');
  });

  it('should flunk a POST request with no X-XSRF-TOKEN header', async function() {
    try {
      await apos.http.post('/tests/body', {
        body: {
          person: {
            age: '30'
          }
        },
        jar,
        csrf: false
      });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should flunk a POST request with the wrong CSRF token', async function() {
    const csrfToken = 'BOGOSITY';

    try {
      await apos.http.post('/tests/body', {
        body: {
          person: {
            age: '30'
          }
        },
        jar,
        csrf: false,
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

    const response = await apos.http.post('/tests/body', {
      send: 'form',
      body: {
        person: {
          age: '30'
        }
      },
      jar
    });

    assert(response.toString() === '30');
  });

  it('should allow us to implement a route that requires the JSON bodyParser', async function() {
    const response = await apos.http.post('/tests/body', {
      send: 'json',
      body: {
        person: {
          age: '30'
        }
      },
      jar
    });

    assert(response.toString() === '30');
    // Last one before a new apos object
    await t.destroy(apos);
  });

  // PREFIX STUFF

  it('should set prefix on the apos object if passed in', async function() {
    apos = await t.create({
      root: module,
      prefix: '/prefix',
      modules: {
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {}
      }
    });
    assert(apos.prefix);
    assert(apos.prefix === '/prefix');
  });

  it('should have different baseApp and app properties with a prefix', function() {
    assert(apos.app !== apos.baseApp);
  });

  it('should successfully make a GET request to establish CSRF', async function() {
    jar = apos.http.jar();
    const body = await apos.http.get('/prefix/tests/welcome', {
      jar
    });
    assert(body.toString() === 'ok');
  });

  it('should take same requests at the prefix', async function() {
    const body = await apos.http.post('/prefix/tests/body', {
      body: {
        person: {
          age: '30'
        }
      },
      jar
    });

    assert(body.toString() === '30');
    await t.destroy(apos);
  });

  it('should provide reasonable absolute and base URLs in tasks reqs if baseUrl option is set on apos object', async function() {
    apos = await t.create({
      root: module,
      baseUrl: 'https://example.com',
      modules: {
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
    apos = await t.create({
      root: module,
      baseUrl: 'https://example.com',
      prefix: '/subdir',
      modules: {
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
