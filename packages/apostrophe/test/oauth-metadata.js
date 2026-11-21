const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The OAuth server's S1: it's off until a resource registers, serves its own
// metadata (RFC 8414) and each resource's (RFC 9728) while on, and gives
// resources the 401 challenge that leads a client from a resource to the
// server, as MCP clients discover it.

const {
  ACTION, BASE_URL, RESOURCE, createOauthApos, getUrl
} = require('./utils/oauth.js');

function create(options) {
  return createOauthApos(module, options);
}

function get(apos, path, init) {
  return fetch(getUrl(apos, path), init);
}

// The `name="value"` parameters of a `WWW-Authenticate: Bearer ...` header
function parseChallenge(header) {
  assert.match(header, /^Bearer( |$)/);
  return Object.fromEntries(
    [ ...header.matchAll(/(\w+)="([^"]*)"/g) ].map(([ , name, value ]) => [ name, value ])
  );
}

describe('OAuth: metadata and the challenge', function () {
  this.timeout(t.timeout);

  describe('with a resource registered', function () {
    let apos;

    before(async function () {
      apos = await create();
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('turns on when a resource registers', function () {
      assert.equal(apos.modules['oauth-test-resource'].registered, true);
      assert.equal(apos.modules['@apostrophecms/oauth'].isEnabled(), true);
    });

    it('serves the authorization server metadata', async function () {
      const response = await get(apos, '/.well-known/oauth-authorization-server');
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        issuer: BASE_URL,
        authorization_endpoint: `${BASE_URL}${ACTION}/authorize`,
        token_endpoint: `${BASE_URL}${ACTION}/token`,
        registration_endpoint: `${BASE_URL}${ACTION}/register`,
        revocation_endpoint: `${BASE_URL}${ACTION}/revoke`,
        scopes_supported: [ 'content' ],
        response_types_supported: [ 'code' ],
        response_modes_supported: [ 'query' ],
        grant_types_supported: [ 'authorization_code', 'refresh_token' ],
        token_endpoint_auth_methods_supported: [ 'none' ],
        revocation_endpoint_auth_methods_supported: [ 'none' ],
        code_challenge_methods_supported: [ 'S256' ],
        authorization_response_iss_parameter_supported: true,
        client_id_metadata_document_supported: true
      });
    });

    it('serves the resource\'s metadata', async function () {
      const response = await get(apos, `/.well-known/oauth-protected-resource${RESOURCE}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        resource: `${BASE_URL}${RESOURCE}`,
        authorization_servers: [ BASE_URL ],
        scopes_supported: [ 'content' ],
        bearer_methods_supported: [ 'header' ],
        resource_name: 'Test resource'
      });
    });

    it('uses baseUrl, not the request\'s host', async function () {
      const response = await get(apos, '/.well-known/oauth-authorization-server', {
        headers: { 'x-forwarded-host': 'elsewhere.example.com' }
      });
      assert.equal((await response.json()).issuer, BASE_URL);
    });

    it('answers 404 for a path that is not a resource', async function () {
      for (const path of [ '/api/v1/@apostrophecms/page', `${RESOURCE}/more`, `${RESOURCE}x` ]) {
        const response = await get(apos, `/.well-known/oauth-protected-resource${path}`);
        assert.equal(response.status, 404, path);
      }
    });

    it('lets any origin read the metadata', async function () {
      for (const path of [
        '/.well-known/oauth-authorization-server',
        `/.well-known/oauth-protected-resource${RESOURCE}`
      ]) {
        const response = await get(apos, path, {
          headers: { origin: 'http://localhost:6274' }
        });
        assert.equal(response.headers.get('access-control-allow-origin'), '*', path);
        const preflight = await get(apos, path, {
          method: 'OPTIONS',
          headers: {
            origin: 'http://localhost:6274',
            'access-control-request-method': 'GET',
            'access-control-request-headers': 'mcp-protocol-version'
          }
        });
        assert.equal(preflight.status, 204, path);
        assert.equal(preflight.headers.get('access-control-allow-origin'), '*', path);
        assert.match(preflight.headers.get('access-control-allow-headers'), /MCP-Protocol-Version/i);
      }
    });

    it('challenges a request with no token, naming the resource\'s metadata', async function () {
      const response = await get(apos, RESOURCE);
      assert.equal(response.status, 401);
      const header = response.headers.get('www-authenticate');
      assert.deepEqual(parseChallenge(header), {
        resource_metadata: `${BASE_URL}/.well-known/oauth-protected-resource${RESOURCE}`,
        scope: 'content'
      });
      assert.equal(response.headers.get('access-control-expose-headers'), 'WWW-Authenticate');
    });

    it('adds invalid_token for a token it refuses', async function () {
      const response = await get(apos, `${RESOURCE}?refuse=1`);
      assert.equal(response.status, 401);
      assert.equal(parseChallenge(response.headers.get('www-authenticate')).error, 'invalid_token');
    });

    it('leads a client from the resource to the authorization server', async function () {
      // As an MCP client discovers it: the 401, the resource's metadata,
      // then the server's
      const challenge = await get(apos, RESOURCE);
      const { resource_metadata: resourceMetadataUrl } = parseChallenge(
        challenge.headers.get('www-authenticate')
      );
      const resourceMetadata = await (await get(apos, resourceMetadataUrl)).json();
      assert.equal(resourceMetadata.resource, `${BASE_URL}${RESOURCE}`);
      const [ issuer ] = resourceMetadata.authorization_servers;
      const issuerUrl = new URL(issuer);
      const serverMetadata = await (await get(
        apos,
        `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerUrl.pathname.replace(/\/$/, '')}`
      )).json();
      assert.equal(serverMetadata.issuer, issuer);
      assert.deepEqual(serverMetadata.code_challenge_methods_supported, [ 'S256' ]);
    });

    it('refuses a resource description that is not a string or a function', function () {
      assert.throws(
        () => apos.modules['@apostrophecms/oauth'].addResource('/api/v1/other', { description: 42 }),
        /description must be a string or a function of req/
      );
    });

    it('refuses a resource path that does not start with / or ends with /', function () {
      for (const path of [ 'api/v1/x', '/api/v1/x/', '', null ]) {
        assert.throws(() => apos.modules['@apostrophecms/oauth'].addResource(path), /must start with \//);
      }
    });
  });

  describe('off', function () {
    let apos;

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('is off, and needs no baseUrl, with no resource registered', async function () {
      apos = await create({
        resource: false,
        baseUrl: null
      });
      assert.equal(apos.modules['@apostrophecms/oauth'].isEnabled(), false);
      const response = await get(apos, '/.well-known/oauth-authorization-server');
      assert.equal(response.status, 404);
    });
  });

  describe('turned off', function () {
    let apos;

    before(async function () {
      apos = await create({ oauth: { enabled: false } });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('ignores a resource that registers', function () {
      assert.equal(apos.modules['oauth-test-resource'].registered, false);
      assert.equal(apos.modules['@apostrophecms/oauth'].isEnabled(), false);
    });

    it('serves no metadata', async function () {
      for (const path of [
        '/.well-known/oauth-authorization-server',
        `/.well-known/oauth-protected-resource${RESOURCE}`
      ]) {
        const response = await get(apos, path);
        assert.equal(response.status, 404, path);
      }
    });

    it('still challenges, without the metadata', async function () {
      const response = await get(apos, RESOURCE);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    });
  });

  describe('turned on with no resource', function () {
    let apos;

    before(async function () {
      apos = await create({
        oauth: { enabled: true },
        resource: false
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('serves the authorization server metadata', async function () {
      const response = await get(apos, '/.well-known/oauth-authorization-server');
      assert.equal(response.status, 200);
      assert.equal((await response.json()).issuer, BASE_URL);
    });
  });

  describe('options', function () {
    let apos;

    before(async function () {
      apos = await create();
    });

    after(async function () {
      await t.destroy(apos);
    });

    // Checked on the running site with the option swapped in: a startup that
    // throws exits the process
    function withOption(target, name, value, fn) {
      const saved = target[name];
      target[name] = value;
      try {
        fn();
      } finally {
        target[name] = saved;
      }
    }

    it('requires baseUrl while on', function () {
      withOption(apos, 'baseUrl', undefined, () => {
        assert.throws(() => apos.modules['@apostrophecms/oauth'].validateBaseUrl(), /OAuth is on because these routes accept its tokens: \/api\/v1\/oauth-test-resource. It needs the site's baseUrl/);
      });
    });

    it('refuses a site with a prefix while on', function () {
      withOption(apos, 'prefix', '/cms', () => {
        assert.throws(() => apos.modules['@apostrophecms/oauth'].validatePrefix(), /doesn't support a site with a prefix \("\/cms"\) yet/);
      });
    });

    it('leaves a site with a prefix alone while off', function () {
      withOption(apos.modules['@apostrophecms/oauth'].options, 'enabled', false, () => {
        withOption(apos, 'prefix', '/cms', () => {
          apos.modules['@apostrophecms/oauth'].validatePrefix();
        });
      });
    });

    it('refuses an enabled option that is not a boolean', function () {
      withOption(apos.modules['@apostrophecms/oauth'].options, 'enabled', 'yes', () => {
        assert.throws(() => apos.modules['@apostrophecms/oauth'].validateOptions(), /must be a boolean/);
      });
    });
  });
});
