const t = require('../test-lib/test.js');
const assert = require('assert/strict');

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
        'tool-fixtures': {
          init(self) {
            self.apos.ai.addTool({
              name: 'echo',
              description: 'Echo the text back',
              access: 'read',
              input: {
                type: 'object',
                properties: { text: { type: 'string' } }
              },
              schema: { text: { type: 'string' } },
              handler: (req, args) => ({ text: args.text })
            });
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
      assert.equal(e.name, 'invalid');
      assert.match(e.message, pattern);
      return true;
    });
  };
  describe('argument sugar', function() {
    it('turns a string positional into the sole user message', function() {
      const canonical = apos.ai.normalizeGenerateOptions('write a haiku about cats');
      assert.deepEqual(canonical.messages, [ {
        role: 'user',
        content: [ {
          type: 'text',
          text: 'write a haiku about cats'
        } ]
      } ]);
      assert.equal(canonical.cache, 'short');
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
      assert.equal(canonical.messages.length, 3);
      assert.deepEqual(canonical.messages[2], {
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
      assert.equal(canonical.system, 'You help editors.');
      assert.equal(canonical.effort, 'high');
      assert.equal(canonical.messages.length, 1);
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
    it('accepts a structured-output schema and compiles a backstop validator', function() {
      const canonical = apos.ai.normalizeGenerateOptions('p', {
        schema: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: [ 'title' ]
        }
      });
      assert.equal(canonical.schema.type, 'object');
      assert.equal(typeof canonical.validateObject, 'function');
      // The compiled backstop validates against that schema
      assert.equal(canonical.validateObject({ title: 'ok' }), true);
      assert.equal(canonical.validateObject({}), false);
    });

    it('rejects a schema without an object root', function() {
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { schema: { type: 'string' } }),
        /"schema" must be a JSON Schema with an object root/
      );
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { schema: 'nope' }),
        /"schema" must be a JSON Schema with an object root/
      );
    });

    it('rejects a malformed JSON Schema', function() {
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', {
          schema: {
            type: 'object',
            properties: 'not an object'
          }
        }),
        /"schema" is not a valid JSON Schema/
      );
    });

    it('combines tools and schema', function() {
      const canonical = apos.ai.normalizeGenerateOptions('p', {
        tools: [ 'echo' ],
        schema: { type: 'object' }
      });
      assert.equal(canonical.tools.length, 1);
      assert.equal(canonical.tools[0].name, 'echo');
      assert.equal(typeof canonical.validateObject, 'function');
    });

    it('validates tools and maxSteps', function() {
      const canonical = apos.ai.normalizeGenerateOptions('p');
      assert.deepEqual(canonical.tools, []);
      // The module option is the default cap
      assert.equal(canonical.maxSteps, 5);
      assert.equal(
        apos.ai.normalizeGenerateOptions('p', { maxSteps: 8 }).maxSteps,
        8
      );
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { maxSteps: 0 }),
        /"maxSteps" must be a positive integer/
      );
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { tools: 'find_pages' }),
        /"tools" must be an array of registered tool names/
      );
      throwsInvalid(
        () => apos.ai.normalizeGenerateOptions('p', { tools: [ 'ghost' ] }),
        /"tools" names unknown tool "ghost"/
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
      assert.equal(apos.ai.normalizeGenerateOptions('p').cache, 'short');
      assert.equal(
        apos.ai.normalizeGenerateOptions('p', { cache: false }).cache,
        false
      );
      assert.equal(
        apos.ai.normalizeGenerateOptions('p', { cache: 'long' }).cache,
        'long'
      );
    });
  });

  describe('message normalization', function() {
    it('collapses string content to a text part', function() {
      assert.deepEqual(apos.ai.normalizeMessages([ {
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
      assert.deepEqual(normalized, [ {
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

    it('normalizes tool messages and tool parts', function() {
      const messages = apos.ai.normalizeMessages([
        {
          role: 'assistant',
          content: [ {
            type: 'toolCall',
            id: 'call_1',
            name: 'find_pages',
            input: { query: 'pricing' },
            extra: 'dropped'
          } ]
        },
        {
          role: 'tool',
          content: [
            {
              type: 'toolResult',
              toolCallId: 'call_1',
              output: { found: true }
            },
            {
              type: 'toolResult',
              toolCallId: 'call_2',
              error: 'unknown tool "ghost"'
            }
          ]
        }
      ]);
      assert.deepEqual(messages, [
        {
          role: 'assistant',
          content: [ {
            type: 'toolCall',
            id: 'call_1',
            name: 'find_pages',
            input: { query: 'pricing' }
          } ]
        },
        {
          role: 'tool',
          content: [
            {
              type: 'toolResult',
              toolCallId: 'call_1',
              output: { found: true }
            },
            {
              type: 'toolResult',
              toolCallId: 'call_2',
              error: 'unknown tool "ghost"'
            }
          ]
        }
      ]);
    });

    it('rejects tool parts in the wrong role and malformed tool parts', function() {
      throwsInvalid(
        () => apos.ai.normalizeMessages([ {
          role: 'user',
          content: [ {
            type: 'toolCall',
            id: 'x',
            name: 'y',
            input: {}
          } ]
        } ]),
        /a "toolCall" part is not valid in a "user" message/
      );
      throwsInvalid(
        () => apos.ai.normalizeMessages([ {
          role: 'tool',
          content: 'result'
        } ]),
        /a "text" part is not valid in a "tool" message/
      );
      throwsInvalid(
        () => apos.ai.normalizeMessages([ {
          role: 'assistant',
          content: [ {
            type: 'toolCall',
            id: '',
            name: 'y',
            input: {}
          } ]
        } ]),
        /must be an object like \{ type, id, name, input \}/
      );
      throwsInvalid(
        () => apos.ai.normalizeMessages([ {
          role: 'tool',
          content: [ {
            type: 'toolResult',
            toolCallId: 'x',
            output: { a: 1 },
            error: 'both'
          } ]
        } ]),
        /must carry an object "output" or a string "error", not both/
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
        /messages\[0\]\.role must be "user", "assistant" or "tool"/
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
      assert.equal(provider, 'fake');
      assert.deepEqual(request, {
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
      assert.equal(high.request.model, 'fake-large');
      assert.equal(high.request.reasoning, 'high');
      assert.equal(high.request.maxTokens, 32000);

      const overridden = apos.ai.buildRequest(canonical('p', {
        effort: 'high',
        reasoning: 'low',
        maxTokens: 500
      }));
      assert.equal(overridden.request.reasoning, 'low');
      assert.equal(overridden.request.maxTokens, 500);
    });

    it('omits maxTokens for a model with no declared metadata', function() {
      const { request } = apos.ai.buildRequest(canonical('p', {
        provider: 'fake',
        model: 'fake-next'
      }));
      assert.equal(request.model, 'fake-next');
      assert(!('maxTokens' in request));
    });

    it('translates the cache level to the { ttl } policy', function() {
      assert.deepEqual(
        apos.ai.buildRequest(canonical('p', { cache: 'long' })).request.cache,
        { ttl: 'long' }
      );
      assert.equal(
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
      assert.equal(request.system, 'You are terse.');
      assert.equal(request.signal, controller.signal);
    });

    it('passes a structured-output schema through to the adapter request', function() {
      const schema = {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: [ 'title' ]
      };
      const { request } = apos.ai.buildRequest(canonical('p', { schema }));
      assert.deepEqual(request.schema, schema);
    });

    it('throws the routing errors a real call would', function() {
      assert.throws(
        () => apos.ai.buildRequest(canonical('p', { effort: 'extreme' })),
        (e) => {
          assert.equal(e.name, 'invalid');
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
                  // Snapshot: the loop keeps growing request.messages
                  chatCalls.push({
                    ...request,
                    messages: [ ...request.messages ]
                  });
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
                },
                nostructured: {
                  adapter: 'fake',
                  apiKey: 'k3',
                  capabilities: { structured: false }
                }
              },
              // Keep retried tests fast; the delay engine has its own suite
              retryBaseDelay: 1,
              // Must stay inert without APOS_AI_MOCK
              mock() {
                throw new Error('the mock option was consulted without APOS_AI_MOCK');
              }
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
      assert.deepEqual(result, {
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
      assert.equal(chatCalls.length, 1);
      assert.equal(chatCalls[0].model, 'fake-medium');
      assert.equal(chatCalls[0].maxTokens, 16000);
      assert.deepEqual(chatCalls[0].cache, { ttl: 'short' });
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
      assert.equal(chatCalls[0].messages.length, 3);
      assert.equal(result.text, 'Done.');
      // The transcript is resumable: it ends with the assistant turn
      assert.equal(result.messages.length, 4);
      assert.deepEqual(result.messages[3], {
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
      assert.deepEqual(events.map(([ name ]) => name), [ 'before', 'after' ]);
      const [ [ , beforeContext ], [ , afterContext ] ] = events;
      // One shared, mutable context correlates the two
      assert.equal(beforeContext, afterContext);
      assert.equal(beforeContext.provider, 'fake');
      assert(Array.isArray(beforeContext.request.messages));
      assert.equal(afterContext.result.text, 'a haiku');
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
      assert.equal(result.text, 'a haiku');
      assert.equal(chatCalls.length, 3);
    });

    it('gives up when the attempts cap is exhausted', async function() {
      chatScript = Array.from({ length: 5 }, () => () => {
        throw httpError(429);
      });
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'aiRetry');
        return true;
      });
      assert.equal(chatCalls.length, 5);
    });

    it('honors the retryAttempts option', async function() {
      const saved = apos.ai.options.retryAttempts;
      try {
        apos.ai.options.retryAttempts = 2;
        chatScript = Array.from({ length: 3 }, () => () => {
          throw httpError(429);
        });
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.equal(e.name, 'aiRetry');
          return true;
        });
        assert.equal(chatCalls.length, 2);
      } finally {
        apos.ai.options.retryAttempts = saved;
      }
    });

    it('hard-stops on a standard code without retrying', async function() {
      chatScript = [ () => {
        throw httpError(401);
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'forbidden');
        return true;
      });
      assert.equal(chatCalls.length, 1);
      // beforeGenerate fired, afterGenerate did not
      assert.deepEqual(events.map(([ name ]) => name), [ 'before' ]);
    });

    it('passes an adapter-thrown normalized error through untouched', async function() {
      const refusal = apos.error('aiRefusal', 'safety policy');
      chatScript = [ () => {
        throw refusal;
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e, refusal);
        return true;
      });
      assert.equal(chatCalls.length, 1);
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
      assert.equal(result.text, 'a haiku');
      assert.equal(chatCalls.length, 2);
    });

    it('converts a refusal finish reason to the refusal error', async function() {
      chatScript = [ () => turn({ finishReason: 'refusal' }) ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'aiRefusal');
        return true;
      });
    });

    it('rejects unexpected tool calls from the adapter', async function() {
      chatScript = [ () => turn({
        content: [ {
          type: 'toolCall',
          id: 'c1',
          name: 'find_pages',
          input: {}
        } ],
        finishReason: 'toolCalls'
      }) ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'invalid');
        assert.match(e.message, /tool calls/);
        return true;
      });
    });

    it('ignores APOS_AI_MOCK set after startup', async function() {
      try {
        process.env.APOS_AI_MOCK = '1';
        chatScript = [ () => turn() ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p');
        assert.equal(result.text, 'a haiku');
        assert.equal(chatCalls.length, 1);
      } finally {
        delete process.env.APOS_AI_MOCK;
      }
    });

    it('refuses to route to a provider lacking the needed capability', async function() {
      await assert.rejects(
        apos.ai.generate(apos.task.getReq(), 'p', {
          provider: 'notext',
          model: 'fake-medium'
        }),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /does not declare the "text" capability/);
          return true;
        }
      );
      assert.equal(chatCalls.length, 0);
      assert.equal(events.length, 0);
    });

    describe('structured output', function() {
      const schema = {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            maxLength: 60
          },
          description: {
            type: 'string',
            maxLength: 160
          }
        },
        required: [ 'title', 'description' ]
      };
      const structuredCall = (extras) => apos.ai.generate(apos.task.getReq(), {
        messages: [ {
          role: 'user',
          content: 'write the metadata'
        } ],
        schema,
        ...extras
      });
      // The adapter extracts the structured answer onto the turn's
      // `object`; its JSON also stays in the content so the
      // transcript round-trips
      const jsonTurn = (object) => turn({
        content: [ {
          type: 'text',
          text: JSON.stringify(object)
        } ],
        object
      });

      it('returns the validated object and sends the schema on the request', async function() {
        const object = {
          title: 'Pricing',
          description: 'Our plans'
        };
        chatScript = [ () => jsonTurn(object) ];
        const result = await structuredCall();
        assert.deepEqual(result.object, object);
        // The JSON stays on text; no tools means no steps/toolCalls
        assert.equal(result.text, JSON.stringify(object));
        assert.equal(result.finishReason, 'stop');
        assert.equal('steps' in result, false);
        assert.equal('toolCalls' in result, false);
        // The adapter received the schema to constrain its provider
        assert.deepEqual(chatCalls[0].schema, schema);
      });

      it('refuses a structured call to a provider without the capability', async function() {
        await assert.rejects(
          structuredCall({
            provider: 'nostructured',
            model: 'fake-medium'
          }),
          (e) => {
            assert.equal(e.name, 'invalid');
            assert.match(e.message, /does not declare the "structured" capability/);
            return true;
          }
        );
        assert.equal(chatCalls.length, 0);
      });

      it('retries a non-conforming response through the backstop, then succeeds', async function() {
        const object = {
          title: 'ok',
          description: 'good'
        };
        chatScript = [
          // A stop turn that produced no structured object
          () => turn({
            content: [ {
              type: 'text',
              text: 'here is your metadata'
            } ]
          }),
          // An object missing a required field
          () => jsonTurn({ title: 'ok' }),
          () => jsonTurn(object)
        ];
        const result = await structuredCall();
        assert.deepEqual(result.object, object);
        assert.equal(chatCalls.length, 3);
        // Each backstop failure travelled the normal retry path
        assert.equal(logRecords.filter((r) => r.type === 'retry').length, 2);
      });

      it('gives up when no structured object is ever returned', async function() {
        chatScript = Array.from({ length: 5 }, () => () => turn({
          content: [ {
            type: 'text',
            text: 'not structured'
          } ]
        }));
        await assert.rejects(structuredCall(), (e) => {
          assert.equal(e.name, 'aiRetry');
          assert.match(e.message, /no structured output/);
          return true;
        });
      });

      it('treats a schema-mismatching object as transient', async function() {
        chatScript = Array.from({ length: 5 }, () => () => jsonTurn({ title: 'only a title' }));
        await assert.rejects(structuredCall(), (e) => {
          assert.equal(e.name, 'aiRetry');
          assert.match(e.message, /does not match the schema/);
          return true;
        });
      });

      it('surfaces a refusal rather than a backstop retry', async function() {
        chatScript = [ () => turn({
          finishReason: 'refusal',
          content: [ {
            type: 'text',
            text: 'I cannot help with that'
          } ]
        }) ];
        await assert.rejects(structuredCall(), (e) => {
          assert.equal(e.name, 'aiRefusal');
          return true;
        });
        // The non-JSON refusal was not retried as a malformed response
        assert.equal(chatCalls.length, 1);
      });

      it('returns a length finish without an object and without retrying', async function() {
        // Truncated output: re-asking cannot fix a too-small maxTokens,
        // so the backstop must not treat it as malformed
        chatScript = [ () => turn({
          finishReason: 'length',
          content: [ {
            type: 'text',
            text: '{"title": "Pric'
          } ]
        }) ];
        const result = await structuredCall();
        assert.equal(result.finishReason, 'length');
        assert.equal('object' in result, false);
        assert.equal(result.text, '{"title": "Pric');
        assert.equal(chatCalls.length, 1);
        assert.equal(logRecords.length, 0);
      });
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
        assert.equal(apos.ai.retryDelay(1, error), 7000);
        assert.equal(apos.ai.retryDelay(3, error), 7000);
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
        assert.equal(result.text, 'a haiku');
        assert.deepEqual(waits, [ 3000 ]);
      });

      it('stops without sleeping when the delay would exceed the elapsed budget', async function() {
        chatScript = [ () => {
          const e = httpError(429);
          // Beyond the 60s budget
          e.retryAfter = 120;
          throw e;
        } ];
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.equal(e.name, 'aiRetry');
          return true;
        });
        assert.equal(chatCalls.length, 1);
        assert.deepEqual(waits, []);
        const [ record ] = logRecords;
        assert.equal(record.severity, 'error');
        assert.equal(record.type, 'failure');
        assert.equal(record.data.action, 'stop');
        assert.equal(record.data.reason, 'budget');
        assert.equal(record.data.retryAfter, 120);
        assert.equal(record.data.delay, 120000);
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
        assert.equal(logRecords.length, 2);
        const [ first, second ] = logRecords;
        assert.equal(first.severity, 'warn');
        assert.equal(first.type, 'retry');
        assert.equal(first.data.provider, 'fake');
        assert.equal(first.data.model, 'fake-medium');
        assert.equal(first.data.code, 'aiRetry');
        assert.equal(first.data.status, 429);
        assert.equal(first.data.kind, 'rateLimit');
        assert.equal(first.data.attempt, 1);
        assert.equal(first.data.action, 'retry');
        assert(Number.isFinite(first.data.delay));
        assert.equal(second.data.status, 503);
        assert.equal(second.data.attempt, 2);
      });

      it('records a hard stop with its context', async function() {
        chatScript = [ () => {
          const e = httpError(401);
          e.requestId = 'req_123';
          throw e;
        } ];
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.equal(e.name, 'forbidden');
          return true;
        });
        assert.equal(logRecords.length, 1);
        const [ record ] = logRecords;
        assert.equal(record.severity, 'error');
        assert.equal(record.type, 'failure');
        assert.equal(record.message, 'bad credentials');
        assert.equal(record.data.code, 'forbidden');
        assert.equal(record.data.status, 401);
        assert.equal(record.data.requestId, 'req_123');
        assert.equal(record.data.attempt, 1);
        assert.equal(record.data.action, 'stop');
        assert.equal(record.data.reason, undefined);
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
            assert.equal(e.name, 'aiRetry');
            return true;
          });
          assert.deepEqual(
            logRecords.map((record) => [ record.type, record.data.reason ]),
            [ [ 'retry', undefined ], [ 'failure', 'attempts' ] ]
          );
        } finally {
          apos.ai.options.retryAttempts = saved;
        }
      });
    });
  });

  describe('mock mode', function() {
    before(function() {
      process.env.APOS_AI_MOCK = '1';
    });

    after(function() {
      delete process.env.APOS_AI_MOCK;
    });

    describe('with providers configured', function() {
      // Thunks consumed by the mock option, one per call; empty means
      // the request-aware default
      let mockScript;
      let chatCalls;
      let logRecords;

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
                    throw new Error('a real adapter was called in mock mode');
                  }
                }));
              }
            },
            '@apostrophecms/ai': {
              options: {
                provider: 'fake',
                providers: {
                  // No apiKey: booting proves validate() is skipped
                  fake: {},
                  notext: {
                    adapter: 'fake',
                    capabilities: { text: false }
                  }
                },
                retryBaseDelay: 1,
                mock(request) {
                  const step = mockScript.shift();
                  return step && step(request);
                }
              }
            }
          }
        });
      });

      beforeEach(function() {
        mockScript = [];
        chatCalls = [];
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

      it('answers with the request-aware default and no adapter call', async function() {
        const result = await apos.ai.generate(
          apos.task.getReq(),
          'write a haiku about cats'
        );
        assert.deepEqual(result, {
          text: '[mock] write a haiku about cats',
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
                text: '[mock] write a haiku about cats'
              } ]
            }
          ],
          finishReason: 'stop',
          usage: {
            inputTokens: 6,
            outputTokens: 8
          },
          // Routing still resolves for real
          model: 'fake-medium',
          provider: 'fake'
        });
        assert.equal(chatCalls.length, 0);
      });

      it('hands the fully assembled request to the mock option', async function() {
        let seen;
        mockScript = [ (request) => {
          seen = request;
          return { text: 'scripted' };
        } ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p', {
          system: 'You are terse.',
          effort: 'high'
        });
        assert.equal(result.text, 'scripted');
        assert.equal(seen.model, 'fake-large');
        assert.equal(seen.reasoning, 'high');
        assert.equal(seen.system, 'You are terse.');
        assert.equal(seen.maxTokens, 32000);
      });

      it('returns a complete assistant turn from the mock option as-is', async function() {
        mockScript = [ () => ({
          content: [ {
            type: 'text',
            text: 'full turn'
          } ],
          finishReason: 'length',
          usage: {
            inputTokens: 100,
            outputTokens: 200
          },
          model: 'scripted-model'
        }) ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p');
        assert.equal(result.text, 'full turn');
        assert.equal(result.finishReason, 'length');
        assert.deepEqual(result.usage, {
          inputTokens: 100,
          outputTokens: 200
        });
        assert.equal(result.model, 'scripted-model');
      });

      it('falls through to the default when the mock option returns undefined', async function() {
        mockScript = [ () => undefined ];
        const result = await apos.ai.generate(apos.task.getReq(), 'hello there');
        assert.equal(result.text, '[mock] hello there');
      });

      it('rejects a mock return that is neither a turn nor { text }', async function() {
        mockScript = [ () => 'a plain string' ];
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /"mock" must return/);
          return true;
        });
      });

      it('mimics transient failures through the real retry path', async function() {
        mockScript = [
          () => {
            throw apos.error('aiRetry', 'scripted overload', { kind: 'overload' });
          },
          () => ({ text: 'recovered' })
        ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p');
        assert.equal(result.text, 'recovered');
        assert.equal(logRecords.length, 1);
        const [ record ] = logRecords;
        assert.equal(record.type, 'retry');
        assert.equal(record.data.kind, 'overload');
        assert.equal(record.data.provider, 'fake');
      });

      it('mimics a hard failure with its failure record', async function() {
        mockScript = [ () => {
          throw apos.error('forbidden', 'scripted bad key');
        } ];
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.equal(e.name, 'forbidden');
          return true;
        });
        assert.deepEqual(
          logRecords.map((record) => [ record.type, record.data.code ]),
          [ [ 'failure', 'forbidden' ] ]
        );
      });

      it('converts a mock refusal turn to the refusal error', async function() {
        mockScript = [ () => ({
          content: [],
          finishReason: 'refusal',
          usage: {
            inputTokens: 1,
            outputTokens: 0
          }
        }) ];
        await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
          assert.equal(e.name, 'aiRefusal');
          return true;
        });
      });

      it('still refuses routing to a provider lacking the capability', async function() {
        await assert.rejects(
          apos.ai.generate(apos.task.getReq(), 'p', {
            provider: 'notext',
            model: 'fake-medium'
          }),
          (e) => {
            assert.equal(e.name, 'invalid');
            assert.match(e.message, /does not declare the "text" capability/);
            return true;
          }
        );
      });
    });

    describe('with zero configuration', function() {
      before(async function() {
        await t.destroy(apos);
        apos = await t.create({
          root: module,
          modules: {}
        });
      });

      it('is active and generates with no providers, keys or adapters', async function() {
        assert.equal(apos.ai.mockMode, true);
        assert.equal(apos.ai.active, true);
        const result = await apos.ai.generate(
          apos.task.getReq(),
          'write a haiku about cats'
        );
        assert.equal(result.text, '[mock] write a haiku about cats');
        assert.equal(result.provider, 'mock');
        assert.equal(result.model, 'mock');
        assert.equal(result.finishReason, 'stop');
        assert(Number.isFinite(result.usage.inputTokens));
        assert(Number.isFinite(result.usage.outputTokens));
      });

      it('echoes an explicit provider and model into the placeholder routing', async function() {
        const result = await apos.ai.generate(apos.task.getReq(), 'p', {
          provider: 'anthropic',
          model: 'claude-sonnet-x'
        });
        assert.equal(result.provider, 'anthropic');
        assert.equal(result.model, 'claude-sonnet-x');
      });

      it('continues a conversation', async function() {
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
          }
        );
        assert.equal(result.messages.length, 4);
        assert.equal(result.text, '[mock] Create one from the standard template.');
      });

      it('synthesizes a schema-conforming object for a structured call', async function() {
        const result = await apos.ai.generate(apos.task.getReq(), {
          messages: [ {
            role: 'user',
            content: 'write the metadata'
          } ],
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              count: {
                type: 'integer',
                minimum: 3
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1
              },
              kind: { enum: [ 'a', 'b' ] }
            },
            required: [ 'title', 'count', 'tags', 'kind' ]
          }
        });
        // Deterministic: '' string, the minimum integer, one item at
        // minItems, the first enum value — and it passed the backstop
        assert.deepEqual(result.object, {
          title: '',
          count: 3,
          tags: [ '' ],
          kind: 'a'
        });
        assert.equal(result.provider, 'mock');
      });
    });
  });

  describe('APOS_AI_MOCK=0', function() {
    before(async function() {
      process.env.APOS_AI_MOCK = '0';
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        modules: {}
      });
    });

    after(function() {
      delete process.env.APOS_AI_MOCK;
    });

    it('means off: no mock rescue for a zero configuration', async function() {
      assert.equal(apos.ai.mockMode, false);
      assert.equal(apos.ai.active, false);
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'invalid');
        return true;
      });
    });
  });
});
