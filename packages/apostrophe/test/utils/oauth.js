// Shared by the test/oauth-*.js files: a site whose OAuth server is on
// because a test module protects one route with it, as the MCP module will.

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

// `root` is the test file's `module`. `oauth` is the OAuth module's options
function createOauthApos(root, {
  oauth, resource = true, baseUrl = BASE_URL
} = {}) {
  return t.create({
    root,
    ...(baseUrl && { baseUrl }),
    modules: {
      ...(oauth && { '@apostrophecms/oauth': { options: oauth } }),
      ...(resource && { 'oauth-test-resource': resourceModule })
    }
  });
}

// A local URL for `path`, or for an absolute URL under `BASE_URL`
function getUrl(apos, path) {
  const { port } = apos.modules['@apostrophecms/express'].server.address();
  const local = `http://localhost:${port}`;
  return path.startsWith(BASE_URL) ? local + path.slice(BASE_URL.length) : local + path;
}

module.exports = {
  ACTION,
  BASE_URL,
  RESOURCE,
  createOauthApos,
  getUrl
};
