import assert from 'node:assert/strict';
import esmock from 'esmock';

const mockConfig = {
  aposHost: 'http://localhost:3000',
  aposPrefix: '',
  staticBuild: null,
  excludeRequestHeaders: []
};

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' }
  });
}

// Returns { aposPageFetch, calls } where calls records the URL of every
// request passed to the mocked aposResponse, and responses are served
// from the given queue in order.
async function load(responses, configOverrides = {}) {
  const calls = [];
  const queue = [ ...responses ];
  const mod = await esmock('../../lib/aposPageFetch.js', {
    'apostrophe-astro-config/config': {
      default: { ...mockConfig, ...configOverrides }
    },
    '../../lib/aposResponse.js': {
      default: async (request) => {
        calls.push(request.url);
        if (!queue.length) {
          throw new Error('aposResponse called more times than expected');
        }
        const next = queue.shift();
        return typeof next === 'function' ? next() : jsonResponse(next);
      }
    }
  });
  return {
    aposPageFetch: mod.default,
    calls
  };
}

describe('aposPageFetch redirect handling', () => {
  beforeEach(() => {
    process.env.APOS_EXTERNAL_FRONT_KEY = 'test-secret-key';
  });

  afterEach(() => {
    delete process.env.APOS_EXTERNAL_FRONT_KEY;
    delete process.env.APOS_ASTRO_STATIC_BUILD;
  });

  it('preserves the query string when following a trailing-slash redirect', async () => {
    const { aposPageFetch, calls } = await load([
      {
        redirect: true,
        url: '/articles',
        status: 302
      },
      {
        template: 'article-page:index',
        currentPage: 2
      }
    ]);
    const data = await aposPageFetch(
      new Request('http://localhost:4321/articles/?page=2')
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[1], 'http://localhost:4321/articles?page=2');
    assert.equal(data.currentPage, 2);
    assert.ok(!data.redirect);
  });

  it('still follows a slash-adding locale home redirect internally', async () => {
    const { aposPageFetch, calls } = await load([
      {
        redirect: true,
        url: '/fr/',
        status: 302
      },
      {
        template: '@apostrophecms/home-page:page'
      }
    ]);
    const data = await aposPageFetch(new Request('http://localhost:4321/fr'));
    assert.equal(calls.length, 2);
    assert.equal(calls[1], 'http://localhost:4321/fr/');
    assert.ok(!data.redirect);
  });

  it('prefers the redirect target\'s own query string over the request\'s', async () => {
    const { aposPageFetch, calls } = await load([
      {
        redirect: true,
        url: '/articles?category=tech',
        status: 302
      },
      {
        template: 'article-page:index'
      }
    ]);
    await aposPageFetch(
      new Request('http://localhost:4321/articles/?page=2')
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[1], 'http://localhost:4321/articles?category=tech');
  });

  it('passes through a redirect to a different path without retrying', async () => {
    const { aposPageFetch, calls } = await load([
      {
        redirect: true,
        url: '/new-location',
        status: 301
      }
    ]);
    const data = await aposPageFetch(new Request('http://localhost:4321/old-location'));
    assert.equal(calls.length, 1);
    assert.equal(data.redirect, true);
    assert.equal(data.url, '/new-location');
    assert.equal(data.status, 301);
  });

  it('passes through an absolute redirect to another host even when paths match', async () => {
    const { aposPageFetch, calls } = await load([
      {
        redirect: true,
        url: 'https://other.example.com/articles',
        status: 302
      }
    ]);
    const data = await aposPageFetch(new Request('http://localhost:4321/articles/'));
    assert.equal(calls.length, 1);
    assert.equal(data.redirect, true);
    assert.equal(data.url, 'https://other.example.com/articles');
  });

  it('strips and restores the prefix around the internal retry', async () => {
    const { aposPageFetch, calls } = await load([
      {
        redirect: true,
        url: '/articles',
        status: 302
      },
      {
        template: 'article-page:index'
      }
    ], { aposPrefix: '/base' });
    await aposPageFetch(
      new Request('http://localhost:4321/base/articles/?page=2')
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[1], 'http://localhost:4321/base/articles?page=2');
  });

  it('reports an infinite redirect instead of looping', async () => {
    const { aposPageFetch, calls } = await load([
      {
        redirect: true,
        url: '/articles',
        status: 302
      },
      {
        redirect: true,
        url: '/articles',
        status: 302
      }
    ]);
    const data = await aposPageFetch(new Request('http://localhost:4321/articles/'));
    assert.equal(calls.length, 2);
    assert.ok(data.errorFetchingPage);
    assert.match(data.errorFetchingPage.message, /Infinite redirect/);
    assert.equal(data.page.type, 'apos-fetch-error');
  });

  it('never retries a redirect to the site root', async () => {
    const { aposPageFetch, calls } = await load([
      {
        redirect: true,
        url: '/',
        status: 302
      }
    ]);
    const data = await aposPageFetch(new Request('http://localhost:4321//'));
    assert.equal(calls.length, 1);
    assert.equal(data.redirect, true);
  });
});
