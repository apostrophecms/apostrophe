import assert from 'node:assert/strict';
import esmock from 'esmock';

async function loadAposProxy(mockResponse) {
  return esmock('../../endpoints/aposProxy.js', {
    '../../lib/aposResponse.js': {
      default: async () => mockResponse
    }
  });
}

function makeRequest(url = 'http://localhost:4321/login/callback') {
  return new Request(url);
}

describe('aposProxy', () => {
  it('forwards redirect responses without dropping non-Location headers', async () => {
    // Regression test: Astro's own `redirect()` helper only keeps the
    // Location header, which silently drops the session Set-Cookie header
    // an OAuth callback relies on to mark the browser as authenticated.
    const headers = new Headers();
    headers.set('location', '/dashboard');
    headers.append('set-cookie', 'apos.sid=abc123; Path=/; HttpOnly');
    headers.set('x-custom-auth', 'issued');
    const mockResponse = new Response(null, { status: 302, headers });

    const { ALL } = await loadAposProxy(mockResponse);
    const res = await ALL({ request: makeRequest() });

    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/dashboard');
    assert.equal(res.headers.get('set-cookie'), 'apos.sid=abc123; Path=/; HttpOnly');
    assert.equal(res.headers.get('x-custom-auth'), 'issued');
  });

  it('passes non-redirect responses through unchanged', async () => {
    const mockResponse = new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

    const { ALL } = await loadAposProxy(mockResponse);
    const res = await ALL({ request: makeRequest() });

    assert.equal(res.status, 200);
    assert.equal(await res.text(), '{"ok":true}');
  });

  it('returns a 500 text response when aposResponse throws', async () => {
    const { ALL } = await esmock('../../endpoints/aposProxy.js', {
      '../../lib/aposResponse.js': {
        default: async () => { throw new Error('boom'); }
      }
    });

    const res = await ALL({ request: makeRequest() });
    assert.equal(res.status, 500);
    assert.equal(await res.text(), 'boom');
  });
});
