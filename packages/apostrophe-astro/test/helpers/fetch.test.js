import assert from 'node:assert/strict';
import esmock from 'esmock';

const mockConfig = {
  aposHost: 'http://localhost:3000',
  aposPrefix: '',
  staticBuild: null,
  excludeRequestHeaders: []
};

// Returns { createAposFetch, aposFetch, calls } where calls records every
// request passed to the mocked aposResponse.
async function load(configOverrides = {}) {
  const calls = [];
  const config = {
    default: { ...mockConfig, ...configOverrides }
  };
  const mod = await esmock('../../helpers/server/fetch.js', {
    'apostrophe-astro-config/config': config,
    '../../lib/aposResponse.js': {
      default: async (request) => {
        calls.push(request);
        return new Response('{}', {
          headers: { 'content-type': 'application/json' }
        });
      }
    }
  }, {
    'apostrophe-astro-config/config': config
  });
  return {
    ...mod,
    calls
  };
}

function pageRequest(headers = {}) {
  return new Request('http://site-one.localhost:4321/fr/some-page?a=1', {
    method: 'POST',
    body: 'page body',
    headers: {
      host: 'site-one.localhost:4321',
      cookie: 'session=abc',
      'accept-language': 'fr',
      accept: 'text/html',
      'content-type': 'text/plain',
      ...headers
    }
  });
}

describe('createAposFetch', () => {
  const key = 'test-secret-key';

  beforeEach(() => {
    process.env.APOS_EXTERNAL_FRONT_KEY = key;
  });

  afterEach(() => {
    delete process.env.APOS_EXTERNAL_FRONT_KEY;
    delete process.env.APOS_ASTRO_STATIC_BUILD;
  });

  it('resolves a path against the current page and forwards its host and cookies', async () => {
    const { createAposFetch, calls } = await load();
    const response = await createAposFetch(pageRequest())('/api/v1/article?perPage=5');
    assert.deepEqual(await response.json(), {});
    assert.equal(calls.length, 1);
    const [ request ] = calls;
    assert.equal(request.url, 'http://site-one.localhost:4321/api/v1/article?perPage=5');
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.get('host'), 'site-one.localhost:4321');
    assert.equal(request.headers.get('cookie'), 'session=abc');
    assert.equal(request.headers.get('accept-language'), 'fr');
    assert.equal(request.headers.get('x-requested-with'), 'AposExternalFront');
    assert.equal(request.headers.get('apos-external-front-key'), key);
  });

  it('does not forward the headers describing the page request', async () => {
    const { createAposFetch, calls } = await load();
    await createAposFetch(pageRequest())('/api/v1/article');
    const [ request ] = calls;
    assert.equal(request.headers.get('accept'), null);
    assert.equal(request.headers.get('content-type'), null);
    assert.equal(request.body, null);
  });

  it('adds the prefix to a path', async () => {
    const { createAposFetch, calls } = await load({ aposPrefix: '/my-repo' });
    await createAposFetch(pageRequest())('/api/v1/article');
    assert.equal(calls[0].url, 'http://site-one.localhost:4321/my-repo/api/v1/article');
  });

  it('resolves a relative URL against the current page', async () => {
    const { createAposFetch, calls } = await load();
    await createAposFetch(pageRequest())('other-page');
    assert.equal(calls[0].url, 'http://site-one.localhost:4321/fr/other-page');
  });

  it('applies the method, body and headers of init', async () => {
    const { createAposFetch, calls } = await load();
    await createAposFetch(pageRequest())('/api/v1/article', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hello' }),
      headers: {
        'content-type': 'application/json',
        cookie: 'session=other'
      }
    });
    const [ request ] = calls;
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('content-type'), 'application/json');
    assert.equal(request.headers.get('cookie'), 'session=other');
    assert.equal(request.headers.get('host'), 'site-one.localhost:4321');
    assert.deepEqual(await request.json(), { title: 'Hello' });
  });

  it('accepts a Request', async () => {
    const { createAposFetch, calls } = await load();
    await createAposFetch(pageRequest())(new Request('http://ignored/api/v1/article', {
      method: 'PATCH',
      body: 'patch body',
      headers: { 'x-custom': 'yes' }
    }));
    const [ request ] = calls;
    assert.equal(request.url, 'http://ignored/api/v1/article');
    assert.equal(request.method, 'PATCH');
    assert.equal(request.headers.get('x-custom'), 'yes');
    assert.equal(request.headers.get('host'), 'site-one.localhost:4321');
    assert.equal(await request.text(), 'patch body');
  });

  it('returns aposFetch for a prerendered request without reading its headers', async () => {
    const { createAposFetch, aposFetch } = await load();
    const prerendered = { url: 'http://localhost:4321/page' };
    Object.defineProperty(prerendered, 'headers', {
      get: () => {
        throw new Error('headers read');
      }
    });
    assert.equal(createAposFetch(prerendered), aposFetch);
  });

  it('returns aposFetch during a static build', async () => {
    const { createAposFetch, aposFetch } = await load({ staticBuild: { attachments: true } });
    assert.equal(createAposFetch(pageRequest()), aposFetch);
  });
});
