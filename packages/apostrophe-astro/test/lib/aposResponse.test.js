import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import esmock from 'esmock';

const gzipAsync = promisify(zlib.gzip);

const mockConfig = {
  aposHost: 'http://localhost:3000',
  aposPrefix: '',
  staticBuild: null,
  excludeRequestHeaders: []
};

// Build a minimal undici-like response body from a string or Buffer.
// Returns a Uint8Array (valid Response body type) with extra methods
// attached so it works both as a direct Response body (no-compression
// path) and as something with .arrayBuffer()/.dump() (compressed path).
function makeBody(content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  let dumped = false;
  const body = new Uint8Array(buf);
  body.arrayBuffer = async () => buf;
  body.dump = async () => { dumped = true; };
  body.wasDumped = () => dumped;
  return body;
}

async function loadAposResponse(configOverrides = {}, mockRequest) {
  const undiciRequest = mockRequest || (async () => ({
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: makeBody('{"ok":true}')
  }));

  return esmock('../../lib/aposResponse.js', {
    'apostrophe-astro-config/config': {
      default: { ...mockConfig, ...configOverrides }
    },
    'undici': { request: undiciRequest }
  });
}

function makeRequest(url = 'http://localhost:4321/page', headers = {}) {
  return new Request(url, { headers });
}

describe('aposResponse', () => {
  describe('header stripping', () => {
    it('strips Connection header before forwarding', async () => {
      let capturedHeaders;
      const { default: aposResponse } = await loadAposResponse({}, async (url, opts) => {
        capturedHeaders = opts.headers;
        return { statusCode: 200, headers: {}, body: makeBody('{}') };
      });

      const req = makeRequest('http://localhost:4321/page', { connection: 'keep-alive' });
      await aposResponse(req);
      assert.ok(!('connection' in capturedHeaders), 'Connection header should be stripped');
    });

    it('strips Upgrade header before forwarding', async () => {
      let capturedHeaders;
      const { default: aposResponse } = await loadAposResponse({}, async (url, opts) => {
        capturedHeaders = opts.headers;
        return { statusCode: 200, headers: {}, body: makeBody('{}') };
      });

      const req = makeRequest('http://localhost:4321/page', {
        connection: 'Upgrade',
        upgrade: 'websocket'
      });
      await aposResponse(req);
      assert.ok(!('upgrade' in capturedHeaders), 'Upgrade header should be stripped');
      assert.ok(!('connection' in capturedHeaders), 'Connection header should be stripped');
    });

    it('strips headers listed in excludeRequestHeaders config', async () => {
      let capturedHeaders;
      const { default: aposResponse } = await loadAposResponse(
        { excludeRequestHeaders: [ 'X-Internal-Token' ] },
        async (url, opts) => {
          capturedHeaders = opts.headers;
          return { statusCode: 200, headers: {}, body: makeBody('{}') };
        }
      );

      const req = makeRequest('http://localhost:4321/page', { 'x-internal-token': 'secret' });
      await aposResponse(req);
      assert.ok(!('x-internal-token' in capturedHeaders));
    });

    it('forwards unblocked headers', async () => {
      let capturedHeaders;
      const { default: aposResponse } = await loadAposResponse({}, async (url, opts) => {
        capturedHeaders = opts.headers;
        return { statusCode: 200, headers: {}, body: makeBody('{}') };
      });

      const req = makeRequest('http://localhost:4321/page', {
        cookie: 'session=abc',
        'accept-language': 'fr'
      });
      await aposResponse(req);
      assert.equal(capturedHeaders['cookie'], 'session=abc');
      assert.equal(capturedHeaders['accept-language'], 'fr');
    });
  });

  describe('URL construction', () => {
    it('routes to the configured aposHost', async () => {
      let capturedUrl;
      const { default: aposResponse } = await loadAposResponse({}, async (url, opts) => {
        capturedUrl = url;
        return { statusCode: 200, headers: {}, body: makeBody('{}') };
      });

      await aposResponse(makeRequest('http://localhost:4321/some/page'));
      assert.ok(capturedUrl.startsWith('http://localhost:3000'), `Expected localhost:3000, got ${capturedUrl}`);
    });

    it('preserves the request path and query string', async () => {
      let capturedUrl;
      const { default: aposResponse } = await loadAposResponse({}, async (url, opts) => {
        capturedUrl = url;
        return { statusCode: 200, headers: {}, body: makeBody('{}') };
      });

      await aposResponse(makeRequest('http://localhost:4321/page?foo=bar'));
      assert.ok(capturedUrl.includes('/page?foo=bar'), `URL should include path+query, got ${capturedUrl}`);
    });
  });

  describe('invalid Host header', () => {
    it('returns 400 when Host contains a slash', async () => {
      const { default: aposResponse } = await loadAposResponse();
      const req = makeRequest('http://localhost:4321/page', { host: 'localhost:4321/malicious' });
      const res = await aposResponse(req);
      assert.equal(res.status, 400);
    });
  });

  describe('bodyless status codes', () => {
    for (const status of [ 204, 304 ]) {
      it(`returns null body for ${status}`, async () => {
        const { default: aposResponse } = await loadAposResponse({}, async () => ({
          statusCode: status,
          headers: {},
          body: makeBody('')
        }));
        const res = await aposResponse(makeRequest());
        assert.equal(res.status, status);
        assert.equal(res.body, null);
      });
    }
  });

  describe('normal response', () => {
    it('returns the response body for 200', async () => {
      const { default: aposResponse } = await loadAposResponse({}, async () => ({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: makeBody('{"page":"home"}')
      }));
      const res = await aposResponse(makeRequest());
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.page, 'home');
    });

    it('passes response headers through', async () => {
      const { default: aposResponse } = await loadAposResponse({}, async () => ({
        statusCode: 200,
        headers: { 'x-custom': 'value' },
        body: makeBody('{}')
      }));
      const res = await aposResponse(makeRequest());
      assert.equal(res.headers.get('x-custom'), 'value');
    });
  });

  describe('decompression', () => {
    it('decompresses gzip-encoded responses', async () => {
      const compressed = await gzipAsync(Buffer.from('{"compressed":true}'));
      const { default: aposResponse } = await loadAposResponse({}, async () => ({
        statusCode: 200,
        headers: { 'content-encoding': 'gzip', 'content-type': 'application/json' },
        body: {
          arrayBuffer: async () => compressed
        }
      }));
      const res = await aposResponse(makeRequest());
      assert.equal(res.headers.get('content-encoding'), null);
      const data = await res.json();
      assert.equal(data.compressed, true);
    });
  });

  describe('error handling', () => {
    it('returns a 500 text response when undici throws', async () => {
      const { default: aposResponse } = await loadAposResponse({}, async () => {
        throw new Error('connection refused');
      });
      const res = await aposResponse(makeRequest());
      assert.equal(res.status, 500);
      const text = await res.text();
      assert.match(text, /connection refused/);
    });
  });
});
