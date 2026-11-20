const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  PATH, TOKEN, USERNAME, createMcpApos, getUrl, initializeMessage, post, withEnv
} = require('./utils/mcp.js');

// An MCP request acts as its bearer token's user and nothing else: the
// express module's login-token check skips the route, the session cookie is
// dropped, the token is read from the `Authorization` header only, and until
// OAuth the one token taken is APOS_MCP_DEV_TOKEN.

describe('MCP: bearer tokens', function () {
  this.timeout(t.timeout);

  let apos;
  // The `req.user` of each request that reached the SDK's server factory
  let seen;

  before(async function () {
    apos = await createMcpApos(module);
    const createServer = apos.mcp.createServer;
    apos.mcp.createServer = (req) => {
      seen.push(req.user);
      return createServer(req);
    };
  });

  beforeEach(function () {
    seen = [];
  });

  after(async function () {
    await t.destroy(apos);
  });

  it('acts as the development token\'s user', async function () {
    const response = await post(apos);
    assert.equal(response.status, 200);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].username, USERNAME);
  });

  it('refuses any other bearer token with a 401 the route answers', async function () {
    const response = await post(apos, { authorization: 'Bearer some-oauth-access-token' });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer error="invalid_token"');
    assert.deepEqual(seen, []);
  });

  it('refuses a request with no bearer token', async function () {
    const response = await post(apos, { authorization: null });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(seen, []);
  });

  it('takes no identity from a login session', async function () {
    const jar = await t.loginAs(apos, USERNAME);
    const cookie = jar.getCookieStringSync(getUrl(apos, '/'));
    const response = await post(apos, {
      authorization: null,
      cookie
    });
    assert.equal(response.status, 401);
    assert.deepEqual(seen, []);
  });

  it('takes no token from the query string', async function () {
    const response = await post(
      apos,
      { authorization: null },
      initializeMessage(),
      `${PATH}?access_token=${TOKEN}`
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(seen, []);
  });

  it('takes no token from the body', async function () {
    const response = await post(apos, { authorization: null }, {
      ...initializeMessage(),
      access_token: TOKEN
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(seen, []);
  });

  it('takes a lowercase "bearer" scheme', async function () {
    const response = await post(apos, { authorization: `bearer ${TOKEN}` });
    assert.equal(response.status, 200);
    assert.equal(seen[0].username, USERNAME);
  });

  it('leaves other routes to the express module\'s login-token check', async function () {
    const response = await fetch(getUrl(apos, '/api/v1/@apostrophecms/page'), {
      headers: { authorization: `Bearer ${TOKEN}` }
    });
    assert.equal(response.status, 401);
  });

  it('ignores the development token in production', function () {
    withEnv({
      APOS_MCP_DEV_TOKEN: `${TOKEN}:${USERNAME}`,
      NODE_ENV: 'production'
    }, () => {
      assert.equal(apos.mcp.getDevToken(), null);
    });
  });

  it('refuses a malformed development token', function () {
    for (const value of [ TOKEN, 'short:editor', `${TOKEN}:` ]) {
      withEnv({ APOS_MCP_DEV_TOKEN: value }, () => {
        assert.throws(() => apos.mcp.getDevToken(), /APOS_MCP_DEV_TOKEN must be/);
      });
    }
  });
});

// A site may have express-bearer-token read login tokens from a cookie. The
// browser sends that cookie by itself, so the route, exempt from the CSRF check, must not
// take it as identity.
describe('MCP: bearer tokens on a site that reads them from a cookie', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await createMcpApos(module, {
      modules: {
        '@apostrophecms/express': {
          options: {
            expressBearerToken: { cookie: { key: 'access_token' } }
          }
        }
      }
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  it('takes no token from the cookie', async function () {
    const response = await post(apos, {
      authorization: null,
      cookie: `access_token=${TOKEN}`
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
  });
});
