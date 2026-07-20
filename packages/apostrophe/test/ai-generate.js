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

  describe('the call pipeline', function() {
    // Each test scripts the fake adapter's chat: an array of thunks,
    // one consumed per call, returning a turn or throwing
    let chatScript;
    let chatCalls;
    // Captured structured failure records, [{ severity, type, message, data }]
    let logRecords;
    const events = [];

    const turn = (extras = {}) => ({
      content: [ {
        type: 'text',
        text: 'a haiku'
      } ],
      finishReason: 'stop',
      usage: {
        inputTokens: 12,
        outputTokens: 7
      },
      model: 'fake-medium',
      ...extras
    });
    const httpError = (status) => {
      const error = new Error(`HTTP error ${status}`);
      error.status = status;
      return error;
    };

    before(async function() {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        modules: {
          'fake-adapters': {
            init(self) {
              self.apos.ai.addAdapter(fakeAdapter('fake', {
                async chat(req, request) {
                  chatCalls.push(request);
                  const step = chatScript.shift();
                  if (step === undefined) {
                    throw new Error('chat called beyond its script');
                  }
                  return step();
                },
                normalizeError(err) {
                  // Optional hints a real adapter would parse from the
                  // response, passed through for the tests to script
                  const hints = {
                    status: err.status,
                    ...(err.retryAfter !== undefined && { retryAfter: err.retryAfter }),
                    ...(err.kind !== undefined && { kind: err.kind }),
                    ...(err.requestId !== undefined && { requestId: err.requestId })
                  };
                  if (err.status === 429 || err.status >= 500) {
                    return self.apos.error('aiRetry', 'transient failure', hints);
                  }
                  if (err.status === 401 || err.status === 403) {
                    return self.apos.error('forbidden', 'bad credentials', hints);
                  }
                  return err;
                }
              }));
            }
          },
          'ai-events': {
            handlers(self) {
              return {
                '@apostrophecms/ai:beforeGenerate': {
                  record(req, context) {
                    events.push([ 'before', context ]);
                  }
                },
                '@apostrophecms/ai:afterGenerate': {
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
                notext: {
                  adapter: 'fake',
                  apiKey: 'k2',
                  capabilities: { text: false }
                }
              },
              // Keep retried tests fast; the delay engine has its own suite
              retryBaseDelay: 1
            }
          }
        }
      });
    });

    after(async function() {
      return t.destroy(apos);
    });

    beforeEach(function() {
      chatScript = [];
      chatCalls = [];
      events.length = 0;
      // Capture the structured failure records (and keep them off the
      // test output)
      logRecords = [];
      for (const severity of [ 'Warn', 'Error' ]) {
        apos.ai[`log${severity}`] = (req, type, message, data) => {
          logRecords.push({
            severity: severity.toLowerCase(),
            type,
            message,
            data
          });
        };
      }
    });

    it('generates text end to end', async function() {
      chatScript = [ () => turn() ];
      const result = await apos.ai.generate(
        apos.task.getReq(),
        'write a haiku about cats'
      );
      assert.deepStrictEqual(result, {
        text: 'a haiku',
        messages: [
          {
            role: 'user',
            content: [ {
              type: 'text',
              text: 'write a haiku about cats'
            } ]
          },
          {
            role: 'assistant',
            content: [ {
              type: 'text',
              text: 'a haiku'
            } ]
          }
        ],
        finishReason: 'stop',
        usage: {
          inputTokens: 12,
          outputTokens: 7
        },
        model: 'fake-medium',
        provider: 'fake'
      });
      // The adapter received the assembled request
      assert.strictEqual(chatCalls.length, 1);
      assert.strictEqual(chatCalls[0].model, 'fake-medium');
      assert.strictEqual(chatCalls[0].maxTokens, 16000);
      assert.deepStrictEqual(chatCalls[0].cache, { ttl: 'short' });
    });

    it('continues a conversation with the string positional appended', async function() {
      chatScript = [ () => turn({
        content: [ {
          type: 'text',
          text: 'Done.'
        } ]
      }) ];
      const result = await apos.ai.generate(
        apos.task.getReq(),
        'Create one from the standard template.',
        {
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
      assert.strictEqual(chatCalls[0].messages.length, 3);
      assert.strictEqual(result.text, 'Done.');
      // The transcript is resumable: it ends with the assistant turn
      assert.strictEqual(result.messages.length, 4);
      assert.deepStrictEqual(result.messages[3], {
        role: 'assistant',
        content: [ {
          type: 'text',
          text: 'Done.'
        } ]
      });
    });

    it('emits beforeGenerate and afterGenerate around the call', async function() {
      chatScript = [ () => turn() ];
      await apos.ai.generate(apos.task.getReq(), 'p');
      assert.deepStrictEqual(events.map(([ name ]) => name), [ 'before', 'after' ]);
      const [ [ , beforeContext ], [ , afterContext ] ] = events;
      // One shared, mutable context correlates the two
      assert.strictEqual(beforeContext, afterContext);
      assert.strictEqual(beforeContext.provider, 'fake');
      assert(Array.isArray(beforeContext.request.messages));
      assert.strictEqual(afterContext.result.text, 'a haiku');
    });

    it('retries the transient code and succeeds', async function() {
      chatScript = [
        () => {
          throw httpError(429);
        },
        () => {
          throw httpError(503);
        },
        () => turn()
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.strictEqual(result.text, 'a haiku');
      assert.strictEqual(chatCalls.length, 3);
    });

    it('gives up when the attempts cap is exhausted', async function() {
      chatScript = Array.from({ length: 5 }, () => () => {
        throw httpError(429);
      });
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.strictEqual(e.name, 'aiRetry');
        return true;
      });
      assert.strictEqual(chatCalls.length, 5);
    });

    it('honors the retryAttempts option', async function() {
      const saved = apos.ai.options.retryAttempts;
      try {
        apos.ai.options.retryAttempts = 2;
        chatScript = Array.from({ length: 3 }, () => () => {
          throw httpError(429);
        });
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.strictEqual(e.name, 'aiRetry');
          return true;
        });
        assert.strictEqual(chatCalls.length, 2);
      } finally {
        apos.ai.options.retryAttempts = saved;
      }
    });

    it('hard-stops on a standard code without retrying', async function() {
      chatScript = [ () => {
        throw httpError(401);
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.strictEqual(e.name, 'forbidden');
        return true;
      });
      assert.strictEqual(chatCalls.length, 1);
      // beforeGenerate fired, afterGenerate did not
      assert.deepStrictEqual(events.map(([ name ]) => name), [ 'before' ]);
    });

    it('passes an adapter-thrown normalized error through untouched', async function() {
      const refusal = apos.error('aiRefusal', 'safety policy');
      chatScript = [ () => {
        throw refusal;
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.strictEqual(e, refusal);
        return true;
      });
      assert.strictEqual(chatCalls.length, 1);
    });

    it('treats a truncated turn as transient and retries it', async function() {
      chatScript = [
        // No finishReason, no usage
        () => ({
          content: [ {
            type: 'text',
            text: 'half a hai'
          } ]
        }),
        () => turn()
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.strictEqual(result.text, 'a haiku');
      assert.strictEqual(chatCalls.length, 2);
    });

    it('converts a refusal finish reason to the refusal error', async function() {
      chatScript = [ () => turn({ finishReason: 'refusal' }) ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.strictEqual(e.name, 'aiRefusal');
        return true;
      });
    });

    it('rejects unexpected tool calls from the adapter', async function() {
      chatScript = [ () => turn({ finishReason: 'toolCalls' }) ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.strictEqual(e.name, 'invalid');
        assert.match(e.message, /tool calls/);
        return true;
      });
    });

    it('refuses to route to a provider lacking the needed capability', async function() {
      await assert.rejects(
        apos.ai.generate(apos.task.getReq(), 'p', {
          provider: 'notext',
          model: 'fake-medium'
        }),
        (e) => {
          assert.strictEqual(e.name, 'invalid');
          assert.match(e.message, /does not declare the "text" capability/);
          return true;
        }
      );
      assert.strictEqual(chatCalls.length, 0);
      assert.strictEqual(events.length, 0);
    });

    describe('retry policy', function() {
      let waits;
      let savedPause;

      beforeEach(function() {
        // Observe the delays without really waiting
        waits = [];
        savedPause = apos.ai.pause;
        apos.ai.pause = async (ms) => {
          waits.push(ms);
        };
      });

      afterEach(function() {
        apos.ai.pause = savedPause;
      });

      it('computes exponential backoff with jitter within bounds', function() {
        const saved = apos.ai.options.retryBaseDelay;
        try {
          apos.ai.options.retryBaseDelay = 1000;
          const error = apos.error('aiRetry', 'x');
          for (const [ attempt, min, max ] of [
            [ 1, 1000, 2000 ],
            [ 2, 2000, 4000 ],
            [ 3, 4000, 8000 ]
          ]) {
            for (let i = 0; i < 25; i++) {
              const delay = apos.ai.retryDelay(attempt, error);
              assert(
                delay >= min && delay < max,
                `delay ${delay} out of [${min}, ${max}) at attempt ${attempt}`
              );
            }
          }
        } finally {
          apos.ai.options.retryBaseDelay = saved;
        }
      });

      it('honors Retry-After over the computed curve', function() {
        const error = apos.error('aiRetry', 'x', { retryAfter: 7 });
        assert.strictEqual(apos.ai.retryDelay(1, error), 7000);
        assert.strictEqual(apos.ai.retryDelay(3, error), 7000);
      });

      it('waits the Retry-After delay between attempts', async function() {
        chatScript = [
          () => {
            const e = httpError(429);
            e.retryAfter = 3;
            throw e;
          },
          () => turn()
        ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p');
        assert.strictEqual(result.text, 'a haiku');
        assert.deepStrictEqual(waits, [ 3000 ]);
      });

      it('stops without sleeping when the delay would exceed the elapsed budget', async function() {
        chatScript = [ () => {
          const e = httpError(429);
          // Beyond the 60s budget
          e.retryAfter = 120;
          throw e;
        } ];
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.strictEqual(e.name, 'aiRetry');
          return true;
        });
        assert.strictEqual(chatCalls.length, 1);
        assert.deepStrictEqual(waits, []);
        const [ record ] = logRecords;
        assert.strictEqual(record.severity, 'error');
        assert.strictEqual(record.type, 'failure');
        assert.strictEqual(record.data.action, 'stop');
        assert.strictEqual(record.data.reason, 'budget');
        assert.strictEqual(record.data.retryAfter, 120);
        assert.strictEqual(record.data.delay, 120000);
      });

      it('emits one record per retry decision with the failure context', async function() {
        chatScript = [
          () => {
            const e = httpError(429);
            e.kind = 'rateLimit';
            throw e;
          },
          () => {
            throw httpError(503);
          },
          () => turn()
        ];
        await apos.ai.generate(apos.task.getReq(), 'p');
        assert.strictEqual(logRecords.length, 2);
        const [ first, second ] = logRecords;
        assert.strictEqual(first.severity, 'warn');
        assert.strictEqual(first.type, 'retry');
        assert.strictEqual(first.data.provider, 'fake');
        assert.strictEqual(first.data.model, 'fake-medium');
        assert.strictEqual(first.data.code, 'aiRetry');
        assert.strictEqual(first.data.status, 429);
        assert.strictEqual(first.data.kind, 'rateLimit');
        assert.strictEqual(first.data.attempt, 1);
        assert.strictEqual(first.data.action, 'retry');
        assert(Number.isFinite(first.data.delay));
        assert.strictEqual(second.data.status, 503);
        assert.strictEqual(second.data.attempt, 2);
      });

      it('records a hard stop with its context', async function() {
        chatScript = [ () => {
          const e = httpError(401);
          e.requestId = 'req_123';
          throw e;
        } ];
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.strictEqual(e.name, 'forbidden');
          return true;
        });
        assert.strictEqual(logRecords.length, 1);
        const [ record ] = logRecords;
        assert.strictEqual(record.severity, 'error');
        assert.strictEqual(record.type, 'failure');
        assert.strictEqual(record.message, 'bad credentials');
        assert.strictEqual(record.data.code, 'forbidden');
        assert.strictEqual(record.data.status, 401);
        assert.strictEqual(record.data.requestId, 'req_123');
        assert.strictEqual(record.data.attempt, 1);
        assert.strictEqual(record.data.action, 'stop');
        assert.strictEqual(record.data.reason, undefined);
        // The stack of the original throw, not the normalized wrapper
        assert.match(record.data.stack, /HTTP error 401/);
      });

      it('records exhausted attempts as the stop reason', async function() {
        const saved = apos.ai.options.retryAttempts;
        try {
          apos.ai.options.retryAttempts = 2;
          chatScript = [
            () => {
              throw httpError(429);
            },
            () => {
              throw httpError(429);
            }
          ];
          await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
            assert.strictEqual(e.name, 'aiRetry');
            return true;
          });
          assert.deepStrictEqual(
            logRecords.map((record) => [ record.type, record.data.reason ]),
            [ [ 'retry', undefined ], [ 'failure', 'attempts' ] ]
          );
        } finally {
          apos.ai.options.retryAttempts = saved;
        }
      });
    });
  });
});
