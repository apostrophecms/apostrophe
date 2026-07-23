const t = require('../test-lib/test.js');
const assert = require('assert/strict');

// The standard image models' declared aspect sets — what the core's
// nearest-match resolves against
const GPT_IMAGE_1 = [ '1:1', '3:2', '2:3' ];
const GPT_IMAGE_2 = [ '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16' ];
const GOOGLE = [
  '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
];

describe('AI image dials', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module
    });
  });

  after(async function() {
    await t.destroy(apos);
  });

  describe('aspectRatio', function() {
    const valid = [
      [ 'square', 1 ],
      [ 'portrait', 3 / 4 ],
      [ 'landscape', 4 / 3 ],
      [ '1:1', 1 ],
      [ '16:9', 16 / 9 ],
      [ '2:3', 2 / 3 ],
      [ '1.91:1', 1.91 ]
    ];
    for (const [ aspect, ratio ] of valid) {
      it(`parses "${aspect}"`, function() {
        assert.equal(apos.ai.aspectRatio(aspect), ratio);
      });
    }

    const invalid = [ 'wide', '', '16x9', '16:', ':9', '0:1', '1:0', '-1:2', '16:9:1' ];
    for (const aspect of invalid) {
      it(`rejects ${JSON.stringify(aspect)}`, function() {
        assert.throws(() => apos.ai.aspectRatio(aspect), (e) => e.name === 'invalid');
      });
    }
  });

  describe('resolveAspect nearest-match', function() {
    // [ requested, declared aspects, resolved native aspect ]
    const cases = [
      // named tokens against each standard model's set
      [ 'square', GPT_IMAGE_1, '1:1' ],
      [ 'portrait', GPT_IMAGE_1, '2:3' ],
      [ 'landscape', GPT_IMAGE_1, '3:2' ],
      [ 'square', GPT_IMAGE_2, '1:1' ],
      [ 'portrait', GPT_IMAGE_2, '3:4' ],
      [ 'landscape', GPT_IMAGE_2, '4:3' ],
      [ 'square', GOOGLE, '1:1' ],
      [ 'portrait', GOOGLE, '3:4' ],
      [ 'landscape', GOOGLE, '4:3' ],
      // explicit W:H — exact when declared, nearest otherwise
      [ '1:1', GPT_IMAGE_1, '1:1' ],
      [ '1:1', GOOGLE, '1:1' ],
      [ '16:9', GPT_IMAGE_1, '3:2' ],
      [ '16:9', GPT_IMAGE_2, '16:9' ],
      [ '16:9', GOOGLE, '16:9' ],
      [ '9:16', GPT_IMAGE_1, '2:3' ],
      [ '9:16', GOOGLE, '9:16' ],
      [ '3:2', GPT_IMAGE_1, '3:2' ],
      [ '3:2', GOOGLE, '3:2' ],
      [ '2:1', GPT_IMAGE_1, '3:2' ],
      [ '2:1', GPT_IMAGE_2, '16:9' ],
      [ '2:1', GOOGLE, '16:9' ],
      [ '2.39:1', GOOGLE, '21:9' ],
      // reciprocal tie → the larger ratio wins
      [ '1:1', [ '3:2', '2:3' ], '3:2' ],
      // larger beats declaration order (2:3 declared first, 3:2 still wins)
      [ '1:1', [ '2:3', '3:2' ], '3:2' ],
      // exact duplicate ratios → declaration order (the first wins)
      [ 'square', [ '1:1', '1:1' ], '1:1' ]
    ];
    for (const [ requested, declared, resolved ] of cases) {
      it(`${requested} in [${declared.join(', ')}] → ${resolved}`, function() {
        assert.equal(apos.ai.resolveAspect(requested, declared), resolved);
      });
    }

    it('an omitted dial resolves to undefined', function() {
      assert.equal(apos.ai.resolveAspect(undefined, GPT_IMAGE_1), undefined);
    });

    it('a model with no declared aspects passes the canonical ratio through', function() {
      // an explicit ratio unchanged, a named token as its canonical 'W:H'
      // — never a named token an adapter would have to decode
      assert.equal(apos.ai.resolveAspect('16:9', undefined), '16:9');
      assert.equal(apos.ai.resolveAspect('portrait', []), '3:4');
      assert.equal(apos.ai.resolveAspect('square', []), '1:1');
    });
  });

  describe('normalizeImageOptions', function() {
    it('defaults count to 1 and leaves unset dials undefined', function() {
      assert.deepEqual(apos.ai.normalizeImageOptions('a watercolor fox'), {
        prompt: 'a watercolor fox',
        count: 1,
        aspect: undefined,
        quality: undefined,
        images: undefined,
        provider: undefined,
        model: undefined,
        signal: undefined
      });
    });

    it('carries the full dial set', function() {
      const result = apos.ai.normalizeImageOptions('a watercolor fox', {
        count: 2,
        aspect: '16:9',
        quality: 'high'
      });
      assert.equal(result.count, 2);
      assert.equal(result.aspect, '16:9');
      assert.equal(result.quality, 'high');
    });

    it('normalizes url and inline image sources for an edit', function() {
      const result = apos.ai.normalizeImageOptions('make the fox wear a red scarf', {
        images: [
          { url: 'https://example.com/fox.png' },
          {
            data: 'aGVsbG8=',
            mediaType: 'image/png',
            extra: 'stripped'
          }
        ]
      });
      assert.deepEqual(result.images, [
        { url: 'https://example.com/fox.png' },
        {
          data: 'aGVsbG8=',
          mediaType: 'image/png'
        }
      ]);
    });

    it('accepts provider and model together', function() {
      const result = apos.ai.normalizeImageOptions('a fox', {
        provider: 'openai',
        model: 'gpt-image-1'
      });
      assert.equal(result.provider, 'openai');
      assert.equal(result.model, 'gpt-image-1');
    });

    it('carries an AbortSignal', function() {
      const { signal } = new AbortController();
      const result = apos.ai.normalizeImageOptions('a fox', { signal });
      assert.equal(result.signal, signal);
    });

    const rejects = [
      [ 'an empty prompt', '', {} ],
      [ 'a non-string prompt', 42, {} ],
      [ 'a non-object options argument', 'a fox', 42 ],
      [ 'an unknown option', 'a fox', { size: '1024x1024' } ],
      [ 'a non-integer count', 'a fox', { count: 1.5 } ],
      [ 'a zero count', 'a fox', { count: 0 } ],
      [ 'a malformed aspect', 'a fox', { aspect: 'wide' } ],
      [ 'an unknown quality', 'a fox', { quality: 'ultra' } ],
      [ 'an empty images array', 'a fox', { images: [] } ],
      [ 'a malformed image source', 'a fox', { images: [ { path: 'x' } ] } ],
      [ 'a non-http(s) source url', 'a fox', { images: [ { url: 'file:///etc/passwd' } ] } ],
      [ 'a data: source url', 'a fox', { images: [ { url: 'data:image/png;base64,aGk=' } ] } ],
      [ 'a relative source url', 'a fox', { images: [ { url: '/uploads/fox.png' } ] } ],
      [ 'provider without model', 'a fox', { provider: 'openai' } ],
      [ 'model without provider', 'a fox', { model: 'gpt-image-1' } ],
      [ 'a non-AbortSignal signal', 'a fox', { signal: {} } ]
    ];
    for (const [ label, prompt, options ] of rejects) {
      it(`rejects ${label}`, function() {
        assert.throws(
          () => apos.ai.normalizeImageOptions(prompt, options),
          (e) => e.name === 'invalid'
        );
      });
    }
  });

  describe('generateImage without configuration', function() {
    it('fails when no "image" route is configured', async function() {
      await assert.rejects(
        apos.ai.generateImage(apos.task.getReq(), 'a fox'),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /no "image" route is configured/);
          return true;
        }
      );
    });
  });

  describe('generateImage pipeline', function() {
    // Scripted thunks consumed by the fake adapter's image method, one
    // per adapter call, receiving the adapter request
    let imageScript;
    let imageCalls;
    let events;

    // A text-only provider, for capability rejections
    const textAdapter = () => ({
      name: 'fake',
      label: 'Fake',
      capabilities: {
        text: true,
        tools: true,
        structured: true,
        imageInput: true,
        image: false,
        caching: true
      },
      effort: {
        medium: { model: 'fake-medium' }
      },
      models: {
        'fake-medium': {
          contextWindow: 100000,
          maxOutputTokens: 8000
        }
      },
      validate() {},
      normalizeError: (error) => error
    });
    // The image-capable provider under test, its image method driven
    // by the suite's script
    const imageAdapter = () => ({
      name: 'fakeimg',
      label: 'Fake Image',
      capabilities: {
        text: false,
        tools: false,
        structured: false,
        imageInput: false,
        image: true,
        caching: false
      },
      effort: {},
      models: {
        'fake-image': { aspects: [ '1:1', '3:2', '2:3' ] }
      },
      validate() {},
      async image(req, request) {
        imageCalls.push(request);
        const step = imageScript.shift();
        if (step === undefined) {
          throw new Error('image called beyond its script');
        }
        return step(request);
      },
      normalizeError: (error) => error
    });
    const imageResult = (extras = {}) => ({
      images: [ {
        type: 'png',
        data: 'aW1n'
      } ],
      model: 'fake-image-9000',
      usage: {
        inputTokens: 9,
        outputTokens: 1000
      },
      size: '1024x1024',
      ...extras
    });

    before(async function() {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        modules: {
          'fake-adapters': {
            init(self) {
              self.apos.ai.addAdapter(textAdapter());
              self.apos.ai.addAdapter(imageAdapter());
            }
          },
          'event-watch': {
            handlers(self) {
              return {
                '@apostrophecms/ai:beforeGenerateImage': {
                  record(req, context) {
                    events.push([ 'before', context ]);
                  }
                },
                '@apostrophecms/ai:afterGenerateImage': {
                  record(req, context) {
                    events.push([ 'after', context ]);
                  }
                }
              };
            }
          },
          '@apostrophecms/ai': {
            options: {
              provider: 'fake',
              providers: {
                fake: { apiKey: 'k1' },
                fakeimg: { apiKey: 'k2' }
              },
              image: {
                provider: 'fakeimg',
                model: 'fake-image',
                aspect: 'landscape',
                quality: 'medium'
              },
              // Keep retried tests fast
              retryBaseDelay: 1
            }
          }
        }
      });
    });

    beforeEach(function() {
      imageScript = [];
      imageCalls = [];
      events = [];
    });

    it('routes via the image entry, resolving its default dials', async function() {
      imageScript = [ () => imageResult() ];
      const result = await apos.ai.generateImage(
        apos.task.getReq(),
        'a watercolor fox'
      );
      // The entry's 'landscape' resolved against the declared aspects
      assert.deepEqual(imageCalls, [ {
        prompt: 'a watercolor fox',
        count: 1,
        aspect: '3:2',
        quality: 'medium',
        model: 'fake-image'
      } ]);
      assert.deepEqual(result, {
        images: [ {
          type: 'png',
          data: 'aW1n'
        } ],
        provider: 'fakeimg',
        model: 'fake-image-9000',
        usage: {
          inputTokens: 9,
          outputTokens: 1000
        },
        aspect: '3:2',
        size: '1024x1024'
      });
    });

    it('lets call dials override the entry defaults', async function() {
      imageScript = [ () => imageResult() ];
      await apos.ai.generateImage(apos.task.getReq(), 'a fox', {
        aspect: '9:16',
        quality: 'high'
      });
      assert.equal(imageCalls[0].aspect, '2:3');
      assert.equal(imageCalls[0].quality, 'high');
    });

    it('says the call-level facts once, however many images arrive', async function() {
      const adapterUsage = {
        inputTokens: 9,
        outputTokens: 2000
      };
      imageScript = [ () => imageResult({
        images: [
          {
            type: 'png',
            data: 'aW1n'
          },
          {
            type: 'png',
            data: 'aW1nMg=='
          }
        ],
        usage: adapterUsage
      }) ];
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox', {
        count: 2
      });
      assert.equal(imageCalls[0].count, 2);
      assert.equal(result.images.length, 2);
      assert.deepEqual(result.usage, adapterUsage);
      // A fresh copy, not the adapter's own object
      assert.notEqual(result.usage, adapterUsage);
    });

    it('passes edit sources through to the adapter', async function() {
      imageScript = [ () => imageResult() ];
      await apos.ai.generateImage(
        apos.task.getReq(),
        'make the fox wear a red scarf',
        {
          images: [ {
            data: 'aGk=',
            mediaType: 'image/png'
          } ]
        }
      );
      assert.deepEqual(imageCalls[0].images, [ {
        data: 'aGk=',
        mediaType: 'image/png'
      } ]);
    });

    it('omits envelope facts the adapter did not report', async function() {
      imageScript = [ () => ({
        images: [ {
          type: 'png',
          data: 'aW1n'
        } ]
      }) ];
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox', {
        provider: 'fakeimg',
        model: 'mystery-image'
      });
      // No adapter model, usage or size; no dial sent, so no aspect
      assert.deepEqual(result, {
        images: [ {
          type: 'png',
          data: 'aW1n'
        } ],
        provider: 'fakeimg',
        model: 'mystery-image'
      });
    });

    it('bypasses the entry and its dials on an explicit provider and model', async function() {
      imageScript = [ () => imageResult() ];
      await apos.ai.generateImage(apos.task.getReq(), 'a fox', {
        provider: 'fakeimg',
        model: 'mystery-image',
        aspect: 'portrait'
      });
      const [ request ] = imageCalls;
      assert.equal(request.model, 'mystery-image');
      // The unknown model has no declared aspects: the canonical
      // ratio passes through; the entry's quality does not apply
      assert.equal(request.aspect, '3:4');
      assert.equal('quality' in request, false);
    });

    it('rejects routing to a provider without the image capability', async function() {
      await assert.rejects(
        apos.ai.generateImage(apos.task.getReq(), 'a fox', {
          provider: 'fake',
          model: 'fake-medium'
        }),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /does not declare the "image" capability/);
          return true;
        }
      );
      assert.equal(imageCalls.length, 0);
    });

    it('retries a transient failure and delivers', async function() {
      imageScript = [
        () => {
          throw apos.error('aiRetry', 'blip');
        },
        () => imageResult()
      ];
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox');
      assert.equal(imageCalls.length, 2);
      assert.equal(result.images.length, 1);
    });

    it('retries a malformed result the same way', async function() {
      imageScript = [
        () => ({ images: [] }),
        () => imageResult()
      ];
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox');
      assert.equal(imageCalls.length, 2);
      assert.equal(result.images.length, 1);
    });

    it('stops at once on a non-retryable code', async function() {
      imageScript = [ () => {
        throw apos.error('invalid', 'bad request');
      } ];
      await assert.rejects(
        apos.ai.generateImage(apos.task.getReq(), 'a fox'),
        (e) => e.name === 'invalid'
      );
      assert.equal(imageCalls.length, 1);
    });

    it('surfaces a refusal without a retry', async function() {
      imageScript = [ () => {
        throw apos.error('aiRefusal', 'the model blocked this request');
      } ];
      await assert.rejects(
        apos.ai.generateImage(apos.task.getReq(), 'a fox'),
        (e) => e.name === 'aiRefusal'
      );
      assert.equal(imageCalls.length, 1);
    });

    it('emits the generate-image events around the call, sharing one context', async function() {
      imageScript = [ () => imageResult() ];
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox');
      assert.deepEqual(events.map((event) => event[0]), [ 'before', 'after' ]);
      assert.equal(events[0][1], events[1][1]);
      assert.equal(events[0][1].provider, 'fakeimg');
      assert.equal(events[0][1].request.prompt, 'a fox');
      assert.equal(events[1][1].result, result);
    });
  });

  describe('generateImage under APOS_AI_MOCK', function() {
    before(async function() {
      await t.destroy(apos);
      process.env.APOS_AI_MOCK = '1';
      // No providers, no keys: placeholder routing stands in
      apos = await t.create({
        root: module
      });
    });

    after(function() {
      delete process.env.APOS_AI_MOCK;
    });

    it('returns placeholder images in the standard shape, no network', async function() {
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox', {
        count: 2,
        aspect: 'square'
      });
      assert.equal(result.images.length, 2);
      for (const image of result.images) {
        assert.equal(image.type, 'png');
        assert(image.data.length > 0);
      }
      assert.equal(result.provider, 'mock');
      assert.equal(result.model, 'mock');
      // No declared aspects to resolve against: the canonical ratio
      assert.equal(result.aspect, '1:1');
      assert(Number.isFinite(result.usage.inputTokens));
      assert(Number.isFinite(result.usage.outputTokens));
    });

    it('honors an explicit provider and model as placeholder routing', async function() {
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox', {
        provider: 'openai',
        model: 'gpt-image-2'
      });
      assert.equal(result.provider, 'openai');
      assert.equal(result.model, 'gpt-image-2');
    });
  });

  describe('generateImage under APOS_AI_MOCK with providers', function() {
    // Counts real adapter calls, which mock must never make
    let called;

    before(async function() {
      await t.destroy(apos);
      process.env.APOS_AI_MOCK = '1';
      called = 0;
      apos = await t.create({
        root: module,
        modules: {
          'fake-adapters': {
            init(self) {
              self.apos.ai.addAdapter({
                name: 'fakeimg',
                label: 'Fake Image',
                capabilities: {
                  text: false,
                  tools: false,
                  structured: false,
                  imageInput: false,
                  image: true,
                  caching: false
                },
                effort: {
                  medium: { model: 'fake-image' }
                },
                models: {
                  'fake-image': { aspects: [ '1:1', '3:2', '2:3' ] }
                },
                validate() {},
                async image() {
                  called++;
                  throw new Error('the real adapter must not run under mock');
                },
                normalizeError: (error) => error
              });
              self.apos.ai.addAdapter({
                name: 'fake',
                label: 'Fake',
                capabilities: {
                  text: true,
                  tools: true,
                  structured: true,
                  imageInput: true,
                  image: false,
                  caching: true
                },
                effort: {
                  medium: { model: 'fake-medium' }
                },
                models: {
                  'fake-medium': {
                    contextWindow: 100000,
                    maxOutputTokens: 8000
                  }
                },
                validate() {},
                normalizeError: (error) => error
              });
            }
          },
          '@apostrophecms/ai': {
            options: {
              provider: 'fakeimg',
              providers: {
                fakeimg: { apiKey: 'k1' },
                fake: { apiKey: 'k2' }
              }
              // Deliberately no "image" entry: mock must still answer
            }
          }
        }
      });
    });

    after(function() {
      delete process.env.APOS_AI_MOCK;
    });

    it('falls back to placeholder routing when no image route is configured', async function() {
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox');
      assert.equal(result.images[0].type, 'png');
      assert.equal(result.provider, 'mock');
      assert.equal(result.model, 'mock');
      assert.equal(called, 0);
    });

    it('still resolves explicit routing for real, answering with the mock', async function() {
      const result = await apos.ai.generateImage(apos.task.getReq(), 'a fox', {
        provider: 'fakeimg',
        model: 'fake-image',
        aspect: 'landscape'
      });
      assert.equal(result.provider, 'fakeimg');
      assert.equal(result.model, 'fake-image');
      // Resolved against the declared aspects — routing ran for real
      assert.equal(result.aspect, '3:2');
      assert.equal(called, 0);
    });

    it('still enforces the image capability on an explicit override', async function() {
      await assert.rejects(
        apos.ai.generateImage(apos.task.getReq(), 'a fox', {
          provider: 'fake',
          model: 'fake-medium'
        }),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /does not declare the "image" capability/);
          return true;
        }
      );
    });
  });
});
