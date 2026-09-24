const assert = require('node:assert/strict');
const http = require('node:http');
const t = require('apostrophe/test-lib/test');
const sharp = require('sharp');

describe('AI helper images', function() {
  let apos;
  let png;
  let originalFetch;
  let originalMock;
  // URLs of AI helper images requested by the server via the global fetch.
  // Other requests to the test server itself go through (apos.http uses
  // fetch too)
  let fetched;
  const jars = {};

  this.timeout(t.timeout);

  before(async function() {
    originalMock = process.env.APOS_AI_HELPER_MOCK;
    delete process.env.APOS_AI_HELPER_MOCK;
    png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: 'red'
      }
    }).png().toBuffer();

    apos = await t.create({
      root: module,
      testModule: true,
      modules: {
        '@apostrophecms/ai-helper': {
          options: {
            imageProviderOptions: {
              apiKey: 'not-a-real-key'
            },
            textProviderOptions: {
              apiKey: 'not-a-real-key'
            }
          }
        }
      }
    });

    // Never talk to a real AI provider
    const aiHelper = apos.modules['@apostrophecms/ai-helper'];
    aiHelper.generateImage = async () => [ {
      type: 'base64',
      data: png.toString('base64')
    } ];
    aiHelper.generateImageVariation = async () => [ {
      type: 'base64',
      data: png.toString('base64')
    } ];

    // Record anything the server fetches from elsewhere, and never
    // reach the network for it
    originalFetch = globalThis.fetch;
    const own = new URL(apos.http.getBase()).host;
    globalThis.fetch = async (url, options) => {
      const target = new URL(url instanceof Request ? url.url : url);
      if (target.pathname.includes('/ai-helper-images/')) {
        fetched.push(target.href);
      }
      if (target.host === own) {
        return originalFetch(url, options);
      }
      return new Response(png, {
        headers: { 'content-type': 'image/png' }
      });
    };

    for (const [ username, role ] of [
      [ 'editor', 'editor' ],
      [ 'otherEditor', 'editor' ],
      [ 'guest', 'guest' ]
    ]) {
      await t.createUser(apos, role, { username });
      jars[username] = await t.loginAs(apos, username);
      // Pick up the CSRF cookie
      await apos.http.get('/', { jar: jars[username] });
    }
  });

  after(async function() {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
    if (originalMock !== undefined) {
      process.env.APOS_AI_HELPER_MOCK = originalMock;
    }
    await t.destroy(apos);
  });

  beforeEach(function() {
    fetched = [];
  });

  async function generate(username) {
    const { images } = await apos.http.post('/api/v1/@apostrophecms/image/ai-helper', {
      jar: jars[username],
      body: { prompt: 'A red square' }
    });
    assert.equal(images.length, 1);
    return images[0];
  }

  // apos.http uses fetch, which cannot set the Host header,
  // so make these requests with node:http directly
  function request(method, path, {
    username, host, body
  }) {
    const base = new URL(apos.http.getBase());
    const data = body ? JSON.stringify(body) : '';
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: base.hostname.replace(/^\[(.*)\]$/, '$1'),
        port: base.port,
        path,
        method,
        headers: {
          Host: host || base.host,
          Cookie: jars[username].getCookieStringSync(base.href),
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          text += chunk;
        });
        res.on('end', () => {
          let parsed = text;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            // Not JSON
          }
          resolve({
            status: res.statusCode,
            body: parsed
          });
        });
      });
      req.on('error', reject);
      req.end(data);
    });
  }

  function accept(_id, options) {
    return request('PATCH', `/api/v1/@apostrophecms/image/ai-helper/${_id}`, {
      ...options,
      body: { accepted: true }
    });
  }

  it('should accept a generated image without fetching from the Host header origin', async function() {
    const image = await generate('editor');
    const response = await accept(image._id, {
      username: 'editor',
      host: 'attacker.invalid:9999'
    });
    assert.deepEqual(fetched, []);
    assert.equal(response.status, 200);
    assert(response.body.imageId);
    const piece = await apos.image.find(apos.task.getReq({ mode: 'draft' }), {
      _id: response.body._id
    }).toObject();
    assert(piece);
    assert.equal(piece.title, 'A red square');
    assert(piece.attachment);
  });

  it('should not let one user accept an image generated by another user', async function() {
    const image = await generate('editor');
    const response = await accept(image._id, { username: 'otherEditor' });
    assert.equal(response.status, 404);
    assert.deepEqual(fetched, []);
  });

  it('should not let a user who cannot edit anything accept an image', async function() {
    const image = await generate('editor');
    const response = await accept(image._id, { username: 'guest' });
    assert.equal(response.status, 403);
    assert.deepEqual(fetched, []);
  });

  it('should not let one user create a variation of an image generated by another user', async function() {
    const image = await generate('editor');
    const response = await request('POST', '/api/v1/@apostrophecms/image/ai-helper', {
      username: 'otherEditor',
      body: {
        prompt: 'A blue square',
        variantOf: image._id
      }
    });
    assert.equal(response.status, 404);
  });

  it('should not let a user who cannot edit anything list or delete images', async function() {
    const image = await generate('editor');
    const list = await request('GET', '/api/v1/@apostrophecms/image/ai-helper', {
      username: 'guest'
    });
    assert.equal(list.status, 403);
    const removed = await request('DELETE', `/api/v1/@apostrophecms/image/ai-helper/${image._id}`, {
      username: 'guest'
    });
    assert.equal(removed.status, 403);
  });

  it('should still list and delete images for their owner', async function() {
    const image = await generate('editor');
    const list = await request('GET', '/api/v1/@apostrophecms/image/ai-helper', {
      username: 'editor'
    });
    assert.equal(list.status, 200);
    assert(list.body.images.some(({ _id }) => _id === image._id));
    // Someone else's delete is a no-op
    await request('DELETE', `/api/v1/@apostrophecms/image/ai-helper/${image._id}`, {
      username: 'otherEditor'
    });
    assert(await apos.image.aiHelperImages.findOne({ _id: image._id }));
    const removed = await request('DELETE', `/api/v1/@apostrophecms/image/ai-helper/${image._id}`, {
      username: 'editor'
    });
    assert.equal(removed.status, 200);
    assert.equal(await apos.image.aiHelperImages.findOne({ _id: image._id }), null);
  });
});
