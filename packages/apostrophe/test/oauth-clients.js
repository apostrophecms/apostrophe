const assert = require('assert').strict;
const http = require('node:http');
const t = require('../test-lib/test.js');
const {
  ACTION, createOauthApos, getUrl
} = require('./utils/oauth.js');

// The OAuth server's S2: clients register with DCR (RFC 7591) or are known
// by a Client ID Metadata Document (CIMD), and either way a bad redirect URI
// is refused.

const REGISTER = `${ACTION}/register`;
const DOCUMENT_URL = 'https://client.example.com/oauth/client.json';

function register(apos, body, headers = {}) {
  return fetch(getUrl(apos, REGISTER), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: (typeof body === 'string') ? body : JSON.stringify(body)
  });
}

async function assertOauthError(response, status, error) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.error, error, JSON.stringify(body));
  assert.equal(typeof body.error_description, 'string');
  return body;
}

describe('OAuth: clients', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await createOauthApos(module);
  });

  after(async function () {
    await t.destroy(apos);
  });

  describe('dynamic client registration', function () {
    it('registers a public client, filling in the defaults', async function () {
      const response = await register(apos, {
        client_name: 'Test tool',
        redirect_uris: [ 'https://tool.example.com/callback' ],
        unknown_field: 'dropped'
      }, { origin: 'http://localhost:6274' });
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
      const body = await response.json();
      const {
        client_id: clientId, client_id_issued_at: issuedAt, ...metadata
      } = body;
      assert.match(clientId, /^[\w-]{32}$/);
      assert.ok(Math.abs(issuedAt - (Date.now() / 1000)) < 60);
      assert.deepEqual(metadata, {
        client_name: 'Test tool',
        redirect_uris: [ 'https://tool.example.com/callback' ],
        token_endpoint_auth_method: 'none',
        grant_types: [ 'authorization_code' ],
        response_types: [ 'code' ],
        scope: 'content'
      });
      assert.equal(body.client_secret, undefined);

      const client = await apos.oauth.getClient(clientId);
      assert.equal(client.source, 'dcr');
      assert.deepEqual(client.metadata, metadata);
    });

    it('records a registration', async function () {
      const logInfo = apos.oauth.logInfo;
      const entries = [];
      apos.oauth.logInfo = (...args) => entries.push(args);
      let body;
      try {
        body = await (await register(apos, {
          client_name: 'Logged tool',
          redirect_uris: [ 'https://tool.example.com/callback' ]
        })).json();
      } finally {
        apos.oauth.logInfo = logInfo;
      }
      const entry = entries.find(args => args[1] === 'client-registered');
      assert.ok(entry, JSON.stringify(entries.map(args => args.slice(1))));
      assert.equal(typeof entry[0].t, 'function');
      assert.deepEqual(entry[2], {
        clientId: body.client_id,
        clientName: 'Logged tool',
        redirectUris: [ 'https://tool.example.com/callback' ]
      });
    });

    it('takes loopback and private-use scheme redirect URIs', async function () {
      const redirectUris = [
        'http://127.0.0.1/callback',
        'http://[::1]:8080/callback',
        'http://localhost:33418/',
        'cursor://anysphere.cursor-mcp/oauth/callback'
      ];
      const response = await register(apos, {
        redirect_uris: redirectUris,
        grant_types: [ 'authorization_code', 'refresh_token' ]
      });
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.deepEqual(body.redirect_uris, redirectUris);
      assert.deepEqual(body.grant_types, [ 'authorization_code', 'refresh_token' ]);
    });

    it('refuses a bad redirect URI', async function () {
      for (const uri of [
        'http://tool.example.com/callback',
        'https://tool.example.com/callback#fragment',
        'https://user:pass@tool.example.com/callback',
        'javascript:alert(1)',
        'data:text/html,hi',
        'file:///etc/passwd',
        '/relative/callback',
        'not a url'
      ]) {
        const response = await register(apos, { redirect_uris: [ uri ] });
        await assertOauthError(response, 400, 'invalid_redirect_uri');
      }
    });

    it('refuses missing or too many redirect URIs', async function () {
      for (const redirectUris of [
        undefined,
        [],
        'https://tool.example.com/callback',
        Array.from({ length: 11 }, (_, i) => `https://tool.example.com/${i}`)
      ]) {
        const response = await register(apos, { redirect_uris: redirectUris });
        await assertOauthError(response, 400, 'invalid_redirect_uri');
      }
    });

    it('refuses metadata it does not support', async function () {
      const redirectUris = [ 'https://tool.example.com/callback' ];
      for (const extra of [
        { token_endpoint_auth_method: 'client_secret_basic' },
        { client_secret: 'secret' },
        { grant_types: [ 'implicit' ] },
        { grant_types: [ 'refresh_token' ] },
        { grant_types: [ 'authorization_code', 'client_credentials' ] },
        { response_types: [ 'token' ] },
        { scope: 'content admin' },
        { client_name: 'x'.repeat(201) },
        { client_uri: 'http://tool.example.com' },
        { logo_uri: 'javascript:alert(1)' }
      ]) {
        const response = await register(apos, {
          redirect_uris: redirectUris,
          ...extra
        });
        await assertOauthError(response, 400, 'invalid_client_metadata');
      }
    });

    it('refuses a body that is not a JSON object', async function () {
      for (const body of [ '[]', '"text"', '{ not json' ]) {
        const response = await register(apos, body);
        await assertOauthError(response, 400, 'invalid_client_metadata');
      }
    });

    it('refuses a large body before the site\'s own parser reads it', async function () {
      const response = await register(apos, {
        redirect_uris: [ 'https://tool.example.com/callback' ],
        padding: 'x'.repeat(20 * 1024)
      });
      await assertOauthError(response, 413, 'invalid_client_metadata');
    });

    it('answers the CORS preflight (the express module does, for /api/v1)', async function () {
      const response = await fetch(getUrl(apos, REGISTER), {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:6274',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type'
        }
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
      assert.match(response.headers.get('access-control-allow-methods'), /POST/);
      assert.match(response.headers.get('access-control-allow-headers'), /content-type/i);
    });
  });

  describe('matching redirect URIs', function () {
    const client = {
      metadata: {
        redirect_uris: [
          'https://tool.example.com/callback',
          'http://127.0.0.1/callback',
          'http://localhost:9999/cb?x=1'
        ]
      }
    };

    it('matches exactly', function () {
      assert.equal(apos.oauth.matchesRedirectUri(client, 'https://tool.example.com/callback'), true);
      for (const uri of [
        'https://tool.example.com/callback/',
        'https://tool.example.com/callback/more',
        'https://tool.example.com/callback?x=1',
        'https://tool.example.com:8443/callback',
        'https://TOOL.example.com/callback',
        'http://tool.example.com/callback',
        null
      ]) {
        assert.equal(apos.oauth.matchesRedirectUri(client, uri), false, uri);
      }
    });

    it('takes any port on a loopback URI, and nothing else', function () {
      assert.equal(apos.oauth.matchesRedirectUri(client, 'http://127.0.0.1:51234/callback'), true);
      assert.equal(apos.oauth.matchesRedirectUri(client, 'http://localhost:1234/cb?x=1'), true);
      for (const uri of [
        'http://127.0.0.1:51234/other',
        'http://localhost:51234/callback',
        'http://[::1]:51234/callback',
        'http://localhost:1234/cb?x=2'
      ]) {
        assert.equal(apos.oauth.matchesRedirectUri(client, uri), false, uri);
      }
    });
  });

  describe('looking up a client', function () {
    it('finds no client for an unknown or malformed id', async function () {
      for (const clientId of [ 'unknown', '', null, 42, { $ne: null }, 'x'.repeat(2001) ]) {
        assert.equal(await apos.oauth.getClient(clientId), null);
      }
    });
  });

  describe('client metadata documents', function () {
    let fetched;
    let answer;
    let fetchClientMetadataDocument;

    before(function () {
      fetchClientMetadataDocument = apos.oauth.fetchClientMetadataDocument;
      apos.oauth.fetchClientMetadataDocument = async (url) => {
        fetched.push(url);
        return answer(url);
      };
    });

    after(function () {
      apos.oauth.fetchClientMetadataDocument = fetchClientMetadataDocument;
    });

    beforeEach(async function () {
      fetched = [];
      await apos.oauth.clients.deleteMany({ source: 'cimd' });
    });

    function document(extra = {}) {
      return {
        client_id: DOCUMENT_URL,
        client_name: 'Document tool',
        redirect_uris: [ 'https://client.example.com/callback' ],
        ...extra
      };
    }

    it('fetches the document and caches it', async function () {
      answer = () => ({
        document: document(),
        maxAge: 600
      });
      const client = await apos.oauth.getClient(DOCUMENT_URL);
      assert.equal(client.source, 'cimd');
      assert.equal(client.clientId, DOCUMENT_URL);
      assert.equal(client.metadata.client_name, 'Document tool');
      assert.deepEqual(client.metadata.redirect_uris, [ 'https://client.example.com/callback' ]);
      await apos.oauth.getClient(DOCUMENT_URL);
      assert.deepEqual(fetched, [ DOCUMENT_URL ]);

      const cached = await apos.oauth.clients.findOne({ _id: DOCUMENT_URL });
      const seconds = (cached.expiresAt - cached.fetchedAt) / 1000;
      assert.ok(Math.abs(seconds - 600) < 5, String(seconds));
    });

    it('keeps the cache time within bounds', async function () {
      for (const [ maxAge, expected ] of [
        [ 0, 5 * 60 ],
        [ null, 60 * 60 ],
        [ 365 * 24 * 60 * 60, 24 * 60 * 60 ]
      ]) {
        await apos.oauth.clients.deleteMany({ source: 'cimd' });
        answer = () => ({
          document: document(),
          maxAge
        });
        await apos.oauth.getClient(DOCUMENT_URL);
        const cached = await apos.oauth.clients.findOne({ _id: DOCUMENT_URL });
        const seconds = (cached.expiresAt - cached.fetchedAt) / 1000;
        assert.ok(Math.abs(seconds - expected) < 5, `${maxAge}: ${seconds}`);
      }
    });

    it('fetches the document again once the cache expires', async function () {
      answer = () => ({ document: document() });
      await apos.oauth.getClient(DOCUMENT_URL);
      await apos.oauth.clients.updateOne(
        { _id: DOCUMENT_URL },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );
      await apos.oauth.getClient(DOCUMENT_URL);
      assert.equal(fetched.length, 2);
    });

    it('refuses a document that names another client_id', async function () {
      answer = () => ({ document: document({ client_id: 'https://other.example.com/client.json' }) });
      await assert.rejects(apos.oauth.getClient(DOCUMENT_URL), (e) => {
        assert.equal(e.oauth.error, 'invalid_client');
        assert.match(e.message, /different client_id/);
        return true;
      });
      assert.equal(await apos.oauth.clients.countDocuments({ _id: DOCUMENT_URL }), 0);
    });

    it('refuses a document with a secret or a bad redirect URI', async function () {
      for (const extra of [
        { token_endpoint_auth_method: 'client_secret_post' },
        { client_secret: 'secret' },
        { redirect_uris: [ 'http://client.example.com/callback' ] }
      ]) {
        answer = () => ({ document: document(extra) });
        await assert.rejects(apos.oauth.getClient(DOCUMENT_URL), (e) => {
          assert.equal(e.oauth.error, 'invalid_client');
          assert.match(e.message, /is not valid/);
          return true;
        }, JSON.stringify(extra));
      }
    });

    it('refuses a document it could not fetch', async function () {
      answer = () => {
        throw Object.assign(new Error('the response status was 404'), { aboutDocument: true });
      };
      await assert.rejects(apos.oauth.getClient(DOCUMENT_URL), (e) => {
        assert.equal(e.oauth.error, 'invalid_client');
        assert.match(e.message, /could not be fetched .* status was 404/);
        return true;
      });
    });

    it('says nothing about the address when it could not fetch, but keeps the cause', async function () {
      answer = () => {
        throw new Error('intranet.example resolves to 10.1.2.3, which is not a public address');
      };
      await assert.rejects(apos.oauth.getClient(DOCUMENT_URL), (e) => {
        assert.equal(e.oauth.error, 'invalid_client');
        assert.match(e.oauth.error_description, /could not be fetched .*: its address could not be reached$/);
        assert.doesNotMatch(e.oauth.error_description, /10\.1\.2\.3|resolves/);
        assert.match(e.cause.message, /resolves to 10\.1\.2\.3/);
        return true;
      });
    });

    it('refuses a client id URL that breaks the rules, without fetching', async function () {
      answer = () => ({ document: document() });
      for (const clientId of [
        'https://client.example.com',
        'https://client.example.com/',
        'https://client.example.com/a/../client.json',
        'https://client.example.com/./client.json',
        'https://Client.example.com/client.json',
        'https://client.example.com:443/client.json',
        'https://user:pass@client.example.com/client.json',
        'https://client.example.com/client.json#x'
      ]) {
        await assert.rejects(apos.oauth.getClient(clientId), (e) => {
          assert.equal(e.oauth.error, 'invalid_client');
          return true;
        }, clientId);
      }
      assert.deepEqual(fetched, []);
    });

    it('treats a client id URL as unknown when documents are turned off', async function () {
      answer = () => ({ document: document() });
      apos.oauth.options.clientMetadataDocuments = false;
      try {
        assert.equal(await apos.oauth.getClient(DOCUMENT_URL), null);
        const metadata = apos.oauth.getAuthorizationServerMetadata();
        assert.equal(metadata.client_id_metadata_document_supported, false);
      } finally {
        apos.oauth.options.clientMetadataDocuments = true;
      }
      assert.deepEqual(fetched, []);
    });
  });

  describe('fetching a client metadata document', function () {
    it('knows which addresses are public', function () {
      for (const address of [ '8.8.8.8', '1.1.1.1', '2606:4700:4700::1111' ]) {
        assert.equal(apos.oauth.isPublicAddress(address), true, address);
      }
      for (const address of [
        '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
        '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
        '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1',
        '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::a00:1', 'not an address'
      ]) {
        assert.equal(apos.oauth.isPublicAddress(address), false, address);
      }
    });

    it('refuses a private address in the URL', async function () {
      for (const url of [
        'https://127.0.0.1/client.json',
        'https://[::1]/client.json',
        'https://169.254.169.254/client.json',
        'https://[::ffff:127.0.0.1]/client.json'
      ]) {
        await assert.rejects(apos.oauth.fetchClientMetadataDocument(url), /not a public address/, url);
      }
    });

    it('refuses a name that resolves to a private address', async function () {
      await assert.rejects(
        apos.oauth.fetchClientMetadataDocument('https://localhost/client.json'),
        (e) => {
          assert.match(e.message, /localhost resolves to .*, which is not a public address/);
          // About this server's network, so not for the page
          assert.notEqual(e.aboutDocument, true);
          return true;
        }
      );
    });

    describe('against a local server', function () {
      let server;
      let base;
      let handler;
      let isPublicAddress;

      // The local server is on a loopback address, which the fetch refuses,
      // so loopback counts as public here, and it's http, not https
      before(async function () {
        isPublicAddress = apos.oauth.isPublicAddress;
        apos.oauth.isPublicAddress = (address) => [ '127.0.0.1', '::1' ].includes(address) ||
          isPublicAddress(address);
        server = http.createServer((req, res) => handler(req, res));
        await new Promise(resolve => server.listen(0, resolve));
        base = `http://localhost:${server.address().port}`;
      });

      after(async function () {
        apos.oauth.isPublicAddress = isPublicAddress;
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      });

      function fetchLocal(path, options = {}) {
        return apos.oauth.fetchClientMetadataDocument(`${base}${path}`, {
          transport: http,
          ...options
        });
      }

      function json(res, value, headers = {}) {
        res.writeHead(200, {
          'content-type': 'application/json',
          ...headers
        });
        res.end(JSON.stringify(value));
      }

      it('reads the document and its max-age', async function () {
        handler = (req, res) => json(res, { client_id: 'x' }, { 'cache-control': 'public, max-age=120' });
        assert.deepEqual(await fetchLocal('/client.json'), {
          document: { client_id: 'x' },
          maxAge: 120
        });
      });

      it('follows no redirect', async function () {
        handler = (req, res) => {
          res.writeHead(302, { location: 'http://169.254.169.254/' });
          res.end();
        };
        await assert.rejects(fetchLocal('/client.json'), (e) => {
          assert.match(e.message, /status was 302/);
          // About the document, so the page may show it
          assert.equal(e.aboutDocument, true);
          return true;
        });
      });

      it('refuses a response that is not JSON', async function () {
        handler = (req, res) => {
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end('<html></html>');
        };
        await assert.rejects(fetchLocal('/client.json'), /not JSON/);
        handler = (req, res) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('[ 1, 2 ]');
        };
        await assert.rejects(fetchLocal('/client.json'), /not a JSON object/);
      });

      it('refuses a document over the size cap, declared or not', async function () {
        const big = { padding: 'x'.repeat(6 * 1024) };
        handler = (req, res) => json(res, big);
        await assert.rejects(fetchLocal('/client.json'), /larger than 5120 bytes/);
        handler = (req, res) => {
          // Chunked, with no content-length
          res.writeHead(200, { 'content-type': 'application/json' });
          res.write('{"padding":"');
          res.write('x'.repeat(6 * 1024));
          res.end('"}');
        };
        await assert.rejects(fetchLocal('/client.json'), /larger than 5120 bytes/);
      });

      it('gives up on a slow server', async function () {
        handler = () => {};
        await assert.rejects(fetchLocal('/client.json', { timeout: 200 }), /no response within 0.2 seconds/);
      });
    });
  });
});
