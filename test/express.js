const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Express', function() {
  let jar;
  let apos;

  this.timeout(t.timeout);

  it('express should exist on the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'express-test': {},
        'template-test': {},
        'template-subclass-test': {}
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

  it('should flunk a POST request without the CSRF cookie', async function() {
    try {
      await apos.http.post('/tests/body', {
        body: {
          person: {
            age: '30'
          }
        }
      });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should use the extended bodyParser for submitted forms, and pass CSRF with the cookie', async function() {

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
        'template-test': {},
        'template-subclass-test': {}
      }
    });
    assert(apos.prefix);
    assert(apos.prefix === '/prefix');
  });

  it('should have different baseApp and app properties with a prefix', function() {
    assert(apos.app !== apos.baseApp);
  });

  it('should successfully make a GET request to establish CSRF (prefix)', async function() {
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
        'template-test': {},
        'template-subclass-test': {}
      }
    });
    assert(apos.baseUrl);
    assert(apos.baseUrl === 'https://example.com');

    const req = apos.task.getReq({ url: '/test' });
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
        'template-test': {},
        'template-subclass-test': {}
      }
    });
    assert(apos.baseUrl);
    assert(apos.baseUrl === 'https://example.com');
    assert(apos.prefix === '/subdir');
    const req = apos.task.getReq({ url: '/test' });
    assert(req.baseUrl === 'https://example.com');
    assert(req.baseUrlWithPrefix === 'https://example.com/subdir');
    assert(req.absoluteUrl === 'https://example.com/subdir/test');

    // Last use of this apos object
    await t.destroy(apos);
  });

  it('should find pages marked as "loginRequired" when using an API key with different roles', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              adminKey: { role: 'admin' },
              editorKey: { role: 'editor' },
              contributorKey: { role: 'contributor' },
              guestKey: { role: 'guest' }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              {
                parkedId: 'child',
                title: 'Child',
                slug: '/child',
                type: 'default-page',
                visibility: 'loginRequired'
              }
            ]
          }
        },
        'default-page': {}
      }
    });

    const base = apos.http.getBase();
    const keys = [
      'adminKey',
      'editorKey',
      'contributorKey',
      'guestKey'
    ];

    for (const key of keys) {
      const response = await fetch(`${base}/child`, {
        method: 'GET',
        headers: new Headers({ Authorization: `ApiKey ${key}` })
      });

      assert.strictEqual(response.status, 200);
    };

    await t.destroy(apos);
  });

  it('should not find pages marked as "loginRequired" when not using an API key', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              adminKey: { role: 'admin' },
              editorKey: { role: 'editor' },
              contributorKey: { role: 'contributor' },
              guestKey: { role: 'guest' }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              {
                parkedId: 'child',
                title: 'Child',
                slug: '/child',
                type: 'default-page',
                visibility: 'loginRequired'
              }
            ]
          }
        },
        'default-page': {}
      }
    });

    const base = apos.http.getBase();

    const response = await fetch(`${base}/child`, {
      method: 'GET'
    });

    assert.strictEqual(response.status, 404);

    await t.destroy(apos);
  });

  it('should not find pages marked as "loginRequired" when using an wrong API key', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              adminKey: { role: 'admin' },
              editorKey: { role: 'editor' },
              contributorKey: { role: 'contributor' },
              guestKey: { role: 'guest' }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              {
                parkedId: 'child',
                title: 'Child',
                slug: '/child',
                type: 'default-page',
                visibility: 'loginRequired'
              }
            ]
          }
        },
        'default-page': {}
      }
    });

    const base = apos.http.getBase();

    const response = await fetch(`${base}/child`, {
      method: 'GET',
      headers: new Headers({ Authorization: 'ApiKey unkownKey' })
    });

    assert.strictEqual(response.status, 403);

    await t.destroy(apos);
  });
});
