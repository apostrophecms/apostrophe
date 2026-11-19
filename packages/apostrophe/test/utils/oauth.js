// Shared by the test/oauth-*.js files: a site whose OAuth server is on
// because a test module protects one route with it, as the MCP module will.

const crypto = require('node:crypto');
const t = require('../../test-lib/test.js');

const BASE_URL = 'https://cms.example.com';
const RESOURCE = '/api/v1/oauth-test-resource';
const ACTION = '/api/v1/@apostrophecms/oauth';

const resourceModule = {
  init(self) {
    self.registered = self.apos.oauth.addResource(RESOURCE, {
      name: 'Test resource',
      // As the MCP module will, through req.t
      description: (req) => `It can read <your> content (${req.locale}).`
    });
  },
  routes(self) {
    return {
      get: {
        [RESOURCE]: (req, res) => {
          // Core's login-token check answers any bearer header on this
          // route itself, so the refusal is asked for with a flag
          if (req.query.refuse) {
            return self.apos.oauth.challenge(res, RESOURCE, { error: 'invalid_token' });
          }
          return self.apos.oauth.challenge(res, RESOURCE);
        }
      }
    };
  }
};

// `root` is the test file's `module`. `oauth` is the OAuth module's options.
// `modules` are more modules for the site
function createOauthApos(root, {
  oauth, resource = true, baseUrl = BASE_URL, modules = {}
} = {}) {
  return t.create({
    root,
    ...(baseUrl && { baseUrl }),
    modules: {
      ...(oauth && { '@apostrophecms/oauth': { options: oauth } }),
      ...(resource && { 'oauth-test-resource': resourceModule }),
      ...modules
    }
  });
}

// A local URL for `path`, or for an absolute URL under `BASE_URL`
function getUrl(apos, path) {
  const { port } = apos.modules['@apostrophecms/express'].server.address();
  const local = `http://localhost:${port}`;
  return path.startsWith(BASE_URL) ? local + path.slice(BASE_URL.length) : local + path;
}

// Connects `client` as the user whose session cookie is `cookie`: the
// authorize step, Approve, and the code exchange, by hand, for the resource
// identifier `resource`. Returns the token response
async function connect(apos, {
  client, cookie, resource = `${BASE_URL}${RESOURCE}`
}) {
  const redirectUri = client.redirect_uris[0];
  const verifier = crypto.randomBytes(32).toString('base64url');
  const search = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: redirectUri,
    code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: 'the-state',
    resource
  });
  const page = await fetch(getUrl(apos, `${ACTION}/authorize?${search}`), {
    redirect: 'manual',
    headers: { cookie }
  });
  const html = await page.text();
  const matches = html.match(/name="approval" value="([^"]+)"/);
  if (!matches) {
    throw new Error(`No approval page: ${page.status} ${html}`);
  }
  const decision = await fetch(getUrl(apos, `${ACTION}/authorize`), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie
    },
    body: new URLSearchParams({
      approval: matches[1],
      decision: 'approve'
    }).toString()
  });
  const code = new URL(decision.headers.get('location')).searchParams.get('code');
  const response = await fetch(getUrl(apos, `${ACTION}/token`), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: client.client_id,
      code,
      code_verifier: verifier,
      resource
    }).toString()
  });
  const tokens = await response.json();
  if (response.status !== 200) {
    throw new Error(`No tokens: ${JSON.stringify(tokens)}`);
  }
  return tokens;
}

module.exports = {
  ACTION,
  BASE_URL,
  RESOURCE,
  connect,
  createOauthApos,
  getUrl
};
