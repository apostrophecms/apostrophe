const t = require('../test-lib/test.js');
const assert = require('assert');

// A registrable fake adapter following the adapter contract, minus
// anything that would talk to a network
const fakeAdapter = (name, extras = {}) => ({
  name,
  label: `Fake (${name})`,
  capabilities: {
    text: true,
    tools: true,
    structured: true,
    imageInput: true,
    image: false,
    caching: true
  },
  effort: {
    low: { model: `${name}-small` },
    medium: { model: `${name}-medium` },
    high: {
      model: `${name}-large`,
      reasoning: 'high'
    }
  },
  models: {
    [`${name}-small`]: {
      contextWindow: 100000,
      maxOutputTokens: 8000
    },
    [`${name}-medium`]: {
      contextWindow: 200000,
      maxOutputTokens: 16000
    },
    [`${name}-large`]: {
      contextWindow: 400000,
      maxOutputTokens: 32000
    }
  },
  validate() {
    if (!this.apiKey) {
      throw new Error(`${name}: apiKey missing`);
    }
  },
  normalizeError(err) {
    return err;
  },
  ...extras
});

describe('AI generate', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'fake-adapters': {
          init(self) {
            self.apos.ai.addAdapter(fakeAdapter('fake'));
          }
        },
        '@apostrophecms/ai': {
          options: {
            providers: {
              fake: { apiKey: 'k1' }
            }
          }
        }
      }
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  // Error-throwing assertion helpers for the normalized apos codes
  const throwsInvalid = (fn, pattern) => {
    assert.throws(fn, (e) => {
      assert.strictEqual(e.name, 'invalid');
      assert.match(e.message, pattern);
      return true;
    });
  };
  const throwsUnimplemented = (fn, pattern) => {
    assert.throws(fn, (e) => {
      assert.strictEqual(e.name, 'unimplemented');
      assert.match(e.message, pattern);
      return true;
    });
  };

  describe('argument sugar', function() {
    it('turns a string positional into the sole user message', function() {
      const canonical = apos.ai.normalizeGenerateOptions('write a haiku about cats');
      assert.deepStrictEqual(canonical.messages, [ {
        role: 'user',
        content: [ {
          type: 'text',
          text: 'write a haiku about cats'
        } ]
      } ]);
      assert.strictEqual(canonical.cache, 'short');
    });

    it('appends a string positional to messages as the latest user turn', function() {
      const canonical = apos.ai.normalizeGenerateOptions('Create one from the standard template.', {
        messages: [
          {
            role: 'user',
            content: 'Do we have a pricing page?'
          },
          {
            role: 'assistant',
            content: 'No, I did not find one.'
          }
        ]
      });
      assert.strictEqual(canonical.messages.length, 3);
      assert.deepStrictEqual(canonical.messages[2], {
        role: 'user',
        content: [ {
          type: 'text',
          text: 'Create one from the standard template.'
        } ]
      });
    });

    it('accepts a standalone options object', function() {
      const canonical = apos.ai.normalizeGenerateOptions({
        system: 'You help editors.',
        messages: [ {
          role: 'user',
          content: 'hello'
        } ],
        effort: 'high'
      });
      assert.strictEqual(canonical.system, 'You help editors.');
      assert.strictEqual(canonical.effort, 'high');
      assert.strictEqual(canonical.messages.length, 1);
    });

    it('rejects an options object followed by a second argument', function() {
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions({ messages: [] }, { effort: 'low' }),
        /a second argument is not accepted/
      );
    });

    it('rejects an empty prompt and a promptless, messageless call', function() {
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions(''),
        /the prompt string must not be empty/
      );
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions({}),
        /a prompt string or "messages" is required/
      );
    });

    it('rejects a first argument that is neither string nor object', function() {
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions(42),
        /a prompt string or an options object is required/
      );
    });
  });

  describe('option validation', function() {
    it('rejects the reserved options as not yet supported', function() {
      throwsUnimplemented(
        () => apos.ai.normalizeGenerateOptions('p', { tools: [] }),
        /"tools" is not yet supported/
      );
      throwsUnimplemented(
        () => apos.ai.normalizeGenerateOptions('p', { schema: { type: 'object' } }),
        /"schema" is not yet supported/
      );
      throwsUnimplemented(
        () => apos.ai.normalizeGenerateOptions('p', { maxSteps: 3 }),
        /"maxSteps" is not yet supported/
      );
    });

    it('rejects an unknown option', function() {
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { maxtokens: 100 }),
        /unknown option "maxtokens"/
      );
    });

    it('rejects malformed scalar options', function() {
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { system: 5 }),
        /"system" must be a string/
      );
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { maxTokens: 0 }),
        /"maxTokens" must be a positive integer/
      );
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { cache: true }),
        /"cache" must be false, "short" or "long"/
      );
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { signal: {} }),
        /"signal" must be an AbortSignal/
      );
    });

    it('defaults cache to short and honors an explicit false', function() {
      assert.strictEqual(apos.ai.normalizeGenerateOptions('p').cache, 'short');
      assert.strictEqual(
        apos.ai.normalizeGenerateOptions('p', { cache: false }).cache,
        false
      );
      assert.strictEqual(
        apos.ai.normalizeGenerateOptions('p', { cache: 'long' }).cache,
        'long'
      );
    });
  });

  describe('message normalization', function() {
    it('collapses string content to a text part', function() {
      assert.deepStrictEqual(apos.ai.normalizeMessages([ {
        role: 'assistant',
        content: 'No, I did not find one.'
      } ]), [ {
        role: 'assistant',
        content: [ {
          type: 'text',
          text: 'No, I did not find one.'
        } ]
      } ]);
    });

    it('rebuilds text and image parts in canonical form', function() {
      const normalized = apos.ai.normalizeMessages([ {
        role: 'user',
        // Extra properties, as on a stored transcript, do not travel
        _id: 'stored',
        content: [
          {
            type: 'text',
            text: 'describe this',
            stray: true
          },
          {
            type: 'image',
            image: { url: 'https://example.com/a.png' }
          },
          {
            type: 'image',
            image: {
              data: 'aGk=',
              mediaType: 'image/png',
              stray: true
            }
          }
        ]
      } ]);
      assert.deepStrictEqual(normalized, [ {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'describe this'
          },
          {
            type: 'image',
            image: { url: 'https://example.com/a.png' }
          },
          {
            type: 'image',
            image: {
              data: 'aGk=',
              mediaType: 'image/png'
            }
          }
        ]
      } ]);
    });

    it('rejects tool messages and tool parts as not yet supported', function() {
      throwsUnimplemented(
        () => apos.ai.normalizeMessages([ {
          role: 'tool',
          content: 'result'
        } ]),
        /"tool" messages are not yet supported/
      );
      throwsUnimplemented(
        () => apos.ai.normalizeMessages([ {
          role: 'assistant',
          content: [ {
            type: 'toolCall',
            id: 'x',
            name: 'find_pages',
            input: {}
          } ]
        } ]),
        /"toolCall" parts are not yet supported/
      );
    });

    it('rejects malformed messages', function() {
      throwsInvalid(
        () => apos.ai.normalizeMessages('not an array'),
        /"messages" must be an array/
      );
      throwsInvalid(
        () => apos.ai.normalizeMessages([ 'hello' ]),
        /messages\[0\] must be an object/
      );
      throwsInvalid(
        () => apos.ai.normalizeMessages([ {
          role: 'system',
          content: 'x'
        } ]),
        /messages\[0\]\.role must be "user" or "assistant"/
      );
      throwsInvalid(
        () => apos.ai.normalizeMessages([ {
          role: 'user',
          content: []
        } ]),
        /messages\[0\]\.content must be a string or a non-empty array/
      );
      throwsInvalid(
        () => apos.ai.normalizeMessages([ {
          role: 'user',
          content: [ { type: 'video' } ]
        } ]),
        /messages\[0\]\.content\[0\]\.type "video" is unknown/
      );
      throwsInvalid(
        () => apos.ai.normalizeMessages([ {
          role: 'user',
          content: [ {
            type: 'image',
            image: { data: 'x' }
          } ]
        } ]),
        /messages\[0\]\.content\[0\]\.image must be an object/
      );
    });
  });

  describe('request assembly', function() {
    const canonical = (stringOrOptions, options) =>
      apos.ai.normalizeGenerateOptions(stringOrOptions, options);

    it('assembles the default-effort request', function() {
      const { provider, request } = apos.ai.buildRequest(canonical('write a haiku'));
      assert.strictEqual(provider, 'fake');
      assert.deepStrictEqual(request, {
        messages: [ {
          role: 'user',
          content: [ {
            type: 'text',
            text: 'write a haiku'
          } ]
        } ],
        model: 'fake-medium',
        // The model's declared output ceiling
        maxTokens: 16000,
        cache: { ttl: 'short' }
      });
    });

    it('resolves effort and honors per-call overrides', function() {
      const high = apos.ai.buildRequest(canonical('p', { effort: 'high' }));
      assert.strictEqual(high.request.model, 'fake-large');
      assert.strictEqual(high.request.reasoning, 'high');
      assert.strictEqual(high.request.maxTokens, 32000);

      const overridden = apos.ai.buildRequest(canonical('p', {
        effort: 'high',
        reasoning: 'low',
        maxTokens: 500
      }));
      assert.strictEqual(overridden.request.reasoning, 'low');
      assert.strictEqual(overridden.request.maxTokens, 500);
    });

    it('omits maxTokens for a model with no declared metadata', function() {
      const { request } = apos.ai.buildRequest(canonical('p', {
        provider: 'fake',
        model: 'fake-next'
      }));
      assert.strictEqual(request.model, 'fake-next');
      assert(!('maxTokens' in request));
    });

    it('translates the cache level to the { ttl } policy', function() {
      assert.deepStrictEqual(
        apos.ai.buildRequest(canonical('p', { cache: 'long' })).request.cache,
        { ttl: 'long' }
      );
      assert.strictEqual(
        apos.ai.buildRequest(canonical('p', { cache: false })).request.cache,
        false
      );
    });

    it('carries system and signal through', function() {
      const controller = new AbortController();
      const { request } = apos.ai.buildRequest(canonical('p', {
        system: 'You are terse.',
        signal: controller.signal
      }));
      assert.strictEqual(request.system, 'You are terse.');
      assert.strictEqual(request.signal, controller.signal);
    });

    it('throws the routing errors a real call would', function() {
      assert.throws(
        () => apos.ai.buildRequest(canonical('p', { effort: 'extreme' })),
        (e) => {
          assert.strictEqual(e.name, 'invalid');
          assert.match(e.message, /effort level "extreme" resolves to no routing entry/);
          return true;
        }
      );
    });
  });
});
