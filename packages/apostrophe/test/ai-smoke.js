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
// per test, effort 'low', no caching, prompts of a few words — except the
// caching case, which is two calls with a prompt above the cache minimum.
//
// `cacheShares` names the usage fields a service reports about its
// prompt cache on the cold call and on the warm one. Only Anthropic
// documents its cache as deterministic; the others describe a hit as
// likely, not promised, and get `cacheHitOptional`: a call reporting no
// share skips rather than fails, after recording what came back.
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
    maxTokens: 200,
    cacheShares: {
      cold: 'cacheWriteTokens',
      warm: 'cacheReadTokens'
    }
  },
  {
    // Reasoning-capable routes need headroom for the reasoning tokens
    // ahead of the text, hence the larger caps
    name: 'openai',
    envKey: 'APOS_OPENAI_KEY',
    imageModel: 'gpt-image-2',
    maxTokens: 2000,
    cacheShares: {
      cold: 'cacheWriteTokens',
      warm: 'cacheReadTokens'
    },
    cacheHitOptional: true
  },
  {
    name: 'google',
    envKey: 'APOS_GEMINI_KEY',
    imageModel: 'gemini-3.1-flash-image',
    maxTokens: 2000,
    // No write report; the implicit cache is best effort, from a
    // 4,096-token prefix on the Flash models
    cacheShares: { warm: 'cacheReadTokens' },
    cacheHitOptional: true
  },
  {
    // The dialect against api.openai.com itself, the adapter's default
    // baseUrl. The service rejects tools beside reasoning there; the
    // openai adapter covers tools for OpenAI proper.
    name: 'openai-compatible',
    envKey: 'APOS_OPENAI_KEY',
    skipTools: true,
    maxTokens: 2000,
    cacheShares: {
      cold: 'cacheWriteTokens',
      warm: 'cacheReadTokens'
    },
    cacheHitOptional: true
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
// tool, and the row's image route when it configures one. Its `usage`
// records land in `usageRecords`, when given
function createFor(provider, usageRecords = []) {
  return t.create({
    root: module,
    modules: {
      'tool-fixtures': {
        init(self) {
          self.apos.ai.addTool(echoTool());
        }
      },
      'usage-watch': {
        handlers() {
          return {
            '@apostrophecms/ai:usage': {
              record(req, usage) {
                usageRecords.push(usage);
              }
            }
          };
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
      const usageRecords = [];

      before(async function() {
        if (!enabled || !provider.key) {
          this.skip();
        }
        apos = await createFor(provider, usageRecords);
        // The engine's own declaration gates the cases below, so this
        // table cannot drift from the adapters
        capabilities = apos.ai.modelInfo({ effort: 'low' }).capabilities;
      });

      after(async function() {
        if (apos) {
          return t.destroy(apos);
        }
      });

      beforeEach(function() {
        usageRecords.length = 0;
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
        // A live call reports real counts, never flagged as the mock's
        assert.equal(usageRecords.length, 1);
        assert.equal('mock' in usageRecords[0], false);
        assert.equal(usageRecords[0].outcome, 'accepted');
        assert.deepEqual(usageRecords[0].usage, result.usage);
      });

      it('runs a tool through the loop', async function() {
        if (!capabilities.tools || provider.skipTools) {
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
        // A record per provider response, none flagged as the mock's;
        // the accepted ones are the model turns the call's usage sums (a
        // rejected response was billed, but never part of the call)
        assert(usageRecords.every((usage) => !('mock' in usage)));
        const accepted = usageRecords.filter((usage) => usage.outcome === 'accepted');
        assert(accepted.length >= 2);
        for (const key of [ 'inputTokens', 'outputTokens' ]) {
          assert.equal(
            accepted.reduce((sum, usage) => sum + usage.usage[key], 0),
            result.usage[key]
          );
        }
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

      it('counts the cached share of the prompt in the input total', async function() {
        if (!capabilities.caching || !provider.cacheShares) {
          this.skip();
        }
        const req = apos.task.getReq();
        // Above every service's cache minimum, and stamped so a rerun
        // inside the cache lifetime still starts cold
        const options = {
          effort: 'low',
          system: `Reference material, edition ${Date.now()}.\n${filler(40000)}`,
          maxTokens: provider.maxTokens
        };
        const cold = await apos.ai.generate(req, 'reply with the single word OK', options);
        const warm = await apos.ai.generate(req, 'reply with the single word OK', options);
        record(apos, req, cold, { call: 'cold' });
        record(apos, req, warm, { call: 'warm' });
        // The same prompt is the same size cold or cached
        assert(Math.abs(cold.usage.inputTokens - warm.usage.inputTokens) <= 5);
        const { cold: written, warm: read } = provider.cacheShares;
        // A miss reports the share as 0 or not at all, depending on the
        // service; either way there is nothing to check
        const missed = (written && !(cold.usage[written] > 0)) ||
          !(warm.usage[read] > 0);
        if (missed && provider.cacheHitOptional) {
          this.skip();
        }
        if (written) {
          assert(cold.usage[written] > 0);
        }
        assert(warm.usage[read] > 0);
        // The total covers the cached share
        assert(warm.usage.inputTokens >= warm.usage[read]);
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
        // Image output bills at its own rate, so its share must travel
        assert(result.usage.imageOutputTokens > 0);
        assert(result.usage.imageOutputTokens <= result.usage.outputTokens);
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
        // The source image is part of the input
        assert(result.usage.imageInputTokens > 0);
        assert(result.usage.imageInputTokens <= result.usage.inputTokens);
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

  describe('anthropic structured output without forcing', function() {
    // A real dialect contract: the newer adaptive models reject a forced
    // tool, so on them the synthetic final-answer tool is left to its
    // description. The shared battery's structured case runs on the low
    // route, whose model still takes the forced tool
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

    it('returns structured output on an adaptive model', async function() {
      const req = apos.task.getReq();
      const result = await apos.ai.generate(
        req,
        'invent a cat',
        {
          effort: 'medium',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'integer' }
            },
            required: [ 'name', 'age' ],
            additionalProperties: false
          },
          maxTokens: 4000,
          cache: false
        }
      );
      record(apos, req, result, { object: result.object });
      assert.equal(result.finishReason, 'stop');
      assert.equal(typeof result.object.name, 'string');
      assert.equal(typeof result.object.age, 'number');
    });
  });

  describe('google thinking', function() {
    // Two dialect contracts. Gemini returns signed thought steps and
    // requires them back verbatim when the turn's tool results are
    // submitted — the adapter carries them as its opaque `thought` part;
    // the shared battery never raises the reasoning level, so it only
    // replays the minimal ones. And the response schema travels beside
    // the function tools on the same request, which the shared battery
    // never combines
    const provider = PROVIDERS.find((row) => row.name === 'google');
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

    it('replays thought parts across a tool round trip', async function() {
      const req = apos.task.getReq();
      const result = await apos.ai.generate(
        req,
        'call the echo tool with value "hi"',
        {
          effort: 'low',
          reasoning: 'high',
          tools: [ 'echo' ],
          maxTokens: 4000,
          cache: false
        }
      );
      record(apos, req, result, { text: result.text.slice(0, 80) });
      assert.equal(result.finishReason, 'stop');
      const step = result.steps.find((entry) => entry.toolCall.name === 'echo');
      assert(step);
      assert(step.result !== undefined);
      const calling = result.messages.find((message) => message.role === 'assistant' &&
        message.content.some((part) => part.type === 'toolCall'));
      const thought = calling.content.find((part) => part.type === 'thought');
      assert.equal(typeof thought.signature, 'string');
    });

    it('returns structured output beside a tool', async function() {
      const req = apos.task.getReq();
      const result = await apos.ai.generate(
        req,
        'call the echo tool with value "hi", then report what it echoed',
        {
          // The 'low' model repeats the tool call on every turn when a
          // response schema is present, until the step cap
          effort: 'medium',
          tools: [ 'echo' ],
          schema: {
            type: 'object',
            properties: { echoed: { type: 'string' } },
            required: [ 'echoed' ],
            additionalProperties: false
          },
          maxTokens: provider.maxTokens,
          cache: false
        }
      );
      record(apos, req, result, { object: result.object });
      assert.equal(result.finishReason, 'stop');
      assert(result.steps.find((entry) => entry.toolCall.name === 'echo'));
      assert.equal(typeof result.object.echoed, 'string');
    });
  });

  describe('cross-provider transcript', function() {
    // A transcript is plain data, so one provider can continue another's.
    // Gemini refuses a function call that no thought of its own precedes,
    // so the google adapter opens each foreign tool-calling message with
    // the service's dummy thought signature; only a live call proves the
    // service accepts it. Anthropic records, Google continues, one
    // instance each, as a stored transcript would be reloaded
    const recorder = PROVIDERS.find((row) => row.name === 'anthropic');
    const continuer = PROVIDERS.find((row) => row.name === 'google');
    let apos;
    // The recorded case's transcript, the continued case's input
    let transcript;

    before(function() {
      if (!enabled || !recorder.key || !continuer.key) {
        this.skip();
      }
    });

    afterEach(async function() {
      if (apos) {
        await t.destroy(apos);
        apos = null;
      }
    });

    it('records a tool transcript on anthropic', async function() {
      apos = await createFor(recorder);
      const req = apos.task.getReq();
      const result = await apos.ai.generate(
        req,
        'call the echo tool with value "hi"',
        {
          effort: 'low',
          tools: [ 'echo' ],
          maxTokens: recorder.maxTokens,
          cache: false
        }
      );
      record(apos, req, result, { messages: result.messages.length });
      assert.equal(result.finishReason, 'stop');
      assert(result.steps.find((entry) => entry.toolCall.name === 'echo'));
      transcript = result.messages;
    });

    it('continues it with tools on google', async function() {
      // Nothing to continue when the recording case skipped or failed
      if (!transcript) {
        this.skip();
      }
      apos = await createFor(continuer);
      const req = apos.task.getReq();
      const result = await apos.ai.generate(
        req,
        'now call the echo tool with value "bye"',
        {
          messages: transcript,
          effort: 'low',
          tools: [ 'echo' ],
          maxTokens: continuer.maxTokens,
          cache: false
        }
      );
      record(apos, req, result, { text: result.text.slice(0, 80) });
      assert.equal(result.finishReason, 'stop');
      assert.equal(result.provider, continuer.name);
    });
  });
});

// Non-repeating prose of about `chars` characters: repetitive text
// tokenizes densely, so numbered sentences keep the count honest
function filler(chars) {
  const sentences = [];
  for (let i = 0; sentences.join(' ').length < chars; i++) {
    sentences.push(`Item ${i}: the editor relates widget ${i * 7} to page ${i * 11} through template ${i % 13}.`);
  }
  return sentences.join(' ');
}
