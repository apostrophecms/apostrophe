const t = require('../test-lib/test.js');
const assert = require('assert/strict');

// The one file that talks to the real provider APIs. Two locks, both
// required: the APOS_AI_SMOKE=1 master switch — CI included, where the
// workflow decides whether to enable it — plus each provider's own key,
// so an exported key alone never spends anyone's tokens. A missing key
// skips that provider alone, so a run without secrets (a fork's CI, a
// contributor's shell) skips clean instead of failing.
//
// These are integration tests of our code, not model evaluations: every
// assertion is on shape, never on what the model said. One apos.ai call
// per test, effort 'low', no caching, prompts of a few words.
//
// A full run with every key set costs a few cents, dominated by the four
// image calls; the text, tool and structured cases are fractions of a
// cent each.
//
// Model pins, so a bump is a conscious edit here rather than drift: the
// openai row pins gpt-image-2, the google row gemini-3.1-flash-image.

const PROVIDERS = [
  {
    name: 'anthropic',
    envKey: 'APOS_ANTHROPIC_KEY',
    maxTokens: 200
  },
  {
    // Reasoning-capable routes need headroom for the reasoning tokens
    // ahead of the text, hence the larger caps
    name: 'openai',
    envKey: 'APOS_OPENAI_KEY',
    imageModel: 'gpt-image-2',
    maxTokens: 2000
  },
  {
    name: 'google',
    envKey: 'APOS_GEMINI_KEY',
    imageModel: 'gemini-3.1-flash-image',
    maxTokens: 2000
  },
  {
    // The dialect against api.openai.com itself, the adapter's default
    // baseUrl
    name: 'openai-compatible',
    envKey: 'APOS_OPENAI_KEY',
    maxTokens: 2000
  }
];

const enabled = process.env.APOS_AI_SMOKE === '1';

// Captured at load, before any mocked suite's hooks touch the environment
for (const provider of PROVIDERS) {
  provider.key = process.env[provider.envKey];
}

// A fresh definition per apostrophe instance: activation canonicalizes
// what it is given
function echoTool() {
  return {
    name: 'echo',
    description: 'Echo the value back',
    kind: 'query',
    input: {
      type: 'object',
      properties: { value: { type: 'string' } },
      required: [ 'value' ]
    },
    handler: (req, args) => ({ value: args.value })
  };
}

// Record a run's evidence through the module's structured log (event
// type 'smoke'), before any assertion, so a failed case still leaves
// what the provider actually returned in the local or CI output. Shape
// metadata always; content only where it is small and diagnostic.
function record(apos, req, result, extra = {}) {
  apos.ai.logInfo(req, 'smoke', {
    provider: result.provider,
    model: result.model,
    ...(result.finishReason && { finishReason: result.finishReason }),
    ...(result.usage && { usage: result.usage }),
    ...extra
  });
}

// One live instance per provider row: its single provider entry, the echo
// tool, and the row's image route when it configures one
function createFor(provider) {
  return t.create({
    root: module,
    modules: {
      'tool-fixtures': {
        init(self) {
          self.apos.ai.addTool(echoTool());
        }
      },
      '@apostrophecms/ai': {
        options: {
          providers: {
            [provider.name]: { apiKey: provider.key }
          },
          ...(provider.imageModel && {
            image: {
              provider: provider.name,
              model: provider.imageModel
            }
          })
        }
      }
    }
  });
}

describe('AI live smoke', function() {
  // Live calls far exceed the suite's default timeout
  this.timeout(60000);

  let savedMock;

  before(function() {
    // A mock run would make every case below meaningless; mocha runs
    // every file in one process, so restore symmetrically
    savedMock = process.env.APOS_AI_MOCK;
    delete process.env.APOS_AI_MOCK;
  });

  after(function() {
    if (savedMock !== undefined) {
      process.env.APOS_AI_MOCK = savedMock;
    }
  });

  for (const provider of PROVIDERS) {
    describe(provider.name, function() {
      let apos;
      let capabilities;
      // The image case's output, reused as the edit case's source so the
      // edit spends no extra generation call
      let generated;

      before(async function() {
        if (!enabled || !provider.key) {
          this.skip();
        }
        apos = await createFor(provider);
        // The engine's own declaration gates the cases below, so this
        // table cannot drift from the adapters
        capabilities = apos.ai.modelInfo({ effort: 'low' }).capabilities;
      });

      after(async function() {
        if (apos) {
          return t.destroy(apos);
        }
      });

      it('generates text', async function() {
        if (!capabilities.text) {
          this.skip();
        }
        const req = apos.task.getReq();
        const result = await apos.ai.generate(
          req,
          'write a haiku about cats',
          {
            effort: 'low',
            maxTokens: provider.maxTokens,
            cache: false
          }
        );
        record(apos, req, result, { text: result.text.slice(0, 80) });
        assert(result.text.length > 0);
        assert.equal(result.finishReason, 'stop');
        assert.equal(result.provider, provider.name);
        assert(result.model.length > 0);
        assert(Number.isFinite(result.usage.inputTokens));
        assert(Number.isFinite(result.usage.outputTokens));
      });

      it('runs a tool through the loop', async function() {
        if (!capabilities.tools) {
          this.skip();
        }
        const req = apos.task.getReq();
        const result = await apos.ai.generate(
          req,
          'call the echo tool with value "hi"',
          {
            effort: 'low',
            tools: [ 'echo' ],
            maxTokens: provider.maxTokens,
            cache: false
          }
        );
        record(apos, req, result, { steps: result.steps?.length });
        assert.equal(result.finishReason, 'stop');
        const step = result.steps.find((entry) => entry.toolCall.name === 'echo');
        assert(step);
        assert(step.result !== undefined);
      });

      it('returns structured output', async function() {
        if (!capabilities.structured) {
          this.skip();
        }
        const req = apos.task.getReq();
        const result = await apos.ai.generate(
          req,
          'invent a cat',
          {
            effort: 'low',
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'integer' }
              },
              required: [ 'name', 'age' ],
              additionalProperties: false
            },
            maxTokens: provider.maxTokens,
            cache: false
          }
        );
        record(apos, req, result, { object: result.object });
        assert.equal(result.finishReason, 'stop');
        assert.equal(typeof result.object.name, 'string');
        assert.equal(typeof result.object.age, 'number');
      });

      it('generates an image', async function() {
        if (!provider.imageModel) {
          this.skip();
        }
        this.timeout(120000);
        const req = apos.task.getReq();
        const result = await apos.ai.generateImage(
          req,
          'a small watercolor fox',
          {
            count: 1,
            aspect: '1:1',
            quality: 'low'
          }
        );
        record(apos, req, result, {
          count: result.images.length,
          ...(result.size !== undefined && { size: result.size })
        });
        const [ image ] = result.images;
        assert(image.data.length > 0);
        assert.equal(result.provider, provider.name);
        assert.equal(result.aspect, '1:1');
        generated = image;
      });

      it('edits an image', async function() {
        // No source to edit when the image case skipped or failed
        if (!provider.imageModel || !capabilities.imageInput || !generated) {
          this.skip();
        }
        this.timeout(120000);
        const req = apos.task.getReq();
        const result = await apos.ai.generateImage(
          req,
          'make the fox wear a red scarf',
          {
            count: 1,
            images: [ {
              data: generated.data,
              mediaType: `image/${generated.type}`
            } ],
            aspect: 'square',
            quality: 'low'
          }
        );
        record(apos, req, result, {
          count: result.images.length,
          ...(result.size !== undefined && { size: result.size })
        });
        assert(result.images[0].data.length > 0);
        assert.equal(result.provider, provider.name);
        assert.equal(result.aspect, '1:1');
      });
    });
  }

  // What the provider table cannot express. Add a case here only when it
  // is genuinely provider-specific, and state what dialect contract it
  // verifies and why the shared battery cannot cover it.
  describe('anthropic extended thinking', function() {
    // A real dialect contract: Anthropic returns signed
    // thinking blocks and requires them back verbatim when the turn's
    // tool results are submitted — the adapter carries them as its
    // opaque `thinking` part and replays the raw block. The mocked
    // suite proves we replay what we parsed; only a live round trip
    // proves the service accepts it. The shared battery never enables
    // reasoning, so its tool case cannot catch a replay regression
    const provider = PROVIDERS.find((row) => row.name === 'anthropic');
    let apos;

    before(async function() {
      if (!enabled || !provider.key) {
        this.skip();
      }
      apos = await createFor(provider);
    });

    after(async function() {
      if (apos) {
        return t.destroy(apos);
      }
    });

    it('replays thinking blocks across a tool round trip', async function() {
      const req = apos.task.getReq();
      const result = await apos.ai.generate(
        req,
        'call the echo tool with value "hi"',
        {
          effort: 'low',
          reasoning: 'low',
          tools: [ 'echo' ],
          // Above the 'low' thinking budget, with room for the answer
          maxTokens: 3000,
          cache: false
        }
      );
      record(apos, req, result, { text: result.text.slice(0, 80) });
      assert.equal(result.finishReason, 'stop');
      const step = result.steps.find((entry) => entry.toolCall.name === 'echo');
      assert(step);
      assert(step.result !== undefined);
    });
  });
});
