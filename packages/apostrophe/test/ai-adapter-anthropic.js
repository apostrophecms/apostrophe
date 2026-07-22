const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('AI adapter: anthropic', function() {
  this.timeout(t.timeout);

  let apos;
  // The adapter module instance, for unit access to the dialect methods
  let adapter;
  let savedLiveKey;

  before(async function() {
    // A real key in the environment would override the fixture keys
    // below (envKey); keep the suite hermetic and restore at the end
    savedLiveKey = process.env.APOS_ANTHROPIC_KEY;
    delete process.env.APOS_ANTHROPIC_KEY;
    apos = await t.create({
      root: module,
      modules: {
        'tool-fixtures': {
          init(self) {
            self.apos.ai.addTool({
              name: 'echo',
              description: 'Echo the value back',
              access: 'read',
              input: {
                type: 'object',
                properties: { value: { type: 'string' } },
                required: [ 'value' ]
              },
              schema: { value: { type: 'string' } },
              handler: (req, args) => ({ value: args.value })
            });
          }
        },
        '@apostrophecms/ai': {
          options: {
            provider: 'anthropic',
            providers: {
              anthropic: { apiKey: 'sk-test' },
              gateway: {
                adapter: 'anthropic',
                apiKey: 'sk-gw',
                baseUrl: 'https://llm-gateway.example.com/anthropic'
              }
            },
            // Keep retried tests fast; the delay engine has its own suite
            retryBaseDelay: 1
          }
        }
      }
    });
    adapter = apos.modules['@apostrophecms/ai-adapter-anthropic'];
  });

  after(async function() {
    if (savedLiveKey !== undefined) {
      process.env.APOS_ANTHROPIC_KEY = savedLiveKey;
    }
    if (apos) {
      return t.destroy(apos);
    }
  });

  const text = (value) => ({
    type: 'text',
    text: value
  });
  const userMessage = (value) => ({
    role: 'user',
    content: [ text(value) ]
  });
  // A minimal normalized adapter request, as the engine assembles it
  const request = (extras = {}) => ({
    messages: [ userMessage('write a haiku about cats') ],
    model: 'claude-sonnet-4-6',
    maxTokens: 64000,
    cache: false,
    ...extras
  });
  // A canned Messages API response body
  const fixture = (extras = {}) => ({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content: [ text('a haiku') ],
    model: 'claude-sonnet-4-6-20250929',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 12,
      output_tokens: 7
    },
    ...extras
  });
  // An apos.http >= 400 throw: Error with status, headers, body
  const httpError = (status, headers = {}, body) => Object.assign(
    new Error(`HTTP error ${status}`),
    {
      status,
      headers,
      body
    }
  );

  it('registers the adapter and activates the provider', function() {
    assert(apos.ai.getAdapter('anthropic'));
    assert.equal(apos.ai.active, true);
    const info = apos.ai.modelInfo();
    assert.equal(info.provider, 'anthropic');
    assert.equal(info.model, 'claude-sonnet-4-6');
    assert.equal(info.contextWindow, 200000);
    assert.equal(info.maxOutputTokens, 64000);
    const high = apos.ai.modelInfo({ effort: 'high' });
    assert.equal(high.model, 'claude-opus-4-8');
    assert.equal(high.reasoning, 'high');
  });

  describe('request translation', function() {
    it('builds the minimal body', function() {
      assert.deepEqual(adapter.buildBody(request()), {
        model: 'claude-sonnet-4-6',
        max_tokens: 64000,
        messages: [ {
          role: 'user',
          content: [ {
            type: 'text',
            text: 'write a haiku about cats'
          } ]
        } ]
      });
    });

    it('places the cache markers on the system tail and the last message', function() {
      const body = adapter.buildBody(request({
        system: 'You help editors.',
        messages: [
          userMessage('Do we have a pricing page?'),
          {
            role: 'assistant',
            content: [ text('No, I did not find one.') ]
          },
          userMessage('Create one.')
        ],
        cache: { ttl: 'short' }
      }));
      assert.deepEqual(body.system, [ {
        type: 'text',
        text: 'You help editors.',
        cache_control: { type: 'ephemeral' }
      } ]);
      // Only the rolling marker on the final message, nothing earlier
      assert.deepEqual(body.messages.map((message) =>
        message.content.some((block) => block.cache_control)
      ), [ false, false, true ]);
      assert.deepEqual(body.messages.at(-1).content.at(-1).cache_control, {
        type: 'ephemeral'
      });
    });

    it('maps the long cache level to the 1h ttl', function() {
      const body = adapter.buildBody(request({ cache: { ttl: 'long' } }));
      assert.deepEqual(body.messages.at(-1).content.at(-1).cache_control, {
        type: 'ephemeral',
        ttl: '1h'
      });
    });

    it('places no markers when caching is off', function() {
      const body = adapter.buildBody(request({ system: 'S' }));
      assert.equal(body.system, 'S');
      assert.equal(body.messages.at(-1).content.at(-1).cache_control, undefined);
    });

    it('translates both image part forms', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'user',
          content: [
            text('describe these'),
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
        } ]
      }));
      assert.deepEqual(body.messages[0].content.slice(1), [
        {
          type: 'image',
          source: {
            type: 'url',
            url: 'https://example.com/a.png'
          }
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: 'aGk='
          }
        }
      ]);
    });

    it('maps reasoning levels to thinking budgets', function() {
      for (const [ level, budget ] of [
        [ 'low', 1024 ],
        [ 'medium', 4096 ],
        [ 'high', 16384 ]
      ]) {
        assert.deepEqual(
          adapter.buildBody(request({ reasoning: level })).thinking,
          {
            type: 'enabled',
            budget_tokens: budget
          }
        );
      }
    });

    it('reads the budgets from the thinkingBudgets option', function() {
      const saved = adapter.options.thinkingBudgets;
      try {
        adapter.options.thinkingBudgets = {
          ...saved,
          medium: 8192
        };
        assert.equal(
          adapter.buildBody(request({ reasoning: 'medium' })).thinking.budget_tokens,
          8192
        );
      } finally {
        adapter.options.thinkingBudgets = saved;
      }
    });

    it('rejects untranslatable requests', function() {
      const throwsInvalid = (fn, pattern) => {
        assert.throws(fn, (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, pattern);
          return true;
        });
      };
      throwsInvalid(
        () => adapter.buildBody(request({ reasoning: 'extreme' })),
        /no thinking budget is configured for reasoning "extreme"/
      );
      throwsInvalid(
        () => adapter.buildBody(request({
          reasoning: 'high',
          maxTokens: 1000
        })),
        /must exceed the "high" thinking budget/
      );
      throwsInvalid(
        () => adapter.buildBody(request({ maxTokens: undefined })),
        /"maxTokens" is required/
      );
    });

    it('translates tool definitions to the tools array', function() {
      const input = {
        type: 'object',
        properties: { title: { type: 'string' } }
      };
      const body = adapter.buildBody(request({
        tools: [ {
          name: 'find_pages',
          description: 'Find pages',
          input
        } ]
      }));
      assert.deepEqual(body.tools, [ {
        name: 'find_pages',
        description: 'Find pages',
        input_schema: input
      } ]);
    });

    it('carries tool requests and results as tool_use and tool_result blocks', function() {
      const body = adapter.buildBody(request({
        messages: [
          {
            role: 'assistant',
            content: [
              text('searching'),
              {
                type: 'toolCall',
                id: 'c1',
                name: 'find_pages',
                input: { title: 'Pricing' }
              }
            ]
          },
          {
            role: 'tool',
            content: [ {
              type: 'toolResult',
              toolCallId: 'c1',
              output: { id: 'p1' }
            } ]
          }
        ]
      }));
      assert.deepEqual(body.messages, [
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'searching'
            },
            {
              type: 'tool_use',
              id: 'c1',
              name: 'find_pages',
              input: { title: 'Pricing' }
            }
          ]
        },
        {
          // No tool role in this dialect: results ride a user message
          role: 'user',
          content: [ {
            type: 'tool_result',
            tool_use_id: 'c1',
            content: JSON.stringify({ id: 'p1' })
          } ]
        }
      ]);
    });

    it('flags a tool error result', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'tool',
          content: [ {
            type: 'toolResult',
            toolCallId: 'c1',
            error: 'the index is rebuilding'
          } ]
        } ]
      }));
      assert.deepEqual(body.messages[0].content[0], {
        type: 'tool_result',
        tool_use_id: 'c1',
        content: 'the index is rebuilding',
        is_error: true
      });
    });

    it('replays a thinking part as its raw signed block, in place', function() {
      const block = {
        type: 'thinking',
        thinking: 'let me see',
        signature: 'x'
      };
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              block
            },
            {
              type: 'toolCall',
              id: 'toolu_1',
              name: 'find_pages',
              input: { title: 'Pricing' }
            }
          ]
        } ]
      }));
      assert.deepEqual(body.messages[0].content, [
        block,
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'find_pages',
          input: { title: 'Pricing' }
        }
      ]);
    });

    it('skips assistant parts another dialect owns', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              item: { type: 'reasoning' }
            },
            text('visible')
          ]
        } ]
      }));
      assert.deepEqual(body.messages[0].content, [ text('visible') ]);
    });

    it('adds the synthetic final-answer tool and forces it for a pure structured call', function() {
      const schema = {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: [ 'title' ]
      };
      const body = adapter.buildBody(request({ schema }));
      assert.equal(body.tools.length, 1);
      assert.equal(body.tools[0].name, '_final_answer');
      assert.equal(typeof body.tools[0].description, 'string');
      assert.deepEqual(body.tools[0].input_schema, schema);
      assert.deepEqual(body.tool_choice, {
        type: 'tool',
        name: '_final_answer'
      });
    });

    it('does not force the final-answer tool when thinking is on', function() {
      const body = adapter.buildBody(request({
        schema: { type: 'object' },
        reasoning: 'high'
      }));
      assert.equal(body.tools[0].name, '_final_answer');
      assert.equal('tool_choice' in body, false);
    });

    it('adds the final-answer tool beside real tools without forcing', function() {
      const body = adapter.buildBody(request({
        schema: { type: 'object' },
        tools: [ {
          name: 'find_pages',
          description: 'Find pages',
          input: { type: 'object' }
        } ]
      }));
      assert.deepEqual(body.tools.map((tool) => tool.name), [ 'find_pages', '_final_answer' ]);
      assert.equal('tool_choice' in body, false);
    });
  });

  describe('response parsing', function() {
    it('parses a text turn', function() {
      assert.deepEqual(adapter.parseResponse(fixture()), {
        content: [ text('a haiku') ],
        finishReason: 'stop',
        usage: {
          inputTokens: 12,
          outputTokens: 7
        },
        model: 'claude-sonnet-4-6-20250929'
      });
    });

    it('maps the stop reasons', function() {
      for (const [ theirs, ours ] of [
        [ 'end_turn', 'stop' ],
        [ 'stop_sequence', 'stop' ],
        [ 'max_tokens', 'length' ],
        [ 'tool_use', 'toolCalls' ],
        // Unknown reasons yield none: the engine treats the turn as
        // malformed and retries, never a truncated success
        [ 'pause_turn', undefined ]
      ]) {
        assert.equal(
          adapter.parseResponse(fixture({ stop_reason: theirs })).finishReason,
          ours
        );
      }
    });

    it('translates tool_use blocks and carries thinking blocks as opaque parts', function() {
      const thinking = {
        type: 'thinking',
        thinking: 'let me see',
        signature: 'x'
      };
      const redacted = {
        type: 'redacted_thinking',
        data: 'opaque'
      };
      const turn = adapter.parseResponse(fixture({
        content: [
          thinking,
          redacted,
          text('checking'),
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'find_pages',
            input: { title: 'Pricing' }
          }
        ],
        stop_reason: 'tool_use'
      }));
      assert.deepEqual(turn.content, [
        {
          type: 'thinking',
          block: thinking
        },
        {
          type: 'thinking',
          block: redacted
        },
        text('checking'),
        {
          type: 'toolCall',
          id: 'toolu_1',
          name: 'find_pages',
          input: { title: 'Pricing' }
        }
      ]);
      assert.equal(turn.finishReason, 'toolCalls');
    });

    it('throws the refusal error on a refusal stop reason', function() {
      assert.throws(
        () => adapter.parseResponse(fixture({ stop_reason: 'refusal' })),
        (e) => {
          assert.equal(e.name, 'aiRefusal');
          return true;
        }
      );
    });

    it('turns a final-answer tool call into a structured stop turn', function() {
      const object = { title: 'Pricing' };
      const turn = adapter.parseResponse(
        fixture({
          content: [ {
            type: 'tool_use',
            id: 'toolu_1',
            name: '_final_answer',
            input: object
          } ],
          stop_reason: 'tool_use'
        }),
        request({ schema: { type: 'object' } })
      );
      assert.deepEqual(turn.object, object);
      assert.equal(turn.finishReason, 'stop');
      // The JSON stays on the text so the transcript round-trips
      assert.deepEqual(turn.content, [ text(JSON.stringify(object)) ]);
    });

    it('leaves a free-text answer without an object for the backstop to retry', function() {
      const turn = adapter.parseResponse(
        fixture({ content: [ text('here is your answer') ] }),
        request({ schema: { type: 'object' } })
      );
      assert.equal('object' in turn, false);
      assert.equal(turn.finishReason, 'stop');
    });
  });

  describe('error normalization', function() {
    it('maps the statuses to the normalized codes', function() {
      for (const [ status, code, kind ] of [
        [ 429, 'aiRetry', 'rateLimit' ],
        [ 500, 'aiRetry', 'overload' ],
        [ 529, 'aiRetry', 'overload' ],
        [ 401, 'forbidden', undefined ],
        [ 403, 'forbidden', undefined ],
        [ 404, 'notfound', undefined ],
        [ 400, 'invalid', undefined ]
      ]) {
        const error = adapter.normalizeError(httpError(status));
        assert.equal(error.name, code);
        assert.equal(error.data.status, status);
        assert.equal(error.data.kind, kind);
      }
    });

    it('prefers the provider message and carries the request id', function() {
      const error = adapter.normalizeError(httpError(401, {
        'request-id': 'req_9'
      }, {
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'invalid x-api-key'
        }
      }));
      assert.equal(error.message, 'invalid x-api-key');
      assert.equal(error.data.requestId, 'req_9');
    });

    it('parses Retry-After as seconds and as an HTTP date', function() {
      const seconds = adapter.normalizeError(httpError(429, { 'retry-after': '7' }));
      assert.equal(seconds.data.retryAfter, 7);
      const date = adapter.normalizeError(httpError(429, {
        'retry-after': new Date(Date.now() + 30000).toUTCString()
      }));
      assert(date.data.retryAfter >= 28 && date.data.retryAfter <= 31);
      const garbage = adapter.normalizeError(httpError(429, { 'retry-after': 'soon' }));
      assert.equal(garbage.data.retryAfter, undefined);
    });

    it('maps timeouts and network failures to the transient code', function() {
      const timeout = adapter.normalizeError(
        new DOMException('The operation timed out', 'TimeoutError')
      );
      assert.equal(timeout.name, 'aiRetry');
      assert.equal(timeout.data.kind, 'timeout');
      const network = adapter.normalizeError(new TypeError('fetch failed'));
      assert.equal(network.name, 'aiRetry');
      assert.equal(network.data.kind, 'network');
      assert.match(network.message, /fetch failed/);
    });

    it('passes a caller abort through untouched', function() {
      const abort = new DOMException('The operation was aborted', 'AbortError');
      assert.equal(adapter.normalizeError(abort), abort);
    });
  });

  describe('the wire', function() {
    // Thunks consumed by the stubbed apos.http.post, one per call
    let httpScript;
    let httpCalls;
    let logRecords;
    let waits;
    let originalPost;

    before(function() {
      originalPost = apos.http.post;
    });

    after(function() {
      apos.http.post = originalPost;
    });

    beforeEach(function() {
      httpScript = [];
      httpCalls = [];
      waits = [];
      logRecords = [];
      apos.http.post = async (url, options) => {
        httpCalls.push({
          url,
          options
        });
        const step = httpScript.shift();
        if (step === undefined) {
          throw new Error('post called beyond its script');
        }
        return step();
      };
      apos.ai.pause = async (ms) => {
        waits.push(ms);
      };
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

    it('generates end to end against the dialect', async function() {
      httpScript = [ () => fixture() ];
      const result = await apos.ai.generate(
        apos.task.getReq(),
        'write a haiku about cats'
      );
      assert.equal(result.text, 'a haiku');
      assert.equal(result.finishReason, 'stop');
      assert.equal(result.provider, 'anthropic');
      // The model the response named, not the routed alias
      assert.equal(result.model, 'claude-sonnet-4-6-20250929');
      assert.deepEqual(result.usage, {
        inputTokens: 12,
        outputTokens: 7
      });

      const [ call ] = httpCalls;
      assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
      assert.equal(call.options.headers['x-api-key'], 'sk-test');
      assert.equal(call.options.headers['anthropic-version'], '2023-06-01');
      assert.equal(call.options.timeout, 600000);
      assert.equal(call.options.body.model, 'claude-sonnet-4-6');
      assert.equal(call.options.body.max_tokens, 64000);
      // The default short cache policy became the rolling marker
      assert.deepEqual(call.options.body.messages, [ {
        role: 'user',
        content: [ {
          type: 'text',
          text: 'write a haiku about cats',
          cache_control: { type: 'ephemeral' }
        } ]
      } ]);
    });

    it('honors an aliased entry: its baseUrl, key and merged model metadata', async function() {
      httpScript = [ () => fixture() ];
      await apos.ai.generate(apos.task.getReq(), 'p', {
        provider: 'gateway',
        model: 'claude-sonnet-4-6'
      });
      const [ call ] = httpCalls;
      assert.equal(call.url, 'https://llm-gateway.example.com/anthropic/v1/messages');
      assert.equal(call.options.headers['x-api-key'], 'sk-gw');
      assert.equal(call.options.body.max_tokens, 64000);
    });

    it('drives a tool loop end to end over the wire', async function() {
      httpScript = [
        () => fixture({
          content: [ {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'echo',
            input: { value: 'pricing' }
          } ],
          stop_reason: 'tool_use'
        }),
        () => fixture({ content: [ text('done') ] })
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'use the tool', {
        tools: [ 'echo' ],
        // Keep the cache markers out of the message assertion below
        cache: false
      });
      assert.equal(result.text, 'done');
      assert.equal(result.finishReason, 'stop');
      assert.deepEqual(result.steps, [ {
        toolCall: {
          type: 'toolCall',
          id: 'toolu_1',
          name: 'echo',
          input: { value: 'pricing' }
        },
        result: { value: 'pricing' }
      } ]);
      assert.equal(httpCalls.length, 2);
      // The first wire call described the tool to the model
      assert.deepEqual(httpCalls[0].options.body.tools, [ {
        name: 'echo',
        description: 'Echo the value back',
        input_schema: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: [ 'value' ]
        }
      } ]);
      // The second carried the tool result back as a user message
      assert.deepEqual(httpCalls[1].options.body.messages.at(-1), {
        role: 'user',
        content: [ {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: JSON.stringify({ value: 'pricing' })
        } ]
      });
    });

    it('drives a thinking tool loop end to end, replaying the signed blocks', async function() {
      const thinking = {
        type: 'thinking',
        thinking: 'let me see',
        signature: 'x'
      };
      httpScript = [
        () => fixture({
          content: [
            thinking,
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'echo',
              input: { value: 'pricing' }
            }
          ],
          stop_reason: 'tool_use'
        }),
        () => fixture({ content: [ text('done') ] })
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'use the tool', {
        tools: [ 'echo' ],
        reasoning: 'high',
        cache: false
      });
      assert.equal(result.text, 'done');
      assert.equal(result.finishReason, 'stop');
      assert.equal(httpCalls.length, 2);
      // Thinking was on for both turns of the loop
      for (const call of httpCalls) {
        assert.deepEqual(call.options.body.thinking, {
          type: 'enabled',
          budget_tokens: 16384
        });
      }
      // The second call replays the assistant turn with its signed
      // thinking block restored, unmodified, ahead of the tool use
      assert.deepEqual(httpCalls[1].options.body.messages[1], {
        role: 'assistant',
        content: [
          thinking,
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'echo',
            input: { value: 'pricing' }
          }
        ]
      });
      assert.deepEqual(httpCalls[1].options.body.messages.at(-1), {
        role: 'user',
        content: [ {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: JSON.stringify({ value: 'pricing' })
        } ]
      });
    });

    it('returns a validated object for a structured call, forcing the final-answer tool', async function() {
      const object = {
        title: 'Pricing',
        description: 'Our plans'
      };
      httpScript = [ () => fixture({
        content: [ {
          type: 'tool_use',
          id: 'toolu_1',
          name: '_final_answer',
          input: object
        } ],
        stop_reason: 'tool_use'
      }) ];
      const result = await apos.ai.generate(apos.task.getReq(), {
        messages: [ {
          role: 'user',
          content: 'write the metadata'
        } ],
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' }
          },
          required: [ 'title', 'description' ]
        }
      });
      assert.deepEqual(result.object, object);
      // No real tools and no reasoning at medium effort: the tool is forced
      assert.deepEqual(httpCalls[0].options.body.tool_choice, {
        type: 'tool',
        name: '_final_answer'
      });
    });

    it('retries a structured call that answered in free text, then succeeds', async function() {
      // The detail that the answer is a hidden tool must not cut off the
      // engine's retry: a miss leaves no object, so the backstop re-asks
      const object = {
        title: 'Pricing',
        description: 'Our plans'
      };
      httpScript = [
        () => fixture({ content: [ text('here is the metadata') ] }),
        () => fixture({
          content: [ {
            type: 'tool_use',
            id: 'toolu_1',
            name: '_final_answer',
            input: object
          } ],
          stop_reason: 'tool_use'
        })
      ];
      const result = await apos.ai.generate(apos.task.getReq(), {
        messages: [ {
          role: 'user',
          content: 'write the metadata'
        } ],
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' }
          },
          required: [ 'title', 'description' ]
        }
      });
      assert.deepEqual(result.object, object);
      assert.equal(httpCalls.length, 2);
    });

    it('retries a 429 at the Retry-After delay', async function() {
      httpScript = [
        () => {
          throw httpError(429, {
            'retry-after': '2',
            'request-id': 'req_9'
          }, {
            type: 'error',
            error: {
              type: 'rate_limit_error',
              message: 'rate limited'
            }
          });
        },
        () => fixture()
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.equal(result.text, 'a haiku');
      assert.equal(httpCalls.length, 2);
      assert.deepEqual(waits, [ 2000 ]);
      const [ record ] = logRecords;
      assert.equal(record.type, 'retry');
      assert.equal(record.message, 'rate limited');
      assert.equal(record.data.kind, 'rateLimit');
      assert.equal(record.data.status, 429);
      assert.equal(record.data.retryAfter, 2);
      assert.equal(record.data.requestId, 'req_9');
    });

    it('retries an overloaded response', async function() {
      httpScript = [
        () => {
          throw httpError(529, {}, {
            type: 'error',
            error: {
              type: 'overloaded_error',
              message: 'Overloaded'
            }
          });
        },
        () => fixture()
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.equal(result.text, 'a haiku');
      assert.equal(logRecords[0].data.kind, 'overload');
    });

    it('hard-stops a 401 as forbidden', async function() {
      httpScript = [ () => {
        throw httpError(401, { 'request-id': 'req_1' }, {
          type: 'error',
          error: {
            type: 'authentication_error',
            message: 'invalid x-api-key'
          }
        });
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'forbidden');
        assert.equal(e.message, 'invalid x-api-key');
        return true;
      });
      assert.equal(httpCalls.length, 1);
      assert.deepEqual(
        logRecords.map((record) => [ record.type, record.data.code ]),
        [ [ 'failure', 'forbidden' ] ]
      );
    });

    it('surfaces an in-flight refusal as the refusal error', async function() {
      httpScript = [ () => fixture({ stop_reason: 'refusal' }) ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'aiRefusal');
        return true;
      });
    });

    it('retries an unknown stop reason as a malformed turn', async function() {
      httpScript = [
        () => fixture({ stop_reason: 'pause_turn' }),
        () => fixture()
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.equal(result.text, 'a haiku');
      assert.equal(httpCalls.length, 2);
    });

    it('lets a caller abort surface as its own error', async function() {
      httpScript = [ () => {
        throw new DOMException('The operation was aborted', 'AbortError');
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'AbortError');
        return true;
      });
      assert.equal(httpCalls.length, 1);
    });
  });

  describe('environment key', function() {
    before(async function() {
      process.env.APOS_ANTHROPIC_KEY = 'sk-env';
      process.env.APOS_SECOND_KEY = 'sk-second';
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/ai': {
            options: {
              provider: 'anthropic',
              providers: {
                // Native and keyless: validate() passes via the
                // environment alone
                anthropic: {},
                // An alias naming its own variable: a second account
                second: {
                  adapter: 'anthropic',
                  envKey: 'APOS_SECOND_KEY'
                },
                // An alias without envKey shares the native secret;
                // the environment overrides even its configured key
                shared: {
                  adapter: 'anthropic',
                  apiKey: 'sk-config'
                },
                // A named variable that is unset falls back to config
                fallback: {
                  adapter: 'anthropic',
                  envKey: 'APOS_UNSET_KEY',
                  apiKey: 'sk-fallback'
                }
              }
            }
          }
        }
      });
    });

    after(function() {
      delete process.env.APOS_ANTHROPIC_KEY;
      delete process.env.APOS_SECOND_KEY;
    });

    it('resolves each entry to the key its envKey names', function() {
      const keys = Object.fromEntries(
        Object.entries(apos.ai.providers).map(([ name, record ]) =>
          [ name, record.adapter.apiKey ])
      );
      assert.deepEqual(keys, {
        anthropic: 'sk-env',
        second: 'sk-second',
        shared: 'sk-env',
        fallback: 'sk-fallback'
      });
    });
  });

  describe('live smoke', function() {
    const liveKey = process.env.APOS_ANTHROPIC_KEY;
    let liveApos;

    before(async function() {
      if (!liveKey) {
        this.skip();
      }
      await t.destroy(apos);
      apos = null;
      liveApos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/ai': {
            options: {
              providers: {
                anthropic: { apiKey: liveKey }
              }
            }
          }
        }
      });
    });

    after(async function() {
      if (liveApos) {
        return t.destroy(liveApos);
      }
    });

    it('generates against Anthropic for real', async function() {
      const result = await liveApos.ai.generate(
        liveApos.task.getReq(),
        'write a haiku about cats',
        {
          effort: 'low',
          maxTokens: 200,
          cache: false
        }
      );
      assert(result.text.length > 0);
      assert.equal(result.provider, 'anthropic');
      assert.equal(result.finishReason, 'stop');
      assert(Number.isFinite(result.usage.inputTokens));
      assert(Number.isFinite(result.usage.outputTokens));
    });
  });
});
