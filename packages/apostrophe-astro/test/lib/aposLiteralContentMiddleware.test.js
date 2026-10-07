import assert from 'node:assert/strict';
import esmock from 'esmock';

const mockConfig = {
  aposHost: 'http://localhost:3000',
  aposPrefix: '',
  staticBuild: null,
  excludeRequestHeaders: []
};

function manifest(patterns, scope) {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: {
      json: async () => ({ patterns, scope }),
      dump: async () => {}
    }
  };
}

function textResponse(statusCode, text = 'not found') {
  return {
    statusCode,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: {
      json: async () => JSON.parse(text),
      dump: async () => {}
    }
  };
}

function jsonNotFound() {
  return {
    statusCode: 404,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: {
      json: async () => ({ name: 'notfound' }),
      dump: async () => {}
    }
  };
}

// Loads a fresh middleware (module state included). `respond(host, url)`
// answers each manifest request; `calls` records the Host of every one,
// `proxied` the URL of every request handed to aposResponse.
async function load(respond, configOverrides = {}) {
  const calls = [];
  const proxied = [];
  const errors = [];
  const mod = await esmock('../../lib/aposLiteralContentMiddleware.js', {
    'astro:middleware': { defineMiddleware: (fn) => fn },
    'apostrophe-astro-config/config': {
      default: { ...mockConfig, ...configOverrides }
    },
    undici: {
      request: async (url, { headers }) => {
        calls.push(headers.host);
        return respond(headers.host, url);
      }
    },
    '../../lib/aposResponse.js': {
      default: async (request) => {
        proxied.push(request.url);
        return new Response('proxied');
      }
    },
    '../../lib/log.js': {
      logError: (...args) => errors.push(args.join(' '))
    }
  }, {}, { isModuleNotFoundError: false });
  return {
    onRequest: mod.onRequest,
    calls,
    proxied,
    errors
  };
}

// Runs one request through the middleware. Resolves to 'next' when the
// request is left to the page renderer, or to the proxied body.
async function run(onRequest, url, host = new URL(url).host) {
  const request = new Request(url, { headers: host ? { host } : {} });
  const result = await onRequest({
    request,
    url: new URL(url)
  }, async () => 'next');
  return typeof result === 'string' ? result : result.text();
}

describe('aposLiteralContentMiddleware', () => {
  let realNow;

  beforeEach(() => {
    realNow = Date.now;
  });

  afterEach(() => {
    Date.now = realNow;
  });

  describe('global scope', () => {
    it('proxies a matching path and leaves others to the page renderer', async () => {
      const { onRequest, proxied } = await load(() => manifest([ '/robots.txt', '/sitemaps/*' ], 'global'));
      assert.equal(await run(onRequest, 'http://a.test/robots.txt'), 'proxied');
      assert.equal(await run(onRequest, 'http://a.test/sitemaps/en.xml'), 'proxied');
      assert.equal(await run(onRequest, 'http://a.test/about'), 'next');
      assert.deepEqual(proxied, [
        'http://a.test/robots.txt',
        'http://a.test/sitemaps/en.xml'
      ]);
    });

    it('fetches the manifest once for every host', async () => {
      const { onRequest, calls } = await load(() => manifest([ '/robots.txt' ], 'global'));
      assert.equal(await run(onRequest, 'http://a.test/robots.txt'), 'proxied');
      assert.equal(await run(onRequest, 'http://b.test/robots.txt'), 'proxied');
      assert.equal(await run(onRequest, 'http://c.test/robots.txt'), 'proxied');
      assert.deepEqual(calls, [ 'a.test' ]);
    });

    it('treats a manifest without scope (older backend) as global', async () => {
      const { onRequest, calls } = await load(() => manifest([ '/robots.txt' ]));
      await run(onRequest, 'http://a.test/robots.txt');
      assert.equal(await run(onRequest, 'http://b.test/robots.txt'), 'proxied');
      assert.deepEqual(calls, [ 'a.test' ]);
    });

    it('strips aposPrefix before matching', async () => {
      const { onRequest } = await load(
        () => manifest([ '/robots.txt' ], 'global'),
        { aposPrefix: '/prefix' }
      );
      assert.equal(await run(onRequest, 'http://a.test/prefix/robots.txt'), 'proxied');
    });
  });

  describe('host scope', () => {
    const sites = {
      'alpha.test': [ '/robots.txt', '/llms.txt' ],
      'beta.test': [ '/robots.txt' ]
    };

    function multisite(host) {
      return sites[host] ? manifest(sites[host], 'host') : textResponse(404);
    }

    it('forwards Host and routes each host by its own manifest', async () => {
      const { onRequest, calls } = await load(multisite);
      assert.equal(await run(onRequest, 'http://alpha.test/llms.txt'), 'proxied');
      assert.equal(await run(onRequest, 'http://beta.test/llms.txt'), 'next');
      assert.equal(await run(onRequest, 'http://beta.test/robots.txt'), 'proxied');
      assert.equal(await run(onRequest, 'http://alpha.test/robots.txt'), 'proxied');
      assert.deepEqual(calls, [ 'alpha.test', 'beta.test' ]);
    });

    it('fetches once for concurrent requests to the same host', async () => {
      const { onRequest, calls } = await load(multisite);
      const results = await Promise.all([
        run(onRequest, 'http://alpha.test/robots.txt'),
        run(onRequest, 'http://alpha.test/llms.txt'),
        run(onRequest, 'http://alpha.test/about')
      ]);
      assert.deepEqual(results, [ 'proxied', 'proxied', 'next' ]);
      assert.deepEqual(calls, [ 'alpha.test' ]);
    });

    it('evicts the least recently used host past 100 hosts', async () => {
      const { onRequest, calls } = await load(() => manifest([ '/robots.txt' ], 'host'));
      for (let i = 0; i < 100; i++) {
        await run(onRequest, `http://site${i}.test/robots.txt`);
      }
      // Touch site0, so site1 is now the least recently used.
      await run(onRequest, 'http://site0.test/robots.txt');
      await run(onRequest, 'http://site100.test/robots.txt');
      calls.length = 0;
      await run(onRequest, 'http://site0.test/robots.txt');
      await run(onRequest, 'http://site1.test/robots.txt');
      assert.deepEqual(calls, [ 'site1.test' ]);
    });

    it('skips an unknown host for 30 seconds without disabling the feature', async () => {
      let now = 1000;
      Date.now = () => now;
      const { onRequest, calls, errors } = await load(multisite);
      for (let i = 0; i < 6; i++) {
        assert.equal(await run(onRequest, 'http://unknown.test/robots.txt'), 'next');
      }
      assert.deepEqual(calls, [ 'unknown.test' ]);
      assert.equal(errors.length, 1);

      now += 30 * 1000;
      await run(onRequest, 'http://unknown.test/robots.txt');
      assert.deepEqual(calls, [ 'unknown.test', 'unknown.test' ]);

      // Known sites keep working: an orphan 404 is not "endpoint missing".
      assert.equal(await run(onRequest, 'http://alpha.test/robots.txt'), 'proxied');
    });

    it('treats any non-JSON answer as an unknown host', async () => {
      const { onRequest, calls } = await load(() => textResponse(200, 'Site not found'));
      await run(onRequest, 'http://unknown.test/robots.txt');
      await run(onRequest, 'http://unknown.test/robots.txt');
      assert.deepEqual(calls, [ 'unknown.test' ]);
    });
  });

  describe('failures', () => {
    it('retries on the next request when the backend is unreachable', async () => {
      let up = false;
      const { onRequest, calls, errors } = await load(() => {
        if (!up) {
          throw new Error('connect ECONNREFUSED');
        }
        return manifest([ '/robots.txt' ], 'global');
      });
      assert.equal(await run(onRequest, 'http://a.test/robots.txt'), 'next');
      assert.equal(errors.length, 1);
      up = true;
      assert.equal(await run(onRequest, 'http://a.test/robots.txt'), 'proxied');
      assert.deepEqual(calls, [ 'a.test', 'a.test' ]);
    });

    it('retries on the next request after a JSON error status', async () => {
      let status = 500;
      const { onRequest, calls } = await load(() => (status === 500
        ? {
          ...jsonNotFound(),
          statusCode: 500
        }
        : manifest([ '/robots.txt' ], 'global')));
      assert.equal(await run(onRequest, 'http://a.test/robots.txt'), 'next');
      status = 200;
      assert.equal(await run(onRequest, 'http://a.test/robots.txt'), 'proxied');
      assert.equal(calls.length, 2);
    });

    it('disables itself after 5 consecutive JSON 404s', async () => {
      const { onRequest, calls, errors } = await load(jsonNotFound);
      for (let i = 0; i < 7; i++) {
        assert.equal(await run(onRequest, `http://site${i}.test/robots.txt`), 'next');
      }
      assert.equal(calls.length, 5);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /disabling/);
    });

    it('does not disable itself when another failure breaks the 404 streak', async () => {
      let count = 0;
      const { onRequest, calls } = await load(() => {
        count++;
        return count === 3 ? textResponse(502, 'Bad Gateway') : jsonNotFound();
      });
      for (let i = 0; i < 7; i++) {
        await run(onRequest, `http://site${i}.test/robots.txt`);
      }
      assert.equal(calls.length, 7);
    });
  });

  describe('Host handling', () => {
    it('never sends a Host containing a slash to the backend', async () => {
      const { onRequest, calls } = await load(() => manifest([ '/robots.txt' ], 'host'));
      assert.equal(await run(onRequest, 'http://a.test/robots.txt', 'evil.test/path'), 'next');
      assert.deepEqual(calls, []);
    });

    it('sends no Host and shares one entry when Host is excluded', async () => {
      const { onRequest, calls } = await load(
        () => manifest([ '/robots.txt' ], 'host'),
        { excludeRequestHeaders: [ 'Host' ] }
      );
      assert.equal(await run(onRequest, 'http://a.test/robots.txt'), 'proxied');
      assert.equal(await run(onRequest, 'http://b.test/robots.txt'), 'proxied');
      assert.deepEqual(calls, [ undefined ]);
    });

    it('treats Host case-insensitively', async () => {
      const { onRequest, calls } = await load(() => manifest([ '/robots.txt' ], 'host'));
      await run(onRequest, 'http://a.test/robots.txt', 'A.test');
      await run(onRequest, 'http://a.test/robots.txt', 'a.TEST');
      assert.equal(calls.length, 1);
    });
  });
});
