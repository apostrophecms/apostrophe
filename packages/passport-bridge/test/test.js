const assert = require('assert').strict;
const t = require('apostrophe/test-lib/test');

// A stand-in for an identity provider, as a Passport strategy: the login
// route sends the browser to the provider, which here sends it straight
// back to the callback with the username to log in as
class FakeStrategy {
  constructor(options, verify) {
    this.name = 'fake';
    this.callbackURL = options.callbackURL;
    this.verify = verify;
  }

  authenticate(req) {
    if (!req.query.user) {
      return this.redirect(`${new URL(this.callbackURL).pathname}?user=${encodeURIComponent(req.query.as || 'editor')}`);
    }
    const profile = {
      id: req.query.user,
      username: req.query.user,
      displayName: req.query.user,
      emails: [ { value: `${req.query.user}@example.com` } ]
    };
    return this.verify(req, 'access', 'refresh', profile, (err, user) => {
      if (err) {
        return this.error(err);
      }
      if (!user) {
        return this.fail();
      }
      return this.success(user);
    });
  }
}

describe('Passport bridge', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await t.create({
      root: module,
      testModule: true,
      baseUrl: 'http://localhost:7901',
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7901,
            session: { secret: 'test-the-passport-bridge' }
          }
        },
        '@apostrophecms/passport-bridge': {
          options: {
            strategies: [
              {
                factory: (options, verify) => new FakeStrategy(options, verify),
                name: 'fake',
                match: 'username'
              }
            ]
          }
        },
        // Something in the session before login, to see whether it lasts
        'session-marker': {
          routes(self) {
            return {
              get: {
                '/test/mark': (req, res) => {
                  req.session.marker = 'set before login';
                  return res.send({});
                },
                '/test/whoami': (req, res) => res.send({
                  username: req.user ? req.user.username : null,
                  marker: req.session.marker || null
                })
              }
            };
          }
        }
      }
    });
    await t.createUser(apos, 'editor', { username: 'editor' });
  });

  after(async function () {
    await t.destroy(apos);
  });

  // A browser, as far as cookies and redirects go: `get` follows no
  // redirects, so each step can be checked
  function browser() {
    const cookies = new Map();
    return {
      async get(path) {
        const response = await fetch(`http://localhost:7901${path}`, {
          redirect: 'manual',
          headers: {
            cookie: [ ...cookies ].map(([ name, value ]) => `${name}=${value}`).join('; ')
          }
        });
        for (const header of response.headers.getSetCookie()) {
          const [ pair ] = header.split(';');
          const index = pair.indexOf('=');
          cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return response;
      },
      // Follows the login's redirects, through the strategy's routes, and
      // returns where the browser is sent next
      async follow(path) {
        let response = await this.get(path);
        let current = path;
        for (let i = 0; (i < 10) && [ 301, 302, 303 ].includes(response.status); i++) {
          const url = new URL(response.headers.get('location'), 'http://localhost:7901');
          current = (url.origin === 'http://localhost:7901')
            ? `${url.pathname}${url.search}`
            : url.href;
          if (!current.startsWith('/auth/')) {
            break;
          }
          response = await this.get(current);
        }
        return current;
      }
    };
  }

  it('logs in through a strategy, and lands on the home page', async function () {
    const user = browser();
    assert.equal(await user.follow('/auth/fake/login'), '/');
    const { username } = await (await user.get('/test/whoami')).json();
    assert.equal(username, 'editor');
  });

  it('starts a fresh session at login, so what was in it before is gone', async function () {
    // Passport 0.6 regenerates the session at login, against session
    // fixation. Anything kept for after the login must survive that
    const user = browser();
    await user.get('/test/mark');
    assert.equal((await (await user.get('/test/whoami')).json()).marker, 'set before login');
    await user.follow('/auth/fake/login');
    const after = await (await user.get('/test/whoami')).json();
    assert.equal(after.username, 'editor');
    assert.equal(after.marker, null);
  });

  describe('returning to where the user was', function () {
    it('sends the user back to the path the login route was given', async function () {
      // As the OAuth approval page does, for someone not yet logged in
      const returnTo = '/api/v1/@apostrophecms/oauth/authorize?client_id=abc&state=x%20y';
      const user = browser();
      const login = `/auth/fake/login?returnTo=${encodeURIComponent(returnTo)}`;
      assert.equal(await user.follow(login), returnTo);
      const { username } = await (await user.get('/test/whoami')).json();
      assert.equal(username, 'editor');
    });

    it('takes only a path on this site', async function () {
      for (const returnTo of [
        'https://elsewhere.example.com/',
        '//elsewhere.example.com/',
        '/\\elsewhere.example.com/',
        '/\telsewhere',
        'javascript:alert(1)',
        'relative/path'
      ]) {
        const user = browser();
        const login = `/auth/fake/login?returnTo=${encodeURIComponent(returnTo)}`;
        assert.equal(await user.follow(login), '/', returnTo);
      }
    });

    it('forgets the path once used, and when a later login has none', async function () {
      const user = browser();
      assert.equal(await user.follow('/auth/fake/login?returnTo=%2Fsomewhere'), '/somewhere');
      assert.equal(await user.follow('/auth/fake/login'), '/');
      // Started, then abandoned, before a plain login
      const other = browser();
      await other.get('/auth/fake/login?returnTo=%2Fsomewhere');
      assert.equal(await other.follow('/auth/fake/login'), '/');
    });

    it('keeps the locale switch across the new session, which wins over the path', async function () {
      // passportLocale used to be lost when Passport started the new
      // session. The values are as the login links send them
      const home = await apos.page.find(apos.task.getReq(), { level: 0 }).toObject();
      const user = browser();
      const login = apos.url.build('/auth/fake/login', {
        returnTo: '/somewhere',
        oldLocale: 'en',
        newLocale: 'en',
        oldAposDocId: home.aposDocId
      });
      const landed = new URL(await user.follow(login), 'http://localhost:7901');
      // The home page, in whichever mode the user now sees
      assert.match(
        landed.pathname,
        new RegExp(`^${apos.page.action}/${home.aposDocId}:en:(draft|published)/locale/en$`)
      );
    });

    it('passes the path on in the login links of a login page that was given one', function () {
      const bridge = apos.modules['@apostrophecms/passport-bridge'];
      const req = apos.task.getAnonReq({ query: { returnTo: '/somewhere?a=1' } });
      const [ link ] = bridge.components.loginLinks(req, {}).links;
      const url = new URL(link.href);
      assert.equal(url.pathname, '/auth/fake/login');
      assert.equal(url.searchParams.get('returnTo'), '/somewhere?a=1');
      const plain = apos.task.getAnonReq({ query: { returnTo: '//elsewhere.example.com' } });
      assert.equal(new URL(bridge.components.loginLinks(plain, {}).links[0].href).search, '');
    });
  });

  describe('where to log in', function () {
    let options;

    beforeEach(function () {
      options = { ...apos.login.options };
    });

    afterEach(function () {
      apos.login.options = options;
    });

    it('is still the login page while it\'s on', function () {
      assert.equal(apos.login.getLoginUrl(), '/login');
    });

    it('is the only strategy\'s login route when the login page is off', function () {
      apos.login.options = {
        ...options,
        localLogin: false
      };
      assert.equal(apos.login.getLoginUrl(), '/auth/fake/login');
    });

    it('is the project\'s own login page, when the login module names one', function () {
      apos.login.options = {
        ...options,
        localLogin: false,
        loginUrl: '/sign-in'
      };
      assert.equal(apos.login.getLoginUrl(), '/sign-in');
    });

    it('is nowhere in particular with several strategies and no login page', function () {
      const bridge = apos.modules['@apostrophecms/passport-bridge'];
      const specs = bridge.specs;
      bridge.specs = {
        ...specs,
        other: {
          ...specs.fake,
          name: 'other'
        }
      };
      apos.login.options = {
        ...options,
        localLogin: false
      };
      try {
        assert.equal(apos.login.getLoginUrl(), null);
      } finally {
        bridge.specs = specs;
      }
    });
  });
});

describe('Passport bridge: an SSO-only site, with an OAuth tool connecting', function () {
  this.timeout(t.timeout);

  const BASE = 'http://localhost:7902';
  const RESOURCE = '/api/v1/test-resource';
  let apos;

  before(async function () {
    apos = await t.create({
      root: module,
      testModule: true,
      baseUrl: BASE,
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7902,
            session: { secret: 'test-the-passport-bridge' }
          }
        },
        '@apostrophecms/login': {
          options: { localLogin: false }
        },
        '@apostrophecms/passport-bridge': {
          options: {
            strategies: [
              {
                factory: (options, verify) => new FakeStrategy(options, verify),
                name: 'fake',
                match: 'username'
              }
            ]
          }
        },
        // Turns the OAuth server on, as the MCP module will
        'test-resource': {
          init(self) {
            self.apos.modules['@apostrophecms/oauth'].addResource(RESOURCE, { name: 'Test resource' });
          }
        }
      }
    });
    await t.createUser(apos, 'editor', { username: 'editor' });
  });

  after(async function () {
    await t.destroy(apos);
  });

  it('logs the user in through the strategy, and returns them to the approval page', async function () {
    const client = await apos.modules['@apostrophecms/oauth'].registerClient({
      client_name: 'Test tool',
      redirect_uris: [ 'http://127.0.0.1/callback' ]
    });
    const authorize = `/api/v1/@apostrophecms/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: 'http://127.0.0.1/callback',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      state: 'the-state',
      resource: `${BASE}${RESOURCE}`
    })}`;
    const cookies = new Map();
    const get = async (path) => {
      const response = await fetch(`${BASE}${path}`, {
        redirect: 'manual',
        headers: {
          cookie: [ ...cookies ].map(([ name, value ]) => `${name}=${value}`).join('; ')
        }
      });
      for (const header of response.headers.getSetCookie()) {
        const [ pair ] = header.split(';');
        const index = pair.indexOf('=');
        cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return response;
    };
    const steps = [];
    let path = authorize;
    let response = await get(path);
    while ([ 302, 303 ].includes(response.status) && (steps.length < 10)) {
      const url = new URL(response.headers.get('location'), BASE);
      path = `${url.pathname}${url.search}`;
      steps.push(url.pathname);
      response = await get(path);
    }
    assert.deepEqual(steps, [
      '/auth/fake/login',
      '/auth/fake/callback',
      '/api/v1/@apostrophecms/oauth/authorize'
    ]);
    assert.equal(path, authorize);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /name="approval"/);
  });
});
