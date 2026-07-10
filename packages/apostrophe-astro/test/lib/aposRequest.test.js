import assert from 'node:assert/strict';
import esmock from 'esmock';

const mockConfig = {
  aposHost: 'http://localhost:3000',
  aposPrefix: '',
  staticBuild: null
};

async function loadAposRequest(configOverrides = {}, env = {}) {
  const savedEnv = {};
  for (const [ key, value ] of Object.entries(env)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    const mod = await esmock('../../lib/aposRequest.js', {
      'apostrophe-astro-config/config': {
        default: { ...mockConfig, ...configOverrides }
      }
    });
    return mod;
  } finally {
    for (const [ key, value ] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe('aposRequest', () => {
  const key = 'test-secret-key';

  beforeEach(() => {
    process.env.APOS_EXTERNAL_FRONT_KEY = key;
  });

  afterEach(() => {
    delete process.env.APOS_EXTERNAL_FRONT_KEY;
    delete process.env.APOS_ASTRO_STATIC_BUILD;
  });

  it('throws when APOS_EXTERNAL_FRONT_KEY is not set', async () => {
    delete process.env.APOS_EXTERNAL_FRONT_KEY;
    const { default: aposRequest } = await loadAposRequest();
    assert.throws(
      () => aposRequest(new Request('http://localhost:4321/page')),
      /APOS_EXTERNAL_FRONT_KEY/
    );
  });

  it('sets required auth headers in SSR mode', async () => {
    const { default: aposRequest } = await loadAposRequest();
    const req = new Request('http://localhost:4321/page', {
      headers: { cookie: 'session=abc' }
    });
    const result = aposRequest(req);
    assert.equal(result.headers.get('x-requested-with'), 'AposExternalFront');
    assert.equal(result.headers.get('apos-external-front-key'), key);
  });

  it('forwards user headers in SSR mode', async () => {
    const { default: aposRequest } = await loadAposRequest();
    const req = new Request('http://localhost:4321/page', {
      headers: { cookie: 'session=abc', 'accept-language': 'fr' }
    });
    const result = aposRequest(req);
    assert.equal(result.headers.get('cookie'), 'session=abc');
    assert.equal(result.headers.get('accept-language'), 'fr');
  });

  it('uses URL only in static build mode (env var)', async () => {
    process.env.APOS_ASTRO_STATIC_BUILD = '1';
    const { default: aposRequest } = await loadAposRequest();
    const req = new Request('http://localhost:4321/page', {
      headers: { cookie: 'session=abc' }
    });
    const result = aposRequest(req);
    // Should not forward the user cookie
    assert.equal(result.headers.get('cookie'), null);
    // Should set static base URL header
    assert.equal(result.headers.get('x-apos-static-base-url'), '1');
  });

  it('uses URL only in static build mode (config)', async () => {
    const { default: aposRequest } = await loadAposRequest({ staticBuild: { attachments: true } });
    const req = new Request('http://localhost:4321/page', {
      headers: { cookie: 'session=abc' }
    });
    const result = aposRequest(req);
    assert.equal(result.headers.get('cookie'), null);
    assert.equal(result.headers.get('x-apos-static-base-url'), '1');
  });

  it('detects prerendered Astro request by own header getter', async () => {
    const { isAstroPrerenderedRequest } = await loadAposRequest();
    const fakeReq = {};
    Object.defineProperty(fakeReq, 'headers', { get: () => new Headers(), configurable: true });
    assert.equal(isAstroPrerenderedRequest(fakeReq), true);
  });

  it('returns false for a plain Request object', async () => {
    const { isAstroPrerenderedRequest } = await loadAposRequest();
    const req = new Request('http://localhost/');
    assert.equal(isAstroPrerenderedRequest(req), false);
  });

  it('returns false for a string', async () => {
    const { isAstroPrerenderedRequest } = await loadAposRequest();
    assert.equal(isAstroPrerenderedRequest('http://localhost/'), false);
  });
});
