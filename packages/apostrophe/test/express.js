const t = require('../test-lib/test.js');
const assert = require('assert');
const net = require('net');

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

  describe('request errors', function() {
    let base;
    let csrf;
    // What reached the logger, per severity, and what reached stderr
    // directly: with the logger spied, a raw stack from Express's own
    // fallback would be the only thing left on stderr.
    const logged = {};
    let stderr;
    const stderrWrite = process.stderr.write;

    before(async function() {
      apos = await t.create({
        root: module,
        modules: {
          'request-error-test': {
            apiRoutes(self) {
              return {
                post: {
                  echo(req) {
                    return req.body;
                  }
                }
              };
            },
            routes(self) {
              return {
                get: {
                  '/tests/boom': (req, res, next) => {
                    return next(new Error('boom'));
                  },
                  '/api/v1/tests/boom': (req, res, next) => {
                    return next(new Error('boom'));
                  }
                }
              };
            }
          }
        }
      });
      base = apos.http.getBase();
      csrf = `${apos.csrfCookieName}=csrf`;
      for (const severity of [ 'debug', 'warn', 'error' ]) {
        apos.util.logger[severity] = (...args) => {
          logged[severity].push(args);
        };
      }
      process.stderr.write = (chunk) => {
        stderr.push(chunk);
        return true;
      };
    });

    after(async function() {
      process.stderr.write = stderrWrite;
      await t.destroy(apos);
    });

    beforeEach(function() {
      for (const severity of [ 'debug', 'warn', 'error' ]) {
        logged[severity] = [];
      }
      stderr = [];
    });

    // Sends the start of a POST and closes the socket before the body, the
    // way a browser does when it navigates away mid-request. Resolves once
    // the server has logged something, or after a second.
    function abort(url) {
      return new Promise((resolve) => {
        const { hostname, port } = new URL(base);
        const socket = net.connect(Number(port), hostname, () => {
          socket.write(
            `POST ${url} HTTP/1.1\r\n` +
            `Host: ${hostname}:${port}\r\n` +
            `Cookie: ${csrf}\r\n` +
            'Content-Type: application/json\r\n' +
            'Content-Length: 100\r\n' +
            '\r\n' +
            '{"a":'
          );
          socket.destroy();
        });
        socket.on('error', () => {});
        const started = Date.now();
        const poll = setInterval(() => {
          const any = Object.values(logged).some((entries) => entries.length);
          if (any || (Date.now() - started > 1000)) {
            clearInterval(poll);
            resolve();
          }
        }, 20);
      });
    }

    it('should answer malformed JSON with a 400 and log one warn entry', async function() {
      const response = await fetch(`${base}/api/v1/request-error-test/echo`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: csrf
        },
        body: '{ not json'
      });
      assert.strictEqual(response.status, 400);
      assert.match(response.headers.get('content-type'), /application\/json/);
      const body = await response.json();
      assert.strictEqual(body.name, 'error');
      assert.match(body.message, /JSON/);

      assert.strictEqual(logged.warn.length, 1);
      assert.strictEqual(logged.debug.length, 0);
      assert.strictEqual(logged.error.length, 0);
      const [ message, data ] = logged.warn[0];
      assert.match(message, /JSON/);
      assert.strictEqual(data.module, '@apostrophecms/express');
      assert.strictEqual(data.type, 'request-error');
      assert.strictEqual(data.severity, 'warn');
      assert.strictEqual(data.status, 400);
      assert.strictEqual(data.url, '/api/v1/request-error-test/echo');
      assert.strictEqual(data.method, 'POST');
      assert.strictEqual(data.stack, undefined);
      assert.deepStrictEqual(stderr, []);
    });

    it('should answer a JSON-speaking client with JSON outside the API', async function() {
      const response = await fetch(`${base}/tests/body`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: csrf
        },
        body: '{ not json'
      });
      assert.strictEqual(response.status, 400);
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.match((await response.json()).message, /JSON/);
      assert.strictEqual(logged.warn.length, 1);
      assert.deepStrictEqual(stderr, []);
    });

    it('should answer a browser navigation in plain text', async function() {
      const response = await fetch(`${base}/tests/body`, {
        method: 'POST',
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'content-type': 'application/json',
          cookie: csrf
        },
        body: '{ not json'
      });
      assert.strictEqual(response.status, 400);
      assert.match(response.headers.get('content-type'), /text\/plain/);
      assert.match(await response.text(), /JSON/);
      assert.strictEqual(logged.warn.length, 1);
      assert.deepStrictEqual(stderr, []);
    });

    it('should log a client that closed its connection at debug only', async function() {
      await abort('/api/v1/request-error-test/echo');

      assert.strictEqual(logged.debug.length, 1);
      assert.strictEqual(logged.warn.length, 0);
      assert.strictEqual(logged.error.length, 0);
      const [ , data ] = logged.debug[0];
      assert.strictEqual(data.type, 'request-error');
      assert.strictEqual(data.severity, 'debug');
      assert.strictEqual(data.method, 'POST');
      assert.strictEqual(data.stack, undefined);
      assert.deepStrictEqual(stderr, []);
    });

    it('should answer an unexpected error with a 500 and log it with the stack', async function() {
      const response = await fetch(`${base}/tests/boom`, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      assert.strictEqual(response.status, 500);
      assert.match(response.headers.get('content-type'), /text\/plain/);
      // The error's own message is not for the client
      assert.strictEqual(await response.text(), 'Internal Server Error');

      assert.strictEqual(logged.error.length, 1);
      assert.strictEqual(logged.debug.length, 0);
      assert.strictEqual(logged.warn.length, 0);
      const [ message, data ] = logged.error[0];
      assert.strictEqual(message, 'boom');
      assert.strictEqual(data.type, 'request-error');
      assert.strictEqual(data.severity, 'error');
      assert.strictEqual(data.status, 500);
      assert.strictEqual(data.url, '/tests/boom');
      assert.strictEqual(data.method, 'GET');
      assert.match(data.stack, /Error: boom/);
      assert.deepStrictEqual(stderr, []);
    });

    it('should answer an unexpected API error as JSON', async function() {
      const response = await fetch(`${base}/api/v1/tests/boom`);
      assert.strictEqual(response.status, 500);
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.deepStrictEqual(await response.json(), { name: 'error' });
      assert.strictEqual(logged.error.length, 1);
      assert.deepStrictEqual(stderr, []);
    });

    it('should answer the external front as JSON on a page URL', async function() {
      apos.modules['@apostrophecms/express'].options.externalFrontKey = 'front-key';
      try {
        const response = await fetch(`${base}/tests/boom`, {
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': 'front-key'
          }
        });
        assert.strictEqual(response.status, 500);
        assert.match(response.headers.get('content-type'), /application\/json/);
        assert.deepStrictEqual(await response.json(), { name: 'error' });
        assert.strictEqual(logged.error.length, 1);
        assert.deepStrictEqual(stderr, []);
      } finally {
        delete apos.modules['@apostrophecms/express'].options.externalFrontKey;
      }
    });
  });
});
